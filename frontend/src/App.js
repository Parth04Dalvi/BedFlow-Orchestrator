import React, { useState, useEffect, useRef } from "react";
import { Activity, Radio, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";

const API_BASE = "http://localhost:8000/api/v1";
const WS_URL = "ws://localhost:8000/ws/live-floor-feed";

export default function App() {
  const [wsConnected, setWsConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [beds, setBeds] = useState([
    { id: "1", room: "ICU-101", tier: "ICU", status: "AVAILABLE", vent: true },
    { id: "2", room: "ICU-102", tier: "ICU", status: "OCCUPIED", vent: true },
    { id: "3", room: "GEN-201", tier: "GENERAL", status: "AVAILABLE", vent: false },
    { id: "4", room: "GEN-202", tier: "GENERAL", status: "CLEANING_IN_PROGRESS", vent: false },
    { id: "5", room: "ISO-301", tier: "ISOLATION", status: "AVAILABLE", vent: false },
    { id: "6", room: "STEP-401", tier: "STEP_DOWN", status: "RESERVED", vent: false },
  ]);

  const [triageForm, setTriageForm] = useState({
    mrn: "MRN-" + Math.floor(1000 + Math.random() * 9000),
    firstName: "Jane",
    lastName: "Doe",
    acuity: "ESI_1",
    targetTier: "ICU",
    requiresVentilator: true,
    requiresIsolation: false,
  });

  const wsRef = useRef(null);

  useEffect(() => {
    const connectWS = () => {
      const socket = new WebSocket(WS_URL);
      wsRef.current = socket;

      socket.onopen = () => {
        setWsConnected(true);
        addLog("Connected to real-time telemetry feed.");
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`[EVENT] Bed Mutation: ${data.bed_id?.slice(0, 8) || "Bed"} -> ${data.status}`);
          
          setBeds((prev) =>
            prev.map((b) =>
              b.id === data.bed_id ? { ...b, status: data.status } : b
            )
          );
        } catch (err) {
          addLog(`[FEED] ${event.data}`);
        }
      };

      socket.onclose = () => {
        setWsConnected(false);
        addLog("Telemetry stream disconnected. Retrying in 3s...");
        setTimeout(connectWS, 3000);
      };
    };

    connectWS();
    return () => wsRef.current?.close();
  }, []);

  const addLog = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 19)]);
  };

  const handleTriageSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Create Patient
      const patientRes = await fetch(`${API_BASE}/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mrn: triageForm.mrn,
          first_name: triageForm.firstName,
          last_name: triageForm.lastName,
          acuity: triageForm.acuity,
          requires_ventilator: triageForm.requiresVentilator,
          requires_isolation: triageForm.requiresIsolation,
          requires_dialysis: false,
        }),
      });

      if (!patientRes.ok) throw new Error("Failed to register patient");
      const patient = await patientRes.json();

      // 2. Request Allocation Match
      const allocRes = await fetch(`${API_BASE}/allocations/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patient.id,
          target_tier: triageForm.targetTier,
          wait_time_minutes: 2.5,
        }),
      });

      const alloc = await allocRes.json();
      addLog(`[ALLOCATED] Ticket: ${alloc.ticket_id.slice(0, 8)} | Score: ${alloc.priority_score} | Bed: ${alloc.assigned_bed_id ? alloc.assigned_bed_id.slice(0, 8) : "QUEUED"}`);
      
      // Rotate mock MRN
      setTriageForm((prev) => ({
        ...prev,
        mrn: "MRN-" + Math.floor(1000 + Math.random() * 9000),
      }));
    } catch (err) {
      addLog(`[ERROR] ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (bedId, currentStatus) => {
    const nextStatus =
      currentStatus === "AVAILABLE" ? "RESERVED" :
      currentStatus === "RESERVED" ? "OCCUPIED" :
      currentStatus === "OCCUPIED" ? "CLEANING_IN_PROGRESS" : "AVAILABLE";

    try {
      await fetch(`${API_BASE}/beds/${bedId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch (err) {
      // Optimistic update fallback for UI testing without seeded backend DB IDs
      setBeds((prev) =>
        prev.map((b) => (b.id === bedId ? { ...b, status: nextStatus } : b))
      );
      addLog(`[LOCAL MUTATION] Bed ${bedId} updated to ${nextStatus}`);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
      case "RESERVED":
        return "bg-amber-500/20 text-amber-400 border-amber-500/40";
      case "OCCUPIED":
        return "bg-rose-500/20 text-rose-400 border-rose-500/40";
      case "CLEANING_IN_PROGRESS":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/40";
      default:
        return "bg-slate-700 text-slate-300 border-slate-600";
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <Activity className="w-8 h-8 text-cyan-400" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">BedFlow Orchestrator</h1>
            <p className="text-xs text-slate-400">Deterministic Real-Time Clinical Asset Allocation</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-xs font-mono">
          <Radio className={`w-3.5 h-3.5 ${wsConnected ? "text-emerald-400 animate-pulse" : "text-rose-500"}`} />
          <span className={wsConnected ? "text-emerald-400" : "text-rose-400"}>
            {wsConnected ? "WEBSOCKET LIVE" : "DISCONNECTED"}
          </span>
        </div>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Bed Management */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Live Clinical Ward Layout
            </h2>
            <span className="text-xs text-slate-500">Click a card to cycle state</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {beds.map((bed) => (
              <div
                key={bed.id}
                onClick={() => handleStatusToggle(bed.id, bed.status)}
                className="cursor-pointer bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 rounded-lg space-y-3 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white tracking-wide">{bed.room}</span>
                  <span className="text-xs font-mono text-slate-400">{bed.tier}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getStatusBadge(bed.status)}`}>
                    {bed.status.replace(/_/g, " ")}
                  </span>
                  {bed.vent && (
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded">
                      VENT
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Real-time Telemetry Terminal */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-400">
              <span>EVENT STREAM TELEMETRY</span>
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="h-32 overflow-y-auto space-y-1 text-slate-300">
              {logs.length === 0 ? (
                <div className="text-slate-600 italic">Listening for WebSocket event dispatches...</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="leading-tight">{log}</div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Triage Intake */}
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <AlertCircle className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Emergency Triage Intake
            </h2>
          </div>

          <form onSubmit={handleTriageSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Medical Record # (MRN)</label>
              <input
                type="text"
                value={triageForm.mrn}
                onChange={(e) => setTriageForm({ ...triageForm, mrn: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 mb-1">First Name</label>
                <input
                  type="text"
                  value={triageForm.firstName}
                  onChange={(e) => setTriageForm({ ...triageForm, firstName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Last Name</label>
                <input
                  type="text"
                  value={triageForm.lastName}
                  onChange={(e) => setTriageForm({ ...triageForm, lastName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Acuity Level (ESI 1 = Highest)</label>
              <select
                value={triageForm.acuity}
                onChange={(e) => setTriageForm({ ...triageForm, acuity: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="ESI_1">ESI 1 - Resuscitation</option>
                <option value="ESI_2">ESI 2 - Emergent</option>
                <option value="ESI_3">ESI 3 - Urgent</option>
                <option value="ESI_4">ESI 4 - Less Urgent</option>
                <option value="ESI_5">ESI 5 - Non-Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Target Care Ward</label>
              <select
                value={triageForm.targetTier}
                onChange={(e) => setTriageForm({ ...triageForm, targetTier: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="ICU">Intensive Care Unit (ICU)</option>
                <option value="GENERAL">General Ward</option>
                <option value="STEP_DOWN">Step-Down Unit</option>
                <option value="ISOLATION">Isolation Ward</option>
              </select>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={triageForm.requiresVentilator}
                  onChange={(e) => setTriageForm({ ...triageForm, requiresVentilator: e.target.checked })}
                  className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-0"
                />
                <span>Requires Ventilator Hookup</span>
              </label>
              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={triageForm.requiresIsolation}
                  onChange={(e) => setTriageForm({ ...triageForm, requiresIsolation: e.target.checked })}
                  className="rounded border-slate-800 text-cyan-500 bg-slate-950 focus:ring-0"
                />
                <span>Negative Pressure Room</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white font-medium py-2 rounded transition flex items-center justify-center space-x-2 mt-4"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Run Deterministic Allocation</span>
                </>
              )}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
