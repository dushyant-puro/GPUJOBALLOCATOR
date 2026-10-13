import csv
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api import benchmarks
from app.main import app
from app.models.benchmark import BenchmarkRequest
from app.services.benchmark import csv_export, evaluate_trial, run_benchmark
from app.services.benchmark_store import BenchmarkManager, BenchmarkStore


def full(name="job", arrival=0, duration=10, compute=8):
    return dict(name=name, arrival_seconds=arrival, duration_seconds=duration,
                compute_required=compute, memory_required=16,
                accelerator_a_required=4, accelerator_b_required=2, priority=1)


class MetricTests(unittest.TestCase):
    def test_hand_calculated_full_gpu_queue(self):
        metrics = evaluate_trial([full(str(i)) for i in range(4)], "FCFS", 42, 100, 5)["metrics"]
        self.assertEqual("COMPLETED", metrics["status"])
        self.assertEqual(20, metrics["makespan_seconds"])
        self.assertEqual(2.5, metrics["mean_wait_seconds"])
        self.assertEqual(10, metrics["p95_wait_seconds"])
        self.assertEqual(1.25, metrics["mean_slowdown"])
        self.assertAlmostEqual(66.666667, metrics["compute_utilization_percent"])
        self.assertAlmostEqual(66.666667, metrics["memory_utilization_percent"])
        self.assertEqual(0, metrics["resource_imbalance_percent"])
        self.assertEqual(12, metrics["throughput_per_minute"])
        self.assertEqual(25, metrics["starvation_rate_percent"])

    def test_idle_gap_counts_in_time_weighted_utilization(self):
        metrics = evaluate_trial([full(arrival=10)], "FCFS", 42, 100, 5)["metrics"]
        self.assertEqual(20, metrics["observation_seconds"])
        self.assertAlmostEqual(16.666667, metrics["compute_utilization_percent"])

    def test_timeout_keeps_unfinished_and_pending_jobs_visible(self):
        trace = [full(str(i)) for i in range(4)] + [full("future", arrival=20)]
        metrics = evaluate_trial(trace, "FCFS", 42, 5, 3)["metrics"]
        self.assertEqual("TIMED_OUT", metrics["status"])
        self.assertEqual(5, metrics["unfinished_jobs"])
        self.assertEqual(1, metrics["scheduled_jobs"])
        self.assertIsNone(metrics["mean_wait_seconds"])
        self.assertIsNone(metrics["p95_wait_seconds"])
        self.assertIsNone(metrics["makespan_seconds"])
        self.assertEqual(25, metrics["starvation_rate_percent"])

    def test_infeasible_jobs_are_not_counted_as_starvation(self):
        metrics = evaluate_trial([full(compute=9)], "FCFS", 42, 100, 5)["metrics"]
        self.assertEqual("STALLED", metrics["status"])
        self.assertEqual(1, metrics["infeasible_arrived_jobs"])
        self.assertIsNone(metrics["starvation_rate_percent"])
        self.assertIsNone(metrics["p95_wait_seconds"])

    def test_identical_seeded_comparisons_preserve_metrics_and_evidence(self):
        config = BenchmarkRequest(count=10, seeds=[42, 43], policies=["FCFS", "PRIORITY"]).model_dump()
        one = run_benchmark(config)
        two = run_benchmark(config)
        self.assertEqual(one["summary"], two["summary"])
        for a, b in zip(one["trials"], two["trials"]):
            for key in ("metrics", "jobs", "events", "decisions", "trace_hash"):
                self.assertEqual(a[key], b[key])
        for seed in [42, 43]:
            paired = [trial["trace_hash"] for trial in one["trials"] if trial["seed"] == seed]
            self.assertEqual(1, len(set(paired)))

    def test_fixed_presets_do_not_fabricate_independent_trials(self):
        config = BenchmarkRequest(preset="PREEMPTION", seeds=[42, 43, 44],
                                  policies=["FCFS", "PREEMPTIVE"]).model_dump()
        result = run_benchmark(config)
        self.assertEqual(1, result["distinct_workloads"])
        self.assertEqual(2, result["trial_count"])
        self.assertEqual([43, 44], result["duplicate_seeds"])
        row = next(row for row in result["summary"] if row["policy"] == "PREEMPTIVE")
        delta = row["paired_deltas"]["p95_wait_seconds"]
        self.assertEqual(-11, delta["mean"])
        self.assertIsNone(delta["bootstrap_95_interval"])

    def test_csv_matches_metrics_and_missing_values_are_blank(self):
        result = run_benchmark(BenchmarkRequest(count=4, seeds=[42], horizon_seconds=1,
                              policies=["FCFS", "PRIORITY"]).model_dump())
        rows = list(csv.DictReader(io.StringIO(csv_export(result))))
        self.assertEqual(2, len(rows))
        self.assertEqual("TIMED_OUT", rows[0]["status"])
        self.assertEqual("", rows[0]["makespan_seconds"])
        self.assertEqual(str(result["trials"][0]["metrics"]["unfinished_jobs"]), rows[0]["unfinished_jobs"])

    def test_request_budget_and_baseline_validation(self):
        for kwargs in ({"baseline": "SJF"}, {"seeds": []}, {"policies": ["FCFS", "FCFS"]},
                       {"count": 200, "seeds": [1, 2, 3, 4, 5], "policies": ["FCFS", "PRIORITY", "SJF", "RESOURCE_BALANCED"]},
                       {"horizon_seconds": float("nan")}, {"seeds": [-1]}):
            with self.assertRaises(ValidationError):
                BenchmarkRequest(**kwargs)


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = BenchmarkStore(Path(self.temp.name) / "study.sqlite3")
        self.config = BenchmarkRequest(count=4, seeds=[42], policies=["FCFS", "PRIORITY"]).model_dump()

    def test_completed_artifact_survives_store_reopening(self):
        identifier = self.store.create(self.config)
        result = run_benchmark(self.config)
        self.store.finish(identifier, result)
        reopened = BenchmarkStore(self.store.path)
        self.assertEqual("SUCCEEDED", reopened.get(identifier)["status"])
        artifact = reopened.get(identifier, artifact=True)["artifact"]
        self.assertEqual(result["summary"], artifact["summary"])
        self.assertEqual(identifier, artifact["benchmark_id"])
        self.assertNotIn("trials", reopened.get(identifier)["summary"])

    def test_interrupted_study_is_failed_on_recovery(self):
        identifier = self.store.create(self.config)
        self.store.update(identifier, "RUNNING")
        self.store.recover()
        row = self.store.get(identifier)
        self.assertEqual("FAILED", row["status"])
        self.assertIn("restarted", row["error"])
        self.assertEqual(self.config, row["config"])

    def test_pending_queue_is_bounded(self):
        for _ in range(4):
            self.store.create(self.config)
        with self.assertRaises(ValueError):
            self.store.create(self.config)

    def test_worker_failure_is_recorded(self):
        manager = BenchmarkManager(self.store)
        self.addCleanup(manager.close)
        with patch("app.services.benchmark_store.run_benchmark", side_effect=ValueError("test failure")):
            identifier = manager.submit(self.config)
            manager.close()
        row = self.store.get(identifier)
        self.assertEqual("FAILED", row["status"])
        self.assertIn("test failure", row["error"])


class BenchmarkApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.manager = BenchmarkManager(BenchmarkStore(Path(self.temp.name) / "study.sqlite3"))
        self.addCleanup(self.manager.close)
        patcher = patch.object(benchmarks, "manager", self.manager)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def test_async_comparison_exports_and_live_cluster_isolation(self):
        before = self.client.get("/jobs/").json()
        created = self.client.post("/benchmarks/", json={"count": 5, "seeds": [42], "policies": ["FCFS", "PRIORITY"]})
        self.assertEqual(202, created.status_code, created.text)
        identifier = created.json()["id"]
        self.manager.close()
        path = "/benchmarks/" + identifier
        status = self.client.get(path).json()
        self.assertEqual("SUCCEEDED", status["status"], status.get("error"))
        self.assertEqual(2, status["summary"]["trial_count"])
        exported = self.client.get(path + "/export/json")
        self.assertEqual(200, exported.status_code)
        self.assertEqual(identifier, exported.json()["benchmark_id"])
        self.assertIn("attachment", exported.headers["content-disposition"])
        self.assertEqual(3, len(self.client.get(path + "/export/csv").text.strip().splitlines()))
        self.assertEqual(1, len(self.client.get("/benchmarks/").json()["benchmarks"]))
        self.assertEqual(before, self.client.get("/jobs/").json())
        self.assertEqual(404, self.client.get("/benchmarks/missing").status_code)

    def test_invalid_and_unfinished_export_requests_are_rejected(self):
        self.assertEqual(422, self.client.post("/benchmarks/", json={"policies": ["FCFS"]}).status_code)
        identifier = self.manager.store.create(BenchmarkRequest().model_dump())
        self.assertEqual(409, self.client.get(f"/benchmarks/{identifier}/export/json").status_code)
        self.assertEqual(422, self.client.get(f"/benchmarks/{identifier}/export/xml").status_code)


if __name__ == "__main__":
    unittest.main()
