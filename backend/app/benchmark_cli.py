"""Usage: python -m app.benchmark_cli --count 30 --seeds 42 43 44 --output results/study.json"""
import argparse
import json
from pathlib import Path

from app.models.benchmark import BenchmarkRequest
from app.services.benchmark import csv_export, run_benchmark


def main():
    parser = argparse.ArgumentParser(description="Reproducible GPU scheduling policy comparison")
    parser.add_argument("--preset", default="MIXED")
    parser.add_argument("--count", type=int, default=30)
    parser.add_argument("--seeds", type=int, nargs="+", default=[42, 43, 44])
    parser.add_argument("--policies", nargs="+", default=["FCFS", "PRIORITY", "RESOURCE_BALANCED"])
    parser.add_argument("--baseline", default="FCFS")
    parser.add_argument("--horizon", type=float, default=10000)
    parser.add_argument("--starvation-threshold", type=float, default=30)
    parser.add_argument("--trace", type=Path, help="Optional custom JSON job array")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    config = BenchmarkRequest(preset=args.preset, count=args.count, seeds=args.seeds,
                              policies=args.policies, baseline=args.baseline,
                              horizon_seconds=args.horizon, starvation_threshold_seconds=args.starvation_threshold,
                              jobs=json.loads(args.trace.read_text(encoding="utf-8")) if args.trace else None)
    result = run_benchmark(config.model_dump())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
    args.output.with_suffix(".csv").write_text(csv_export(result), encoding="utf-8")
    print(f"Compared {result['trial_count']} trials on {result['distinct_workloads']} distinct workloads.")
    print(f"Saved {args.output} and {args.output.with_suffix('.csv')}")


if __name__ == "__main__":
    main()
