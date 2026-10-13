# GPU Job Allocator: code audit and product roadmap

Audited on 12 October 2026 against the extracted source and the supplied ChatGPT context. This is an assessment and implementation proposal; application code has not been changed.

## Recommended product direction

Build an **explainable GPU scheduling lab** for students, researchers, and small ML platform teams. Its central workflow should be: load a cluster and workload, replay it under multiple policies, inspect the decisions, and export evidence of the trade-offs.

The current implementation is a resource-allocation simulator with a dashboard. It does not execute ML jobs or manage physical GPU hardware. A production cluster controller is a possible later direction, with substantially different operational requirements.

The strongest demonstration would show the same workload running side by side under the existing baseline and a new policy. A large waiting job gets capacity sooner, the dashboard explains which small-job placement preserved that capacity, and the report measures the result and any cost.

## What is actually present

| Capability | Evidence | Assessment |
| --- | --- | --- |
| React dashboard and FastAPI API | `frontend/src/components/Dashboard.jsx`, `backend/app/main.py` | Present; frontend runtime and visual quality were not verified in this audit. |
| Three-GPU allocation | `algorithms/gpu_selection.py`, `services/simulation.py` | Three identical GPUs, each with 8 compute units, 16 memory units, accelerator A=4 and B=2. Simulation hardcodes the count. |
| Resource validation and release | `algorithms/allocation.py` | Per-GPU feasibility and resource bookkeeping are present. Release clamps values, which can hide double-release defects. |
| Job lifecycle | `models/job.py`, `api/jobs.py` | Submit, wait, start, complete and cancel exist. Completion is manual. No work duration or automatic execution engine. |
| Six policy names | `Simulation.SUPPORTED_POLICIES` | FCFS, PRIORITY, SJF, RESOURCE_EFFICIENT, RESOURCE_BALANCED, PREEMPTIVE. These largely vary waiting-queue ordering; GPU placement uses the shared score. |
| Candidate GPU scoring | `GPUResourceManager.get_allocation_score` | Evaluates copied local availability without mutating live resources. Weighted balance, spread change and resource efficiency exist already. |
| Preemption | `Simulation.try_preempt_for_job` | Interrupts a selected victim and tries again; restores it if placement fails. No checkpoint, recovery delay or lost-work model. |
| Explanations | `Simulation.get_job_allocation_explanation` | Panels and candidate scores exist, but historical decision fidelity is broken. |
| Workload generator | `services/workload_generator.py` | Local seeded random generator and multiple demand patterns exist. |
| Stress runner | `services/stress_testing.py` | Submits batches to the shared live simulation and measures submission processing. It is not a complete scheduling benchmark. |
| Analytics | `get_historical_analytics`, `api/analytics.py` | Current utilization, custom balance/efficiency, counts and wall-clock timing exist. No controlled comparative evaluation. |
| Telemetry display | Dashboard telemetry helper | Temperature, power and clocks are generated formulas. The UI already exposes `SIMULATED`; preserve this label. |
| Deadlock implementation | `algorithms/deadlock.py` | A graph cycle utility exists, but the simulation calls a missing method and suppresses the error. |

No application persistence, authentication, experiment export, automated test suite, CI workflow, container setup, hardware executor, tenant quotas, or multi-GPU job placement was found in the inspected source. Database packages in requirements do not establish database functionality.

## Gaps to fix before adding intelligence

### 1. Store real decision records

`get_job_allocation_explanation` recalculates candidates from current resources on every read. After allocation, the chosen GPU has already lost capacity, so it may appear ineligible. It also reports the current policy rather than necessarily the policy used at allocation. Completion clears the GPU ID and then the explanation reports WAITING.

Fix: record the decision before committing allocation. Include decision ID, simulation time, job state, policy/configuration, cluster state version, each candidate's eligibility and blocking resources, score components, tie-break rule, selected GPU and action. Keep later current-state diagnostics separate. Completed and cancelled jobs need explicit terminal-state explanations.

