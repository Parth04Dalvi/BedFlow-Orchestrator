# BedFlow-Orchestrator 🏥⚡
> Real-time, event-driven hospital bed allocation engine and critical asset coordination platform.

![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat&logo=FastAPI&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-316192.svg?style=flat&logo=PostgreSQL&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7.2-DC382D.svg?style=flat&logo=Redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED.svg?style=flat&logo=Docker&logoColor=white)

## Overview
During clinical surge events and emergency department bottlenecks, uncoordinated bed management and slow sanitization turnaround cause ICU boarding delays. **BedFlow-Orchestrator** is an asset allocation and priority matching backend designed to optimize patient-to-bed placement using deterministic constraint solving, pessimistic concurrency control, and real-time WebSocket telemetry.

---

## Key Features
* **Pessimistic Concurrency Bed Locking:** Uses PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` to prevent duplicate bed reservations across concurrent ER triage updates.
* **Acuity-Weighted Priority Matcher:** Dynamically scores incoming ER requests using multi-factor constraint weighting:
  $$\text{Score} = \text{ESI\_Weight} + (\text{Wait\_Time}_{\text{min}} \times 3.5) + \text{Asset\_Constraints}$$
* **Sub-50ms Real-Time Sync:** Redis Pub/Sub backplane connected with asynchronous WebSocket workers to broadcast live bed state transitions.
* **Turnover Audit Telemetry:** Tracks transition lifecycles (`AVAILABLE` ➔ `RESERVED` ➔ `OCCUPIED` ➔ `CLEANING_IN_PROGRESS`) with automated audit log ingestion.

---

## Tech Stack
* **Backend:** Python 3.11, FastAPI, SQLAlchemy 2.0 (AsyncIO), Pydantic v2
* **Data & Cache Layer:** PostgreSQL 16 (ACID state records), Redis 7 (Pub/Sub & state cache)
* **Testing & Containerization:** Pytest, AsyncIO-Pytest, Docker, Docker Compose

---

## Local Setup

> Real-time, event-driven clinical asset coordination engine and dynamic hospital bed allocation system.

![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat&logo=FastAPI&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-316192.svg?style=flat&logo=PostgreSQL&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7.2-DC382D.svg?style=flat&logo=Redis&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB.svg?style=flat&logo=React&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg?style=flat&logo=Docker&logoColor=white)

---

1. System Architecture

```text
                      [ Emergency Triage / Ward Console (React) ]
                                      │             ▲
                      POST /allocations/request    WebSocket Live Feed
                                      │             │
                                      ▼             │
                      ┌─────────────────────────────┴────────┐
                      │        FastAPI Async Gateway         │
                      │   - OpenAPI 3.0 Endpoints            │
                      │   - Pydantic v2 Request Validation   │
                      └───────────────┬──────────────────────┘
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
             ┌─────────────────────────┐ ┌─────────────────────────┐
             │  PostgreSQL 16 Engine   │ │     Redis 7 Broker      │
             │ - Row Locking (ACID)    │ │ - Pub/Sub Event Channel │
             │ - Status State Machine  │ │ - Real-Time Telemetry   │
             │ - Audit Transition Log  │ │ - Ephemeral Queue Sync  │
             └─────────────────────────┘ └─────────────────────────┘
2. Core Engineering Highlights Pessimistic Concurrency Bed Locking: Uses PostgreSQL SELECT ... FOR UPDATE SKIP LOCKED during matching transactions to eliminate race conditions and avoid double-allocating critical assets across high-concurrency ER surges.Deterministic Multi-Factor Scoring: Prioritizes placement dynamically using Emergency Severity Index (ESI) weights, elapsed wait time multipliers, and hardware constraints (ventilators, negative pressure isolation):$$\text{Score} = \text{ESI\_Base\_Weight} + (\text{Wait\_Time}_{\text{min}} \times 3.5) + \text{Asset\_Factors}$$Sub-50ms Reactive Telemetry: Powered by Redis Pub/Sub multiplexed into asynchronous WebSocket listeners, broadcasting room mutations (AVAILABLE $\to$ RESERVED $\to$ OCCUPIED $\to$ CLEANING_IN_PROGRESS) instantaneously to clinical dashboards.3. Directory LayoutPlaintext.
├── .gitignore
├── docker-compose.yml
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── hospital.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   └── hospital.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   └── matcher.py
│   │   └── api/
│   │       ├── __init__.py
│   │       ├── routes.py
│   │       └── websocket.py
│   └── tests/
│       ├── __init__.py
│       └── test_matcher.py
└── frontend/
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js
        └── App.js
        
