import random
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from app.algorithms.allocation import GPUResourceManager
from app.models.job import Job
from app.services.simulation import Simulation
from app.services.stress_testing import StressTester
from app.services.workload_generator import WorkloadGenerator


class Clock:
    def __init__(self):
        self.now = datetime(2026, 10, 12, tzinfo=timezone.utc)

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += timedelta(seconds=seconds)


class CoreTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.sim = Simulation(clock=self.clock)

    def submit(self, **overrides):
        spec = dict(name="job", compute_required=8, memory_required=16,
                    accelerator_a_required=4, accelerator_b_required=2)
        spec.update(overrides)
        return self.sim.submit_job(**spec)

    def test_snapshot_preserves_winner_policy_and_components(self):
        job = self.submit()
        snapshot = self.sim.get_job_allocation_explanation(job)
        chosen = next(c for c in snapshot["candidates"] if c["gpu_id"] == job.gpu_id)
        self.assertTrue(chosen["eligible"])
        self.assertEqual(chosen["available_before"], chosen["total"])
        self.assertEqual(snapshot["score"], chosen["score_components"]["score"])
        self.assertEqual(job.gpu_id, "GPU-0")
        self.sim.set_scheduling_policy("PRIORITY")
        self.submit()
        self.assertEqual(snapshot, self.sim.get_job_allocation_explanation(job))
        snapshot["candidates"][0]["available_before"]["memory"] = -1
        self.assertEqual(16, self.sim.get_job_allocation_explanation(job)["candidates"][0]["available_before"]["memory"])

    def test_terminal_decision_keeps_original_allocation_and_gpu(self):
        job = self.submit()
        original = self.sim.get_job_decisions(job)[-1]
        self.clock.advance(10)
        self.assertTrue(self.sim.complete_job(job))
        self.assertFalse(self.sim.complete_job(job))
        self.assertFalse(self.sim.cancel_job(job))
        self.assertEqual("COMPLETED", self.sim.get_job_allocation_explanation(job)["decision"])
        self.assertEqual(original, self.sim.get_job_decisions(job)[0])
        self.assertEqual("GPU-0", self.sim.completed_job_history[0]["gpu_id"])
        self.assertEqual(1, len(self.sim.completed_job_history))
        self.assertIsNone(job.gpu_id)
        self.assertTrue(self.sim.assert_resource_invariants())

    def test_repeated_preemption_accumulates_intervals(self):
        job = self.submit()
        self.clock.advance(10)
        self.sim.preempt_job(job)
        self.clock.advance(20)
        self.assertEqual(10, job.get_execution_duration_seconds())
        self.assertEqual(20, job.get_waiting_duration_seconds())
        self.sim.retry_waiting_jobs()
        self.clock.advance(5)
        self.sim.preempt_job(job)
        self.clock.advance(7)
        self.sim.retry_waiting_jobs()
        self.clock.advance(8)
        self.sim.complete_job(job)
        self.assertEqual(23, job.get_execution_duration_seconds())
        self.assertEqual(27, job.get_waiting_duration_seconds())
        self.assertEqual(50, job.get_total_duration_seconds())
        self.assertEqual(3, len(job.placement_history))
        self.clock.advance(100)
        self.assertEqual(50, job.get_total_duration_seconds())
        self.assertEqual(23, job.get_execution_duration_seconds())
        self.assertTrue(self.sim.assert_resource_invariants())

    def test_cancel_before_start_freezes_every_duration(self):
        for _ in range(3):
            self.submit()
        waiting = self.submit()
        self.clock.advance(30)
        self.sim.cancel_job(waiting)
        before = waiting.to_dict()
        self.clock.advance(120)
        self.assertEqual(before, waiting.to_dict())
        self.assertEqual(30, waiting.get_queue_wait_seconds())
        self.assertEqual(30, waiting.get_waiting_duration_seconds())
        self.assertEqual("CANCELLED", self.sim.get_job_allocation_explanation(waiting)["decision"])

    def test_resource_release_exactly_once(self):
        job = self.submit()
        self.sim.preempt_job(job)
        self.assertFalse(self.sim.release_job_resources(job))
        self.assertTrue(self.sim.assert_resource_invariants())
        self.sim.cancel_job(job)
        self.assertFalse(self.sim.cancel_job(job))
        self.assertTrue(self.sim.assert_resource_invariants())

    def test_invalid_release_is_atomic(self):
        gpu = GPUResourceManager()
        gpu.allocate({"compute_units": 1, "memory": 1})
        before = gpu.get_available_resources()
        with self.assertRaises(ValueError):
            gpu.release({"compute_units": 1, "memory": 2})
        self.assertEqual(before, gpu.get_available_resources())
        self.assertFalse(gpu.can_allocate({"memory": float("nan")}))
        self.assertFalse(gpu.can_allocate({"unknown": 1}))

    def test_blocked_and_infeasible_are_distinct(self):
        for _ in range(3):
            self.submit()
        blocked = self.submit()
        impossible = self.submit(compute_required=9)
        self.assertEqual("WAITING", self.sim.get_job_allocation_explanation(blocked)["decision"])
        self.assertEqual("INFEASIBLE", self.sim.get_job_allocation_explanation(impossible)["decision"])
        status = self.sim.get_deadlock_status()
        self.assertIsNone(status["deadlock_detected"])
        self.assertFalse(status["supported"])
        self.assertEqual(1, status["blocked_count"])
        self.assertEqual(1, status["infeasible_count"])

    def test_split_capacity_is_blocked_despite_zero_imbalance(self):
        # Construct a diagnostic resource arrangement; not a conservation probe.
        gpus = self.sim.gpu_selector.get_all_gpus()
        gpus["GPU-0"].available = dict(compute_units=8, memory=0, accelerator_a=4, accelerator_b=2)
        gpus["GPU-1"].available = dict(compute_units=0, memory=16, accelerator_a=0, accelerator_b=0)
        gpus["GPU-2"].available = dict(compute_units=0, memory=0, accelerator_a=0, accelerator_b=0)
        job = Job(1, "split", 8, 16, 4, 2, clock=self.clock)
        self.sim.add_job(job)
        self.sim.try_allocate_job(job)
        self.assertEqual(0, self.sim.get_overall_fragmentation())
        self.assertEqual(1, self.sim.get_queue_diagnostics()["blocked_count"])

    def test_preemption_selects_a_victim_that_actually_enables_fit(self):
        small = self.submit(compute_required=1, memory_required=1,
                            accelerator_a_required=0, accelerator_b_required=0)
        self.submit(priority=2)
        self.submit(priority=2)
        # GPU-0 is partially occupied; urgent full request requires its release.
        self.sim.set_scheduling_policy("PREEMPTIVE")
        urgent = self.submit(priority=5)
        self.assertTrue(urgent.is_running())
        self.assertTrue(small.is_waiting())
        self.assertTrue(self.sim.assert_resource_invariants())

    def test_impossible_job_never_preempts_running_work(self):
        running = [self.submit() for _ in range(3)]
        self.sim.set_scheduling_policy("PREEMPTIVE")
        self.submit(compute_required=9, priority=5)
        self.assertEqual(0, self.sim.preemption_count)
        self.assertTrue(all(job.is_running() for job in running))
        self.assertTrue(self.sim.assert_resource_invariants())

    def test_retry_counters_include_all_placement_attempts(self):
        jobs = [self.submit() for _ in range(4)]
        self.assertEqual(4, self.sim.allocation_attempts)
        self.assertEqual(3, self.sim.successful_allocations)
        self.sim.complete_job(jobs[0])
        self.assertEqual(5, self.sim.allocation_attempts)
        self.assertEqual(4, self.sim.successful_allocations)
        self.assertEqual(80, self.sim.get_historical_analytics()["successful_allocation_rate"])

    def test_duplicate_allocation_and_job_ids_rejected(self):
        job = self.submit()
        before = self.sim.get_available_resources()
        self.assertFalse(self.sim.try_allocate_job(job))
        self.assertIsNone(self.sim.allocate_on_best_gpu(job))
        with self.assertRaises(ValueError):
            self.sim.add_job(Job(job.job_id, "duplicate", 1, 1))
        self.assertEqual(before, self.sim.get_available_resources())

    def test_new_arrival_respects_existing_fcfs_queue(self):
        self.sim.set_scheduling_policy("FCFS")
        self.submit()
        self.submit()
        older = Job(self.sim.job_sequence + 1, "older", 8, 16, 4, 2, clock=self.clock)
        self.sim.add_job(older)
        older.wait()
        newer = self.submit(priority=5)
        self.assertTrue(older.is_running())
        self.assertTrue(newer.is_waiting())
        self.assertTrue(self.sim.assert_resource_invariants())

    def test_unchanged_capacity_does_not_duplicate_failed_retry_events(self):
        for _ in range(3):
            self.submit()
        blocked = self.submit()
        history = self.sim.get_job_decisions(blocked)
        attempts = self.sim.allocation_attempts
        for _ in range(10):
            self.sim.retry_waiting_jobs()
        self.assertEqual(history, self.sim.get_job_decisions(blocked))
        self.assertEqual(attempts, self.sim.allocation_attempts)
        self.sim.complete_job(self.sim.get_running_jobs()[0])
        self.assertTrue(blocked.is_running())

    def test_invalid_lifecycle_transition_rejected(self):
        job = Job(1, "queued", 1, 1, clock=self.clock)
        with self.assertRaises(ValueError):
            job.complete()
        job.cancel()
        with self.assertRaises(ValueError):
            job.start()

    def test_concurrent_submissions_have_unique_ids_and_conserve_resources(self):
        with ThreadPoolExecutor(max_workers=8) as pool:
            jobs = list(pool.map(lambda _: self.submit(compute_required=1, memory_required=1,
                             accelerator_a_required=0, accelerator_b_required=0), range(60)))
        self.assertEqual(60, len({job.job_id for job in jobs}))
        self.assertEqual(24, len(self.sim.get_running_jobs()))
        self.assertTrue(self.sim.assert_resource_invariants())

    def test_mixed_lifecycle_preserves_resources_under_every_policy(self):
        rng = random.Random(42)
        for policy in self.sim.SUPPORTED_POLICIES:
            sim = Simulation(clock=self.clock)
            sim.set_scheduling_policy(policy)
            for _ in range(35):
                sim.submit_job(name="mixed", compute_required=rng.randint(1, 8),
                               memory_required=rng.randint(1, 16), priority=rng.randint(1, 5))
                self.assertTrue(sim.assert_resource_invariants())
                running = sim.get_running_jobs()
                if running and rng.random() < 0.5:
                    sim.complete_job(rng.choice(running))
                waiting = sim.get_waiting_jobs()
                if waiting and rng.random() < 0.3:
                    sim.cancel_job(rng.choice(waiting))
                self.assertTrue(sim.assert_resource_invariants())

    def test_seeded_workloads_match_and_stress_is_explicitly_submission_only(self):
        trace = WorkloadGenerator(seed=42).generate(count=10, pattern="MIXED")
        self.assertEqual(trace, WorkloadGenerator(seed=42).generate(count=10, pattern="MIXED"))
        result = StressTester().run(self.sim, trace)
        self.assertEqual("submission_batch", result["test_type"])
        self.assertFalse(result["completes_jobs"])
        self.assertTrue(self.sim.assert_resource_invariants())


if __name__ == "__main__":
    unittest.main()