Acceptance: later allocations and policy changes cannot rewrite a historical reason; the selected candidate reproduces the recorded winner.

### 2. Introduce execution intervals and simulated time

The job model retains only the first start and first waiting timestamps. Execution duration includes time spent waiting after preemption. Additional waiting intervals are not accumulated. Cancelling a never-started job does not stop `get_queue_wait_seconds` from using the current clock. Completion/cancellation history loses GPU identity because it is cleared before history is recorded.

Fix: inject a simulation clock; track each running and waiting interval, accumulated progress, remaining duration, interruption costs and terminal timestamps. Preserve placement history independently from the current GPU assignment.

Acceptance: total elapsed time equals the documented sum of running, waiting and recovery intervals; terminal metrics stop increasing; resumed jobs retain their previous progress.

### 3. Repair or replace the deadlock feature

The detector implements `has_cycle`, but Simulation calls `detect_deadlock`. Its catch-all exception handler converts this failure into a SAFE response. No wait-for graph is built.

This model allocates all requested resources at once and has no dependency graph or incremental acquisition. Ordinary lack of capacity should be reported as blocked or infeasible, not labelled a classical deadlock. Add true cycle detection only if the model gains dependencies or hold-and-wait resource acquisition.

Acceptance: unsupported detection cannot report an authoritative SAFE result; impossible requests and temporarily blocked jobs have distinct states/reasons.

### 4. Correct the meaning of fragmentation

The existing overall fragmentation is the maximum minus minimum utilization across resource types. It measures resource imbalance. Aggregating free capacity across GPUs also loses information about where those resources reside.

Keep the old metric as **resource utilization imbalance**. Add a demand-aware capacity metric: for each queued request or sampled workload template, test whether it fits anywhere; evaluate how candidate placement changes the weighted feasible demand. Report per-GPU bottlenecks and cluster-wide free-but-unusable capacity under a specified demand distribution.

Acceptance: a cluster with enough aggregate resources but no feasible individual GPU is detected. Publish the formula and demand weights. Do not call this the FGD paper's metric unless its definition is actually reproduced.

### 5. Clarify policy semantics and queue dispatch

SJF currently sorts by the sum of compute, memory and accelerator requests, not execution duration. That sum mixes resource dimensions. Rename it smallest-resource-demand-first or supply meaningful durations and implement actual SJF. Normalize resource dimensions before combining them.

New arrivals attempt immediate placement rather than entering a unified queue dispatcher. Existing waiting work can therefore be bypassed by a new feasible arrival. FCFS retrying skips infeasible earlier jobs and permits later jobs to run; document this as backfilling, or provide a strict FCFS option.

The score's balance and fragmentation terms both depend on utilization spread, so their contributions overlap. Audit normalization, units and tie-breaks. Treat queue policy and GPU placement policy as separate configuration dimensions when comparing algorithms.

Acceptance: queue order and placement behavior are explicit; baselines have documented semantics; arrivals, releases and policy changes all dispatch through one controlled scheduling path.

### 6. Make mutation safe and results durable

All API clients share one in-memory Simulation. Synchronous FastAPI routes have no visible mutation lock; job ID generation, selection and allocation need an atomic boundary. Multiple server workers would have separate simulations. Restart loses state. Stress tests mutate the dashboard's live workload.

Fix: isolated simulation/experiment sessions; one serialized writer or atomic transaction boundary; one job ID mechanism; versioned snapshots; durable experiment runs and decision events. Start with SQLite for local persisted runs; add a service database when deployment needs warrant it.

Document allocation success carefully: successful allocations include queue retries, while allocation_attempts increments only in initial `try_allocate_job`. Choose either a per-job eventual allocation rate or a consistently counted per-attempt rate. Report cancelled and completed jobs separately.

Acceptance: concurrent submission cannot duplicate IDs or over-allocate; experiments never alter another session; saved runs survive restart.

## Reproducible observations from this audit

Small Python probes ran directly against the application classes, without installing dependencies or changing application files:

