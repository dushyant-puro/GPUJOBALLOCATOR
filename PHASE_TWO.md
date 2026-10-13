# Phase 2: virtual-time workload replay

Implemented 12 October 2026. The existing manual workspace remains available; the new **Replay Lab** uses independent simulation sessions with automatic job completion.

## Use the Replay Lab

1. Start the backend and frontend using the root README, then select Replay Lab in the sidebar.
2. Choose a preset, policy and seed. Mixed arrivals and burst traffic support an editable job count. Create the run.
3. Use Next event to inspect one timestamp at a time, +5 seconds to advance a fixed amount, or Play/Pause and Speed for continuous playback.
4. Click a job's timeline row to inspect its latest allocation decision, execution progress and accumulated waiting.
5. Reset starts the identical trace and policy at zero again. Open scenario switches between retained sessions; the delete button removes the selected session.

Built-in scenarios:

| Preset | Behavior |
| --- | --- |
| Mixed arrivals | Seeded resource requests; one arrival every two seconds; seeded 5–25 second execution durations |
| Burst traffic | The same seeded demand/duration generation with all arrivals at zero |
| Urgent interruption | Three 20-second full-GPU jobs, then a high-priority four-second job at time five; selecting this preset chooses PREEMPTIVE by default |
| Impossible request | Three feasible jobs finish while a job requesting more compute than any GPU owns remains infeasible |

Custom JSON traces are available in the UI and API. Every job needs a name, compute/memory demand, nonnegative arrival time and positive execution duration. Optional accelerators default to zero and priority defaults to one.

```json
[
  {
    "name": "Training",
    "compute_required": 8,
    "memory_required": 16,
    "priority": 1,
    "arrival_seconds": 0,
    "duration_seconds": 20
  },
  {
    "name": "Evaluation",
    "compute_required": 2,
    "memory_required": 4,
    "priority": 5,
    "arrival_seconds": 5,
    "duration_seconds": 6
  }
]
```

## Event and timing semantics

- Every run owns a fresh Phase 1 Simulation, a virtual clock, the exact input trace and its event history. It never references the legacy `/jobs` simulation or another run's cluster.
- The clock starts at zero with a fixed internal UTC epoch of 1 January 2000. These timestamps are simulation coordinates, not real execution dates. Arrival coordinates and durations are normalized to microsecond precision; visible duration labels are rounded for display.
- At a timestamp, all due completions release resources first. All arrivals at that timestamp then enter the queue together in trace order. The scheduler dispatches once after that batch, so priority and SJF can rank simultaneous arrivals fairly.
- Next event advances to the earliest future arrival or running-job completion. Advancing a large interval processes every intermediate event rather than skipping jobs.
- Execution consumes duration only while RUNNING. Interrupted jobs retain completed work, wait without consuming execution duration, and resume with their remaining runtime. No checkpoint or recovery overhead is modeled yet.
- SJF uses remaining execution duration when every ranked job supplies a duration, as replay jobs do. Untimed manual jobs preserve Phase 1's normalized resource-demand fallback.
- Play maps elapsed monotonic wall-clock time to virtual seconds using the selected speed. Reads and controls synchronize the event engine to that target. It catches up on the next request if the browser was closed or polling stopped; there is no separate background worker. Paused runs do not advance on reads.
- COMPLETED freezes at the final completion timestamp. STALLED means no future arrival or running completion can unblock the remaining jobs. Reset is required to restart a terminal run.
- Reset keeps the run ID, trace, policy and playback speed, recreating its clock, jobs, cluster and history. Repeated deterministic runs produce the same job placements, event ordering, decision records and simulated completion times.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/replay/presets` | Presets and supported policy identifiers |
| POST | `/replay/runs` | Create an isolated run from a preset or explicit `jobs` array |
| GET | `/replay/runs` | Session inventory and limits |
| GET | `/replay/runs/{run_id}` | Synchronize playback and return a snapshot |
| POST | `/replay/runs/{run_id}/control` | `play`, `pause`, `step`, `advance`, `reset`, or `speed` |
| GET | `/replay/runs/{run_id}/events?offset=0&limit=200` | Paginated chronological event history |
| DELETE | `/replay/runs/{run_id}` | Remove an in-memory session |

Create example: `{"preset":"PREEMPTION","policy":"PREEMPTIVE","seed":42,"name":"Urgent demo"}`.

Control examples: `{"action":"advance","seconds":5}`, `{"action":"speed","speed":5}`, `{"action":"step"}`. Stepping or advancing requires paused playback. Requests with malformed traces or out-of-range values are rejected before mutation.

Snapshots include arrived jobs, scheduled future jobs, running/waiting intervals for the timeline, the current resources, last decisions, the exact trace, and summary metrics. They return the latest 200 events and the full event count; paginated history retrieves older events. The UI displays the latest 30.

## Validation

All 39 backend/API regression tests pass, including the 21 Phase 1 checks. Replay checks cover automatic completion, queue release, simultaneous-arrival ranking, completion-before-arrival ordering, actual SJF runtime ranking, preemption progress, exact reset determinism, different advance chunk sizes, play/pause/speed and idle catch-up, invalid controls, fractional timestamps, future first arrivals, infeasible termination, session isolation, concurrent stepping, event pagination and the replay size limit.

Every policy drains the same seeded 30-job mixed trace in the regression suite. A 200-job burst completed all jobs and passed resource conservation in a manual probe (approximately 4.3 seconds of host processing in this environment). This is a sanity check, not a statistical performance evaluation.

The frontend production build passes. Source lint passes with the same four pre-existing dashboard warnings. Browser checks verified scenario creation, event stepping at five and nine seconds, the interrupted/resumed job's timing and decision inspector, and live play/pause. The light-theme timeline was visually checked and CSS inheritance issues were corrected. A preview is saved as `replay-lab-preview.jpg`.

## Limits and next stage

There are at most 20 retained in-memory sessions and 200 jobs per replay session. Delete runs to reclaim capacity. Sessions disappear on server restart, require one backend worker, and have no multi-user access controls or persistence. GPU capacity remains three identical abstract devices. Running time comes from the input trace rather than an ML runtime predictor or physical hardware.

Next: a reproducible benchmark runner that feeds identical traces to policies, records time-weighted metrics and tail waiting times, and exports configurations, results and decision evidence as JSON/CSV. That stage will also define experiment storage and a strategy for larger evaluation runs.
