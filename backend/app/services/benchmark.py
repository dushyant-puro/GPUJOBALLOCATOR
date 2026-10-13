"""Paired, reproducible policy evaluation. No live dashboard state is used."""
from copy import deepcopy
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
import math
from pathlib import Path
import platform
from importlib.metadata import version
import random
import statistics
from time import perf_counter

from app.services.replay import EPOCH, ReplayRun, make_trace


METRIC_KEYS = ["makespan_seconds", "mean_wait_seconds", "p95_wait_seconds",
               "mean_slowdown", "throughput_per_minute", "compute_utilization_percent",
               "memory_utilization_percent", "resource_imbalance_percent",
               "starvation_rate_percent", "preemptions", "completion_rate_percent"]
DEFINITIONS = {
    "observation_window": "Zero to final completion/stall, or the configured timeout; per-policy window is recorded.",
    "utilization": "100 * integral(used/capacity dt) / observation seconds, per resource; includes idle gaps.",
    "resource_imbalance_percent": "Time average of max minus min cluster utilization across resource types; not demand-aware fragmentation.",
    "mean_wait_seconds": "Mean accumulated QUEUED/WAITING time for completed jobs only; incomplete counts are reported separately.",
    "p95_wait_seconds": "Nearest-rank 95th percentile of accumulated waiting among completed jobs; null when none finish.",
    "mean_slowdown": "Mean (completion - arrival) / requested runtime among completed jobs.",
    "starvation_rate_percent": "Percent of feasible arrived jobs whose observed cumulative waiting exceeds the configured threshold, including unfinished jobs.",
    "throughput_per_minute": "Completed jobs * 60 / observation seconds.",
    "makespan_seconds": "Final completion time from zero, including arrival gaps; null for incomplete/stalled workloads.",
    "preemption_overhead": "Not modeled; progress is preserved and interruption/recovery cost is assumed zero.",
    "paired_delta": "Policy metric minus baseline metric on the exact same trace; missing metrics are not replaced with zero.",
    "bootstrap_interval": "Exploratory 95% percentile interval for paired mean differences; 2000 seeded resamples of distinct workloads. Null with fewer than two pairs.",
}


def canonical_hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def source_fingerprint():
    root = Path(__file__).resolve().parents[1]
    digest = hashlib.sha256()
    for path in sorted(root.rglob("*.py")):
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


SOURCE_FINGERPRINT = source_fingerprint()


def percentile95(values):
    return sorted(values)[math.ceil(len(values) * 0.95) - 1] if values else None


def paired_interval(values):
    if len(values) < 2:
        return None
    rng = random.Random(74123)
    samples = sorted(statistics.mean(rng.choices(values, k=len(values))) for _ in range(2000))
    return [round(samples[49], 6), round(samples[1949], 6)]


