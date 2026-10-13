# Phase 3: reproducible policy benchmarking

Implemented 13 October 2026. **Policy Arena** compares scheduling policies on paired workloads, saves the experiment and exports its evidence. This provides the evaluation foundation for the next scheduler contribution.

## Product workflow

1. Open Policy Arena in the sidebar.
2. Choose a preset or supply a custom JSON workload with resource requests, arrival times and runtimes.
3. Select at least two policies, a baseline, and up to five seeds. Evaluation settings control the simulation timeout and starvation threshold.
4. Run comparison. One dedicated worker evaluates fresh independent clusters, while the API reports trial progress.
5. Inspect metric means, completion counts, interactive comparison bars, paired differences and exploratory confidence intervals.
6. Download CSV metrics or JSON evidence. Saved studies survive restarts; Use these settings loads an archived configuration into the form for another run.

The arena compares queue policies using the existing shared `normalized-footprint-v2` GPU placement scorer. FCFS uses feasible-job backfilling; priority ranks queue priority; SJF ranks remaining runtime for these timed workloads; resource-efficient and resource-balanced policies retain their documented queue ordering; PREEMPTIVE can interrupt a suitable victim. These are explicit project baselines, not implementations of every similarly named scheduler in external research.

## Reproducibility and evidence

- Generate the trace once per seed, then pass the exact same trace to every selected policy on a fresh cluster.
- Store each trace and SHA-256, input configuration, backend source fingerprint captured at process import, engine/schema versions, Python/FastAPI/Pydantic versions and fixed cluster capacities.
- Fixed demos and custom workloads can produce the same trace for different seeds. Duplicate traces are collapsed before evaluation. They cannot increase the sample count or manufacture confidence intervals.
- Retain job timestamps, waiting/running intervals, placement history, remaining work, chronological events, all committed scheduling decision snapshots and the final blocking snapshot for unfinished jobs. Repeated failed retries remain in the compact event log; the JSON archive does not duplicate every bulky failed-candidate snapshot.
- Separate host processing milliseconds from simulated completion time. Host timing, creation timestamps and archive IDs are not deterministic outcomes.
- Paired differences are `policy - baseline` for the same seed/trace. Missing metrics stay null. No incomplete makespan is replaced with zero.
- Summary metrics retain mean, sample standard deviation and available sample count. Paired differences retain pair count and an exploratory 95% bootstrap interval using 2,000 deterministic resamples. Intervals are unavailable for a single distinct workload. These intervals do not prove universal superiority or provide a multiple-comparison correction.

## Precisely defined metrics

| Metric | Definition |
| --- | --- |
| Observation time | From zero to final completion/stall, or the configured timeout; the actual per-trial window is saved |
| Resource utilization | `100 * integral(used resource / total capacity dt) / observation time`, for each resource dimension |
| Resource imbalance | Time average of the maximum minus minimum utilization across resource types; this is not demand-aware fragmentation |
| Mean waiting | Mean accumulated QUEUED/WAITING time among completed jobs |
| P95 waiting | Nearest-rank 95th percentile among completed jobs; null with no completions |
| Slowdown | Mean `(completion - arrival) / requested runtime` among completed jobs |
| Throughput | Completed jobs per simulated minute of observation |
| Makespan | Final completion time measured from zero; null for timed-out or stalled workloads |
| Starvation rate | Percentage of feasible arrived jobs whose observed cumulative waiting exceeds the chosen threshold, including unfinished feasible jobs |
| Preemptions | Number of committed interruptions; checkpoint/recovery overhead is currently assumed zero |
| Completion rate | Completed jobs divided by all jobs in the trace, including jobs not yet arrived at timeout |

Utilization integration uses integer resource-microseconds between event boundaries, making results independent of playback polling or advance chunk size. Arrival gaps count as idle time. Infeasible arrivals are reported separately from starvation, and future scheduled jobs are reported separately from arrived jobs.

Wait and slowdown metrics use completed jobs. When trials are incomplete, those statistics can describe different subsets across policies; the UI shows incomplete trial counts and an explicit interpretation note. The fastest-makespan card only considers policies completing every trial. There is no composite winner score.

## API and command line

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/benchmarks/` | Validate and queue a study; returns HTTP 202 and its ID/status |
| GET | `/benchmarks/` | Saved study inventory |
| GET | `/benchmarks/{id}` | Status, progress, configuration and completed summary |
| GET | `/benchmarks/{id}/export/csv` | Per-trial metrics with trace hashes and completion counts |
| GET | `/benchmarks/{id}/export/json` | Configuration, traces, metrics, events, decision evidence and provenance |

Example request:

```json
{
  "name": "Mixed workload comparison",
  "preset": "MIXED",
  "count": 30,
  "seeds": [42, 43, 44],
  "policies": ["FCFS", "PRIORITY", "SJF", "RESOURCE_BALANCED", "PREEMPTIVE"],
  "baseline": "FCFS",
  "horizon_seconds": 10000,
  "starvation_threshold_seconds": 30
}
```

From the backend directory:

```powershell
python -B -m app.benchmark_cli --count 30 --seeds 42 43 44 --policies FCFS PRIORITY SJF RESOURCE_BALANCED PREEMPTIVE --output results/phase-three-reference.json
```

The CLI writes both JSON and CSV. Use `--trace workload.json` to supply a custom array, `--horizon` to change the cutoff, and `--starvation-threshold` to change the wait threshold. The CLI imports request models without starting the API worker or touching the live benchmark database.

Reference artifacts are generated at `backend/results/phase-three-reference.json` and `.csv`. They are local outputs, excluded from Git by default.

## Persistence and execution

Studies are stored in `backend/data/benchmarks.sqlite3`, with lightweight JSON summaries and compressed evidence bundles. The default worker is serial, with up to four running/queued studies and 50 retained studies. Admission is bounded to 200 jobs, five seeds, six policies and at most 3,000 requested job-policy evaluations per study.

Recovery occurs at API startup, rather than on ordinary module imports. Studies interrupted by restart are marked FAILED with their original configuration retained; completed artifacts remain available. Server shutdown drains the worker. Request validation precedes admission, and exports are unavailable until a study succeeds.

The API still requires a single backend worker. Benchmark studies persist; manual workspace and replay sessions remain in memory. There is no authentication, distributed worker pool or hardware executor. Archive management beyond the bounded local store belongs to later product work.

## Validation and observed trade-off

All 53 backend/API tests pass. New checks cover hand-calculated resource utilization, idle gaps, p95 waiting, slowdown, threshold-based starvation, timeout/pending-job reporting, infeasible requests, identical paired traces, deterministic metric/evidence replay, duplicate-trace handling, JSON/CSV exports, queue bounds, persisted artifacts, failure recovery and isolation from the live cluster. Prior Phase 1/2 tests continue to pass, including exact replay equivalence after different advance chunk sizes.

Frontend build and source lint pass without warnings. Browser verification covers launching a comparison, displayed completion/progress, the result chart/table, metric switching and retrieving a saved study after a backend restart. Preview: `policy-arena-preview.jpg`.

The default three-seed, 30-job study demonstrates why several metrics matter. Resource-balanced scheduling has lower mean waiting than FCFS in that sample (10.73 vs 11.56 seconds), but higher mean per-trial p95 waiting (49.67 vs 42.67 seconds). Priority has a lower mean makespan (113.00 vs 114.33 seconds); its paired interval includes zero. These are observations on those synthetic traces, not a general scheduler superiority claim.

The next phase can implement a queue-aware counterfactual scheduler with starvation protection and modeled preemption costs, then evaluate its contribution using this runner and feature ablations.