| Probe | Observed outcome |
| --- | --- |
| Allocate a job requesting all compute and memory on one GPU, then ask for its explanation | Chosen GPU-0 is listed as ineligible; GPU-1 and GPU-2 are eligible. |
| Complete that job and inspect explanation/history | Job status is COMPLETED, explanation decision is WAITING, completed history GPU ID is null. |
| Submit a request of compute=9, memory=17 | It stays WAITING even though every GPU's total capacity is smaller; deadlock status is SAFE. |
| Check the detector interface | `detect_deadlock` is absent. |
| Run 100 MIXED jobs with seed 42 on a fresh simulation | 9 running, 91 waiting, 0 completed. This demonstrates submission, not a finish-time benchmark. |
| Construct a previously running job now preempted for 30 seconds | Waiting duration reports 0; execution duration includes the interruption. |
| Construct split free resources with identical aggregate availability fractions | Overall fragmentation is 0, but a request needing compute and memory together fits nowhere. |
| Import FastAPI application | Successful in the available Python environment. |

The split-capacity and timing cases are constructed diagnostic states. These are targeted observations, not a full correctness, browser, security or scalability test. Frontend dependencies are not installed in the extracted frontend directory; no frontend build was run.

## Upgrades that make this a distinctive product

### A. Workload replay and scheduling timeline — first flagship feature

- Jobs include arrival time, requested resources and duration.
- Play, pause, single-step, speed control and reset using discrete simulation time.
- Timeline shows waiting, running, preempted and completed intervals.
- Save scenario presets: large job starves, memory bottleneck, burst traffic, accelerator mismatch, priority inversion and heterogeneous GPUs.
- Record every scheduling event so a saved run can be replayed.

Value: an observer can understand cause and effect, rather than manually completing jobs and inferring behavior from counters.

### B. Policy arena — second flagship feature

- Replay the exact same arrival trace on a fresh copy of the same cluster under each policy.
- Compare time-weighted resource utilization, completed jobs per simulated time, mean/p95 wait, slowdown, makespan, starvation threshold exceedance and interruption overhead.
- Show scheduling computation time separately from workload completion time.
- Export traces, configuration, seeds, source version, decision records and metric definitions as JSON/CSV.
- Support repeated paired seeds and confidence intervals. Include unfinished jobs in timeout/censoring reporting so a policy cannot look good by leaving difficult jobs waiting.

Value: measurable differences and reproducible reports become the product's evidence.

### C. Decision inspector and what-if placement

- Select a decision to see the exact pre-decision resources and all alternatives.
- Show resource deficits for rejected GPUs and normalized score components for feasible GPUs.
- Preview another placement and list which waiting jobs gain or lose feasibility.
- Fork a saved scenario from a chosen state to compare later consequences.

An immediate hypothetical placement preview and a full replay of the alternative future are different capabilities. Label them accordingly; predictions are not observed outcomes.

### D. CAPE-style scheduler — implement after A and B

Use the supplied roadmap as a hypothesis, not a proven novelty claim:

1. Rank waiting jobs using priority, age and an explicit reservation/protection rule.
2. Generate feasible placements against copied state.
3. Estimate lost weighted queue feasibility after each placement.
4. Preserve capacity for an old feasible large job where appropriate; allow safe backfilling.
5. Consider preemption only after evaluating victim resource sufficiency and modeled checkpoint/recovery costs.
6. Commit one selected action and store the full decision record.

Two corrections to the supplied formula matter: adding an age term constant across GPU candidates cannot change which GPU wins for a fixed job; aging belongs in job ranking or a joint job-placement objective. Bounded aging alone does not guarantee starvation freedom. Reservations/protected service require explicit assumptions about job feasibility, durations and offered load.

Candidate feasibility is not a guarantee that all those queued jobs can fit simultaneously. Begin with a documented heuristic; do not imply an optimal packing solution.

Use ablations to disable queue feasibility penalties, aging/protection and preemption costs separately. Record where the new policy loses as well as wins.

