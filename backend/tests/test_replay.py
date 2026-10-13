import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.api import replay
from app.main import app
from app.services.replay import ReplayRegistry, ReplayRun, VirtualClock, make_trace
from app.services.simulation import Simulation


def spec(name="job", arrival=0, duration=10, priority=1, compute=8):
    return dict(name=name, arrival_seconds=arrival, duration_seconds=duration,
                compute_required=compute, memory_required=16, priority=priority)


class ReplayTests(unittest.TestCase):
    def test_automatic_completion_and_queue_release(self):
        run = ReplayRun([spec(str(i)) for i in range(4)], policy="FCFS")
        initial = run.snapshot()
        self.assertEqual(3, initial["metrics"]["running"])
        self.assertEqual(1, initial["metrics"]["waiting"])
        first = run.control("step")
        self.assertEqual(10, first["time_seconds"])
        self.assertEqual(3, first["metrics"]["completed"])
        self.assertEqual(1, first["metrics"]["running"])
        final = run.control("step")
        self.assertEqual("COMPLETED", final["status"])
        self.assertEqual(20, final["time_seconds"])
        self.assertEqual(10, final["jobs"][3]["waiting_duration_seconds"])
        self.assertTrue(run.simulation.assert_resource_invariants())

    def test_simultaneous_arrivals_are_ranked_as_one_batch(self):
        trace = [spec("low", priority=1), spec("high", priority=5),
                 spec("second", priority=4), spec("third", priority=3)]
        run = ReplayRun(trace, policy="PRIORITY")
        jobs = {job.name: job for job in run.simulation.jobs}
        self.assertTrue(jobs["low"].is_waiting())
        self.assertTrue(jobs["high"].is_running())

    def test_completions_precede_arrivals_at_identical_time(self):
        run = ReplayRun([spec("first"), spec("second", arrival=10)], policy="FCFS")
        state = run.control("step")
        events = [event["kind"] for event in state["events"] if event["time_seconds"] == 10]
        self.assertEqual(["COMPLETED", "ARRIVAL", "ALLOCATED"], events)

    def test_true_sjf_uses_runtime_when_durations_exist(self):
        run = ReplayRun([spec("long", duration=40), spec("a", duration=4),
                         spec("b", duration=5), spec("c", duration=6)], policy="SJF")
        self.assertTrue(next(job for job in run.simulation.jobs if job.name == "long").is_waiting())
        self.assertEqual(4, run.snapshot()["next_event_seconds"])

    def test_preempted_job_preserves_progress_and_finishes_later(self):
        run = ReplayRun(make_trace("PREEMPTION"), policy="PREEMPTIVE")
        at_five = run.control("step")
        interrupted = next(job for job in at_five["jobs"] if job["status"] == "WAITING")
        self.assertEqual(5, interrupted["execution_duration_seconds"])
        self.assertEqual(15, interrupted["remaining_duration_seconds"])
        self.assertEqual(9, at_five["next_event_seconds"])
        final = run.control("advance", seconds=100)
        self.assertEqual(24, final["time_seconds"])
        job = next(job for job in final["jobs"] if job["job_id"] == interrupted["job_id"])
        self.assertEqual(20, job["execution_duration_seconds"])
        self.assertEqual(4, job["waiting_duration_seconds"])
        self.assertEqual(2, len(job["placement_history"]))

    def test_reset_reproduces_exact_events_decisions_and_times(self):
        run = ReplayRun(make_trace("MIXED", 77, 40))
        initial = run.snapshot()
        final = run.control("advance", seconds=10000)
        self.assertEqual(initial, run.control("reset"))
        self.assertEqual(final, run.control("advance", seconds=10000))

    def test_large_and_small_advances_produce_identical_completed_run(self):
        one = ReplayRun(make_trace("MIXED", 42, 30))
        two = ReplayRun(make_trace("MIXED", 42, 30))
        final = one.control("advance", seconds=10000)
        while two.status not in {"COMPLETED", "STALLED"}:
            other = two.control("advance", seconds=0.7)
        final.pop("run_id")
        other.pop("run_id")
        self.assertEqual(final, other)

    def test_play_pause_speed_and_idle_gap_use_injected_wall_clock(self):
        wall = [0.0]
        run = ReplayRun([spec(duration=100)], wall_clock=lambda: wall[0])
        run.control("play")
        wall[0] = 2
        self.assertEqual(2, run.snapshot()["time_seconds"])
        run.control("speed", speed=5)
        wall[0] = 4
        self.assertEqual(12, run.control("pause")["time_seconds"])
        wall[0] = 50
        self.assertEqual(12, run.snapshot()["time_seconds"])
        run.control("play")
        wall[0] = 100
        final = run.snapshot()
        self.assertEqual("COMPLETED", final["status"])
        self.assertEqual(100, final["time_seconds"])

    def test_invalid_controls_do_not_advance_or_mutate_run(self):
        run = ReplayRun([spec()])
        before = run.snapshot()
        for action, args in [("advance", {"seconds": -1}), ("speed", {"speed": float("nan")}),
                             ("advance", {}), ("invalid", {})]:
            with self.assertRaises(ValueError):
                run.control(action, **args)
            self.assertEqual(before, run.snapshot())
        run.control("play")
        with self.assertRaises(ValueError):
            run.control("step")

    def test_infeasible_run_stops_without_infinite_advance(self):
        run = ReplayRun(make_trace("INFEASIBLE"))
        final = run.control("advance", seconds=10000)
        self.assertEqual("STALLED", final["status"])
        self.assertEqual(3, final["metrics"]["completed"])
        self.assertEqual(1, final["resources"]["queue_diagnostics"]["infeasible_count"])
        self.assertIsNone(final["next_event_seconds"])
        self.assertEqual(final, run.control("step"))

    def test_fractional_times_and_future_first_arrival(self):
        run = ReplayRun([spec(arrival=1.0000001, duration=0.003)])
        self.assertEqual(0, len(run.snapshot()["jobs"]))
        self.assertEqual(1, run.control("step")["time_seconds"])
        final = run.control("step")
        self.assertEqual(1.003, final["time_seconds"])
        self.assertEqual("COMPLETED", final["status"])

    def test_virtual_clock_and_missing_duration_validation(self):
        clock = VirtualClock()
        clock.advance_to(5)
        with self.assertRaises(ValueError):
            clock.advance_to(4)
        with self.assertRaises(ValueError):
            clock.advance_to(float("inf"))
        trace = spec()
        del trace["duration_seconds"]
        with self.assertRaises(ValueError):
            ReplayRun([trace])

    def test_event_pagination_and_replay_size_limit(self):
        run = ReplayRun(make_trace("BURST", 42, 30))
        final = run.control("advance", seconds=10000)
        self.assertGreater(final["event_count"], 200)
        self.assertEqual(200, len(final["events"]))
        first = run.event_page(0, 5)
        self.assertEqual(5, len(first["events"]))
        self.assertEqual(1, first["events"][0]["event_id"])
        self.assertEqual(final["event_count"], first["total"])
        with self.assertRaises(ValueError):
            make_trace(count=201)

    def test_sessions_are_isolated_and_registry_is_bounded(self):
        registry = ReplayRegistry(limit=2)
        one = registry.create([spec()], "FCFS", "one")
        two = registry.create([spec()], "FCFS", "two")
        before = two.snapshot()
        one.control("advance", seconds=100)
        self.assertEqual(before, two.snapshot())
        with self.assertRaises(ValueError):
            registry.create([spec()], "FCFS", "third")
        registry.delete(one.run_id)
        with self.assertRaises(KeyError):
            registry.get(one.run_id)
        registry.create([spec()], "FCFS", "third")

    def test_concurrent_steps_do_not_complete_jobs_twice(self):
        run = ReplayRun(make_trace("BURST", 42, 40))
        with ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(lambda _: run.control("step"), range(100)))
        self.assertEqual("COMPLETED", run.status)
        self.assertEqual(40, len(run.simulation.completed_job_history))
        self.assertTrue(run.simulation.assert_resource_invariants())

    def test_all_policies_drain_same_seeded_trace(self):
        trace = make_trace("MIXED", 42, 30)
        for policy in Simulation.SUPPORTED_POLICIES:
            run = ReplayRun(trace, policy=policy)
            final = run.control("advance", seconds=10000)
            self.assertEqual("COMPLETED", final["status"], policy)
            self.assertEqual(30, final["metrics"]["completed"], policy)
            self.assertTrue(run.simulation.assert_resource_invariants())


