# GPU Job Allocator

A local GPU resource-allocation simulator with a React dashboard and FastAPI backend. GPU capacities and displayed hardware telemetry are simulated. The manual workspace supports completion through the dashboard/API; the Replay Lab automatically completes timed jobs using a virtual clock.

## Run locally

For the hackathon presentation, double-click **start-demo.cmd** and open **http://127.0.0.1:8000/studio/**. Run **prepare-demo.cmd** to regenerate evidence, verify, and rebuild; use `-Install` on a fresh machine while online. The production studio runs with the local API on one port, without Vite or venue internet. See [the rehearsal guide](HACKATHON_READY.md) for the three-minute demo and judge questions.

In a terminal opened at this project directory:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

In a second terminal at the project directory:

```powershell
cd frontend
npm ci
npm run dev
```

Open the frontend URL printed by Vite, normally `http://localhost:5173`. API documentation is at `http://127.0.0.1:8000/docs`.

Use one backend worker. Manual workspace and replay states are in memory and reset on restart. Policy Arena studies are persisted in `backend/data/benchmarks.sqlite3`. Distributed coordination is later work.

## Verify changes

The **Challenge lab** implements the five Kernel Ops OSH018 options with isolated, step-by-step state changes and exportable evidence. See [challenge readiness](CHALLENGE_READINESS.md) for the exact outcomes and assumptions, including the C3 placement trade-off and C4 reservation recovery model.

From `backend`:

```powershell
python -B -m unittest discover -s tests -v
```

From `frontend`:

```powershell
npm run lint
npm run build
```

Core tests use an injected clock to check timing without sleeps. API tests use the development HTTP client dependency. The installed Starlette version emits a deprecation warning for this client; the tests pass.

## Phase 1 baseline

See [PHASE_ONE.md](PHASE_ONE.md) for implemented fixes, metric definitions, validation and remaining limitations. [PROJECT_AUDIT_AND_ROADMAP.md](PROJECT_AUDIT_AND_ROADMAP.md) preserves the original pre-change audit and the broader roadmap.

## Phase 2 replay

Open Replay Lab in the sidebar to create an isolated seeded scenario, play/pause, step through events, change playback speed, inspect a job's timeline, or reset the same trace. Custom JSON traces supply arrival times and execution durations. See [PHASE_TWO.md](PHASE_TWO.md) for event semantics, API examples and limits.

## Phase 3 policy comparison

Open Policy Arena to compare multiple policies on identical workloads, view time-weighted utilization and waiting-time trade-offs, and export saved JSON/CSV results. See [PHASE_THREE.md](PHASE_THREE.md) for metrics, persistence, API and CLI reproduction examples.