4. Quickstart Guide (Docker Compose)PrerequisitesDocker Engine 24.0+ & Docker Compose v2.20+Node.js 18+ (for local frontend development)Step 1: Clone RepositoryBashgit clone [https://github.com/Parth04Dalvi/BedFlow-Orchestrator.git](https://github.com/Parth04Dalvi/BedFlow-Orchestrator.git)
cd BedFlow-Orchestrator
Step 2: Spin Up Backend ServicesBashdocker compose up --build -d
Step 3: Seed Sample Hospital DataBashdocker compose exec backend python -c "import asyncio; from app.core.database import AsyncSessionLocal; from app.models.hospital import Unit, Bed, CareTier; async def seed(): async with AsyncSessionLocal() as session: unit = Unit(name='ICU North', wing='A', floor=3, tier=CareTier.ICU); session.add(unit); await session.flush(); bed1 = Bed(unit_id=unit.id, room_number='ICU-101', bed_identifier='B1', has_ventilator=True); bed2 = Bed(unit_id=unit.id, room_number='ICU-102', bed_identifier='B2', has_ventilator=False); session.add_all([bed1, bed2]); await session.commit(); print('Database seeded successfully!'); asyncio.run(seed())"
Step 4: Run the FrontendBashcd frontend
npm install
npm start
5. Endpoints ReferenceInterfaceURLDetailsFrontend Consolehttp://localhost:3000Real-time triage intake & interactive floor layoutInteractive Swagger UIhttp://localhost:8000/docsOpenAPI testbed for all REST endpointsWebSocket Feedws://localhost:8000/ws/live-floor-feedBi-directional streaming event channel6. Testing & CI/CD ValidationRun the asynchronous unit and integration test suite inside the backend container:Bashdocker compose exec backend pytest -v tests/

# Clinical Use Cases & Production Scenarios 🏥⚡

This document outlines real-world production environments and failure modes addressed by the **BedFlow-Orchestrator** system architecture.

---

## Primary Scenario: Mass-Casualty Incident (MCI) & Surge Triage

### 1. The Operational Bottleneck
During unexpected surge events (e.g., regional multi-vehicle collisions, industrial accidents, natural disasters), Level-1 Trauma Centers experience sudden, non-linear admission spikes. 

* **Legacy Failure Mode:** Charge nurses and triage directors coordinate bed availability across departments via manual phone calls, whiteboards, or batched EHR updates.
* **Impact:** 
  * High-acuity patients endure dangerous **ED Boarding Times** (holding ICU-bound patients in emergency bays).
  * **Double-booking collisions:** Multiple ER units attempt to route patients to the same recently vacated trauma bay.
  * **Hardware Mismatch:** ESI-1 patients requiring mechanical ventilation or dialysis hookups are assigned to generic telemetry beds, forcing costly internal transfers.

---

## 2. BedFlow Orchestration Lifecycle

```text
[ Incoming Surge: 20 Patients / 10 Mins ]
                   │
                   ▼
       [ Fast Triage Intake ]
   (ESI Acuity + Hardware Constraints)
                   │
                   ▼
┌───────────────────────────────────────────────┐
│     Deterministic Multi-Factor Scoring        │
│  Score = ESI_Weight + (Wait_Time × 3.5) + HW  │
└──────────────────────┬────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────┐
│       Pessimistic Concurrency Lock            │
│    SELECT ... FOR UPDATE SKIP LOCKED          │
│       (Atomically Claims Bed)                 │
└──────────────────────┬────────────────────────┘
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
[ Redis Pub/Sub ]              [ Ticket Assigned ]
       │                               │
       ▼                               ▼
[ WebSocket Broadcast ]       [ Patient Route to Ward ]
 (Console updates < 50ms)

