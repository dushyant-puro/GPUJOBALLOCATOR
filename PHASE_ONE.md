# Phase 1: trustworthy simulator baseline

Implemented 12 October 2026. This document supersedes the pre-change status in the original project audit.

## Implemented behavior

- Allocation records preserve the evaluated resources, policy, candidate eligibility, per-resource deficits, score components, weights, deterministic tie-break, scoring version and cluster version. Later resource changes cannot rewrite these records. Returned records are copies.
- `GET /jobs/{job_id}/decisions` exposes the job's decision history. Completed/cancelled explanations report their terminal outcome and include the most recent allocation snapshot separately.
- Jobs accumulate QUEUED, WAITING and RUNNING intervals using an injectable UTC clock. Preemption stops execution accounting and starts a new waiting interval. Completion and cancellation freeze every duration. Placement history preserves GPU identity and each placement's start/end.
- A resource ownership ledger makes release happen once. Resource managers validate an entire release before modifying it and reject excessive releases instead of clamping them. Invalid lifecycle transitions and duplicate allocation attempts are rejected.
- A preemption victim must actually free enough resources on its GPU before it is interrupted. Impossible requests cannot preempt running work. This remains single-victim preemption without checkpoint/recovery costs.
- New submissions enter a common queue dispatcher. Manual, generated and stress jobs share one ID allocator. FCFS keeps queue order with feasible-job backfilling. Legacy SJF orders normalized resource demand, and its dashboard label states that explicitly.
- A shared reentrant lock serializes simulation operations and complete API operations, including validation, mutation and response snapshots. This protects the one-process simulator; it is not distributed locking.
- Queue diagnostics distinguish temporarily occupied resources from requests exceeding every GPU's total capacity. Infeasible jobs remain in the existing WAITING lifecycle for API compatibility; their explanation is INFEASIBLE and lists total-capacity deficits. Cancellation remains available.
- Dependency deadlock detection explicitly returns `supported: false`, `deadlock_detected: null`, and `status: NOT_APPLICABLE`. The model has no dependencies or incremental resource acquisition. The dashboard shows resource diagnostics rather than a false SAFE claim.
- Failed queue placements are retried after resource availability or policy changes, rather than on every unchanged refresh. Equivalent failed decisions are not appended repeatedly. This avoids accumulating redundant snapshots during large batches.
- Stress responses explicitly say `test_type: submission_batch` and `completes_jobs: false`. These runs still add jobs to the live simulator. They are not isolated finish-time benchmarks.
- Frontend labels distinguish resource imbalance and a heuristic utilization score. Waiting blockers use per-GPU deficits instead of aggregate cluster availability. Terminal jobs display a final outcome rather than “Why waiting?”.

## Baseline scoring and metric definitions

The allocation score keeps its 40/35/25 weights:

1. Balance = `100 - post-placement resource utilization spread`.
2. Imbalance change = `clamp(50 + imbalance_before - imbalance_after, 0, 100)`.
3. Footprint = `100 * mean(requested_resource / resource_capacity)` across positive-capacity resource dimensions.

Score = `0.40 * balance + 0.35 * imbalance_change + 0.25 * footprint`, rounded to two decimals. Highest score wins; ascending GPU ID resolves a tie. The footprint replaces addition of unlike resource units. Records identify this revised baseline as `normalized-footprint-v2`; numerical scores can therefore differ from the original project.

Balance and imbalance change remain related heuristics, not independent evidence or an optimal placement objective. Queue-aware counterfactual feasibility is later algorithm work.

| Metric | Definition |
| --- | --- |
| Resource utilization | `100 * (capacity - available) / capacity` for each resource dimension |
| Resource imbalance | Maximum minus minimum resource utilization percentage |
| Per-resource deviation | Absolute difference from mean resource utilization |
| Utilization score | `clamp(mean utilization - 0.5 * imbalance, 0, 100)`; a project heuristic |
| Allocation success rate | Successful placements / all actual placement attempts, including retries and resumed placements |
| Initial queue wait | Submission to first start, or to cancellation if never started |
| Accumulated waiting | Sum of QUEUED and WAITING intervals, including interrupted periods |
| Execution duration | Sum of RUNNING intervals only |
| Historical average waiting/execution/total | Means across completed jobs; cancelled jobs are counted separately |
| Current throughput | Completed jobs per elapsed wall-clock minute/hour since the simulator started |

API keys such as `overall_fragmentation`, `fragmentation`, and `allocation_efficiency` remain compatibility aliases. `resource_imbalance` is the canonical overall spread field; responses also provide `metric_definitions`. Spread is not demand-aware fragmentation. Current throughput is not a reproducible virtual-time benchmark.

Saved decisions explain the historical action. Waiting jobs additionally return `current_diagnostics`, so current feasibility is not confused with historical eligibility.

## Validation

- 21 automated backend tests cover lifecycle transitions, stable allocation explanations, terminal history, repeated preemption timing, cancellation before first start, release exactly once, atomic invalid releases, blocked/infeasible classification, split capacity, victim sufficiency, placement counters, mixed/generated IDs, API responses, queue ordering and concurrent submissions.
- A seeded mixed-lifecycle test exercises all six policies and checks resource conservation after each submission/completion/cancellation.
- A 60-job submission test uses eight concurrent threads and verifies unique IDs and consistent resource ownership.
- A manual 1,000-job MIXED submission probe with seed 42 completed in approximately two seconds in this environment, retained 1,064 decision records, and passed resource conservation. This is a one-run submission sanity check, not a performance guarantee or completed-workload benchmark.
- Frontend production build passes. Source lint passes with four existing warnings (three unused declarations and one React effect warning). The lint command now targets application source and Vite configuration rather than traversing dependencies and built files.

The backend API test client was run with a less restricted execution boundary because Windows event-loop initialization hangs in the restricted runtime. This does not require an application code workaround.

## Remaining boundaries and next stage

State and decisions are in memory. Runs are not isolated, the cluster still contains three identical GPUs, and there is no physical execution, checkpoint overhead, starvation guarantee or persistent experiment store. Do not mutate GPU managers directly outside the simulator; doing so bypasses resource ownership and invalidates retry caching.

The next stage adds a virtual simulation clock, job arrivals/durations, automatic completion, isolated scenarios and replay controls. Phase 1 supplies clock injection, interval accounting, faithful decision records and resource invariants for that engine.