### E. Cluster builder and team constraints

Add editable GPU count, per-GPU memory/compute, accelerator capabilities and availability. Use normalized units and label modeled hardware assumptions. Then add tenant quotas, workload classes, deadline targets and fairness metrics. Reserve multi-GPU gang scheduling and topology modeling for a later phase because the current placement model is one job on one GPU.

Value: scenarios become representative of different labs and teams rather than a fixed three-GPU toy cluster.

### F. Product foundations and optional hardware bridge

Split the 5,590-line Dashboard into cluster, jobs, timeline, experiments, explanations and workload components, with shared data hooks. Configure API URL via environment; handle partial fetch failures without reporting every API error as a disconnected backend. Consolidate dependency ownership, add a root setup guide, meaningful correctness tests and CI. Add authentication/roles when shared deployment is introduced.

Later, implement a telemetry adapter and one execution target behind a clean interface. Hardware metrics alone do not execute jobs. Real execution also requires worker lifecycle, artifact/log capture, failure handling, cancellation and supported checkpoint behavior. Integrate with existing cluster tools rather than immediately replacing an entire orchestration stack.

## Recommended implementation order

| Stage | Deliverable | Exit condition |
| --- | --- | --- |
| 1. Trustworthy core | Decision snapshots, lifecycle intervals, honest metric names, blocked/infeasible diagnostics, serialized mutation | Resource conservation, release exactly once, stable terminal metrics and historical explanations verified. |
| 2. Simulation engine | Virtual clock, arrivals/durations, automatic completion, pause/step/reset, isolated runs | A seeded trace produces the same event order and simulated-time outcomes on replay. |
| 3. Benchmark runner | Identical traces, explicit baseline queue and placement semantics, CSV/JSON export | One command compares multiple policies on fresh state and exports reproducible results. |
| 4. New scheduler | Queue-aware counterfactual placement, protection and cost-aware preemption | Repeated comparisons and ablations demonstrate the stated trade-off; no universal winning claim required. |
| 5. Product experience | Timeline, policy arena, decision inspector, cluster editor and saved presets | A user completes the demo scenario and exports its evidence without editing source. |
| 6. Shared/real use | Persistence, roles, quotas, adapter and worker execution | Recovery and isolation are verified for the selected deployment target. |

This order is dependency driven. Build only the UI needed to expose each stage; avoid a dashboard rewrite before the simulation results are reliable. Calendar estimates should follow implementation scoping rather than inherit the pasted roadmap's optimistic day counts.

## Defer or omit for now

- Generic chatbot: decision records and filtering offer more immediate value. A later assistant can query stored evidence.
- Reinforcement learning: no benchmark currently establishes why simpler methods are inadequate.
- Extra policy names: correctly defining and comparing existing policies is more useful.
- Classical deadlock claims without dependencies or hold-and-wait behavior.
- Cloud provisioning, billing and Kubernetes operator work before the local lab workflow is validated.
- Unmeasured energy savings, runtime ETA accuracy or claims of universal optimality.
- Full hardware-specific partition simulation before selecting a realistic device model and supported capabilities.

## Research and ecosystem context

Fragmentation-aware scheduling already has prior art. [FGD, USENIX ATC 2023](https://www.usenix.org/conference/atc23/presentation/weng) defines a fragmentation measure and evaluates a placement approach on production traces. The existing utilization-spread heuristic should not be presented as equivalent to that research metric.

[Kueue concepts](https://kueue.sigs.k8s.io/docs/concepts/) and [preemption documentation](https://kueue.sigs.k8s.io/v0.20/docs/concepts/preemption/) provide useful reference points for quota, workload admission and fair-sharing/preemption behavior. Queue ordering, admission and actual device placement are different responsibilities.

The suggested product positioning—reproducible comparison plus faithful decision inspection—is a recommendation based on this audit, not validated customer demand or a claim that no competing product exists. The research contribution needs a focused related-work review and experiments beyond this short source check.