def trial_metrics(run, horizon, threshold):
    sim = run.simulation
    jobs = sim.get_jobs()
    completed = sim.get_completed_jobs()
    seconds = run.clock.seconds
    waits = [job._duration_in({"QUEUED", "WAITING"}, rounded=False) for job in completed]
    total_gpus = [gpu.total for gpu in sim.gpu_selector.get_all_gpus().values()]

    def feasible(job):
        request = job.get_resource_request()
        return any(all(amount <= capacity[key] for key, amount in request.items()) for capacity in total_gpus)

    feasible_arrived = [job for job in jobs if feasible(job)]
    starving = [job for job in feasible_arrived
                if job._duration_in({"QUEUED", "WAITING"}, rounded=False) > threshold]
    utilization = {key: 100 * integral / seconds if seconds else 0.0
                   for key, integral in run.resource_time.items()}
    makespan = seconds if run.status == "COMPLETED" else None
    status = run.status if run.status in {"COMPLETED", "STALLED"} else "TIMED_OUT"
    mean = lambda values: statistics.mean(values) if values else None
    metrics = {
        "status": status, "observation_seconds": seconds, "timeout_seconds": horizon,
        "total_jobs": len(run.trace), "completed_jobs": len(completed), "arrived_jobs": len(jobs),
        "unfinished_jobs": len(run.trace) - len(completed), "scheduled_jobs": len(run.trace) - run.cursor,
        "infeasible_arrived_jobs": len(jobs) - len(feasible_arrived),
        "feasible_arrived_jobs": len(feasible_arrived), "starved_jobs": len(starving),
        "makespan_seconds": makespan, "mean_wait_seconds": mean(waits), "p95_wait_seconds": percentile95(waits),
        "mean_slowdown": mean([(job.completed_at - job.submitted_at).total_seconds() / job.duration_seconds
                               for job in completed]),
        "throughput_per_minute": len(completed) * 60 / seconds if seconds else 0.0,
        "compute_utilization_percent": utilization["compute_units"],
        "memory_utilization_percent": utilization["memory"],
        "utilization_by_resource": utilization,
        "resource_imbalance_percent": 100 * run.imbalance_time / seconds if seconds else 0.0,
        "starvation_rate_percent": len(starving) * 100 / len(feasible_arrived) if feasible_arrived else None,
        "preemptions": sim.preemption_count,
        "modeled_preemption_overhead_seconds": 0.0,
        "completion_rate_percent": len(completed) * 100 / len(run.trace),
        "allocation_attempts": sim.allocation_attempts, "successful_allocations": sim.successful_allocations,
    }
    return {key: round(value, 6) if isinstance(value, float) else value for key, value in metrics.items()}


def evaluate_trial(trace, policy, seed, horizon, threshold):
    started = perf_counter()
    run = ReplayRun(trace, policy=policy)
    # Advance directly without producing repeated UI snapshots or consulting wall time.
    with run.lock:
        run._advance(horizon)
        run.simulation.assert_resource_invariants()
        metrics = trial_metrics(run, horizon, threshold)
        logs = []
        evidence = []
        for job in run.simulation.jobs:
            data = job.to_dict()
            data["trace_index"] = job.trace_index
            data["accumulated_wait_seconds"] = job._duration_in({"QUEUED", "WAITING"}, rounded=False)
            data["execution_progress_seconds"] = job.get_execution_progress_seconds()
            logs.append(data)
            # Store committed actions and the final blocking decision per job. The
            # event log still records all failed retry decisions without bulky copies.
            records = [record for record in job.decision_history if record["decision"] not in {"WAITING", "INFEASIBLE"}]
            if job.decision_history and job.decision_history[-1]["decision"] in {"WAITING", "INFEASIBLE"}:
                records.append(job.decision_history[-1])
            evidence.extend(deepcopy(records))
    return {"seed": seed, "policy": policy, "trace_hash": canonical_hash(trace), "metrics": metrics,
            "jobs": logs, "events": deepcopy(run.events),
            "decisions": sorted(evidence, key=lambda record: record["decision_id"]),
            "host_processing_ms": round((perf_counter() - started) * 1000, 3)}


def summarize(trials, policies, baseline):
    rows = []
    base_by_seed = {trial["seed"]: trial["metrics"] for trial in trials if trial["policy"] == baseline}
    for policy in policies:
        group = [trial for trial in trials if trial["policy"] == policy]
        row = {"policy": policy, "trials": len(group),
               "complete_trials": sum(trial["metrics"]["status"] == "COMPLETED" for trial in group),
               "metrics": {}, "paired_deltas": {}}
        for key in METRIC_KEYS:
            values = [trial["metrics"][key] for trial in group if trial["metrics"][key] is not None]
            row["metrics"][key] = {
                "mean": round(statistics.mean(values), 6) if values else None,
                "stddev": round(statistics.stdev(values), 6) if len(values) > 1 else None,
                "samples": len(values),
            }
            differences = [trial["metrics"][key] - base_by_seed[trial["seed"]][key] for trial in group
                           if trial["metrics"][key] is not None and base_by_seed[trial["seed"]][key] is not None]
            row["paired_deltas"][key] = {
                "mean": round(statistics.mean(differences), 6) if differences else None,
                "pairs": len(differences), "bootstrap_95_interval": paired_interval(differences),
            }
        rows.append(row)
    return rows


