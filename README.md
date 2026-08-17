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

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/units` | Create a clinical unit / ward |
| `POST` | `/api/v1/beds` | Register a bed with specific capabilities |
| `POST` | `/api/v1/patients` | Ingest an ER patient with triage acuity rating |
| `POST` | `/api/v1/allocations/request` | Submit bed allocation ticket and run matching algorithm |
| `POST` | `/api/v1/beds/{id}/status` | Mutate bed state (broadcasts via WebSocket) |
| `WS` | `/ws/live-floor-feed` | Bi-directional WebSocket stream for live floor updates |

---

## Local Setup

### 1. Clone & Run with Docker Compose
```bash
git clone [https://github.com/Parth04Dalvi/BedFlow-Orchestrator.git](https://github.com/Parth04Dalvi/BedFlow-Orchestrator.git)
cd BedFlow-Orchestrator
docker compose up --build -d