class ReplayApiTests(unittest.TestCase):
    def setUp(self):
        patcher = patch.object(replay, "registry", ReplayRegistry(limit=2))
        patcher.start()
        self.addCleanup(patcher.stop)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def test_complete_api_workflow_and_legacy_cluster_isolation(self):
        before = self.client.get("/jobs/").json()
        self.assertEqual(200, self.client.get("/replay/presets").status_code)
        created = self.client.post("/replay/runs", json={"jobs": [spec()], "policy": "FCFS"})
        self.assertEqual(201, created.status_code, created.text)
        path = "/replay/runs/" + created.json()["run_id"]
        final = self.client.post(path + "/control", json={"action": "step"})
        self.assertEqual("COMPLETED", final.json()["status"])
        self.assertEqual(200, self.client.get(path).status_code)
        page = self.client.get(path + "/events", params={"offset": 0, "limit": 1}).json()
        self.assertEqual(1, len(page["events"]))
        self.assertEqual("ARRIVAL", page["events"][0]["kind"])
        self.assertEqual(1, len(self.client.get("/replay/runs").json()["runs"]))
        self.assertEqual(before, self.client.get("/jobs/").json())
        self.assertEqual(200, self.client.delete(path).status_code)
        self.assertEqual(404, self.client.get(path).status_code)

    def test_malformed_trace_and_control_are_rejected(self):
        for payload in [{"jobs": []}, {"policy": "unknown"}, {"count": 201},
                        {"jobs": [spec(duration=-1)]}, {"jobs": [spec(arrival=-1)]},
                        {"jobs": [{**spec(), "compute_required": 1.5}]}]:
            self.assertEqual(422, self.client.post("/replay/runs", json=payload).status_code)
        run = self.client.post("/replay/runs", json={"count": 1}).json()
        path = f"/replay/runs/{run['run_id']}/control"
        self.assertEqual(409, self.client.post(path, json={"action": "advance"}).status_code)
        self.assertEqual(422, self.client.post(path, json={"action": "advance", "seconds": -1}).status_code)
        self.assertEqual(404, self.client.get("/replay/runs/missing").status_code)
        self.assertEqual(409, self.client.post(path, json={"action": "speed"}).status_code)


if __name__ == "__main__":
    unittest.main()