def run_benchmark(config, progress=None):
    config = deepcopy(config)
    policies = config["policies"]
    if not policies or config["baseline"] not in policies:
        raise ValueError("Baseline must be one of the selected policies.")
    workloads = []
    seen = set()
    duplicate_seeds = []
    for seed in config["seeds"]:
        trace = config.get("jobs") or make_trace(config["preset"], seed, config["count"])
        trace = [{**job, "arrival_seconds": round(job["arrival_seconds"], 6),
                  "duration_seconds": round(job["duration_seconds"], 6)} for job in trace]
        identity = canonical_hash(trace)
        if identity in seen:
            duplicate_seeds.append(seed)
            continue
        seen.add(identity)
        workloads.append({"seed": seed, "trace_hash": identity, "trace": trace})
    trials = []
    total = len(workloads) * len(policies)
    for workload in workloads:
        for policy in policies:
            trials.append(evaluate_trial(workload["trace"], policy, workload["seed"],
                                         config["horizon_seconds"], config["starvation_threshold_seconds"]))
            if progress:
                progress(len(trials), total, policy, workload["seed"])
    warnings = ["Synthetic workloads on three identical simulated GPUs; zero checkpoint/recovery overhead.",
                "Paired bootstrap intervals are exploratory and do not establish universal superiority."]
    if duplicate_seeds:
        warnings.append(f"Duplicate traces were collapsed; seeds {duplicate_seeds} do not supply independent evidence.")
    if len(workloads) < 2:
        warnings.append("Only one distinct workload: confidence intervals are unavailable.")
    if any(trial["metrics"]["status"] != "COMPLETED" for trial in trials):
        warnings.append("Some trials are incomplete: completed-only waiting statistics can describe different job subsets.")
    return {"schema_version": 1, "engine_version": "paired-benchmark-v1",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "source_fingerprint": SOURCE_FINGERPRINT,
            "runtime": {"python": platform.python_version(), "fastapi": version("fastapi"), "pydantic": version("pydantic")},
            "config": config,
            "workloads": workloads, "distinct_workloads": len(workloads), "duplicate_seeds": duplicate_seeds,
            "trial_count": len(trials), "trials": trials,
            "summary": summarize(trials, policies, config["baseline"]),
            "metric_definitions": DEFINITIONS, "warnings": warnings,
            "cluster": {"gpu_count": 3, "per_gpu": {"compute_units": 8, "memory": 16, "accelerator_a": 4, "accelerator_b": 2}},
            "semantics": {"queue_policy": policies, "placement_policy": "normalized-footprint-v2 for every queue policy",
                          "simultaneous_events": "completions, then arrivals, then dispatch",
                          "evidence": "all committed decisions plus final blocking snapshot; event log includes retries"}}


def summary_view(result):
    return {key: deepcopy(value) for key, value in result.items() if key not in {"trials", "workloads"}}


def csv_export(result):
    output = io.StringIO(newline="")
    fields = ["schema_version", "engine_version", "source_fingerprint", "baseline", "horizon_seconds", "starvation_threshold_seconds", "host_processing_ms", "seed", "trace_hash", "policy", "status", "total_jobs", "completed_jobs", "unfinished_jobs",
              "scheduled_jobs", "infeasible_arrived_jobs", "observation_seconds", *METRIC_KEYS]
    writer = csv.DictWriter(output, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    for trial in result["trials"]:
        row = {"schema_version": result["schema_version"], "engine_version": result["engine_version"],
               "source_fingerprint": result["source_fingerprint"], "baseline": result["config"]["baseline"],
               "horizon_seconds": result["config"]["horizon_seconds"],
               "starvation_threshold_seconds": result["config"]["starvation_threshold_seconds"],
               "host_processing_ms": trial["host_processing_ms"],
               "seed": trial["seed"], "trace_hash": trial["trace_hash"], "policy": trial["policy"], **trial["metrics"]}
        writer.writerow({key: row.get(key) for key in fields})
    return output.getvalue()
