"""Generate explicitly labeled demo examples using the real simulation engine."""
import json
from pathlib import Path

from app.models.benchmark import BenchmarkRequest
from app.services.benchmark import run_benchmark, summary_view
from app.services.replay import ReplayRun, make_trace


def prepare():
    config = BenchmarkRequest(name="Hackathon reference · urgent workload", preset="PREEMPTION",
                              count=4, seeds=[42], policies=["FCFS", "PREEMPTIVE"], baseline="FCFS",
                              horizon_seconds=100, starvation_threshold_seconds=30)
    result = run_benchmark(config.model_dump())
    report = summary_view(result)
    waits = {row["policy"]: row["metrics"]["p95_wait_seconds"]["mean"] for row in report["summary"]}
    if waits != {"FCFS": 15.0, "PREEMPTIVE": 4.0}:
        raise RuntimeError(f"Demo contract changed; update the presentation before packaging: {waits}")
    preview = ReplayRun(make_trace("PREEMPTION"), policy="PREEMPTIVE").control("advance", seconds=5)
    frontend = Path(__file__).resolve().parents[2] / "frontend"
    outputs = {
        frontend / "src" / "data" / "demo-reference.json": {"preview": preview, "report": report},
        frontend / "public" / "demo-evidence.json": result,
    }
    for path, payload in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print("Prepared engine-generated reference: FCFS p95 wait 15s; preemptive 4s.")


if __name__ == "__main__":
    prepare()
