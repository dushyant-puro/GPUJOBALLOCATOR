from concurrent.futures import ThreadPoolExecutor
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from app.main import app
from app.api import challenges
from app.services.challenges import ChallengeRun, ChallengeRegistry
from app.services.reservations import ReservationSimulation
from app.services.simulation import Simulation
from app.models.job import Job


NODES = [{"gpu_id": "N1", "compute_units": 4, "memory": 8, "node_type": "X"},
         {"gpu_id": "N2", "compute_units": 8, "memory": 4, "node_type": "Y"}]


class ChallengeTests(unittest.TestCase):
    def finish(self, name):
        run = ChallengeRun(name)
        while not run.snapshot()["complete"]:
            run.step()
        return run

    def test_vector_fit_wait_release_retries_without_exceeding_either_dimension(self):
        run = ChallengeRun("C1")
        self.assertEqual(run.step()["engines"][0]["available"]["memory"], 2)
        blocked = run.step()["engines"][0]
        self.assertEqual([job["status"] for job in blocked["jobs"]], ["RUNNING", "WAITING"])
        self.assertEqual(blocked["available"]["compute_units"], 2)
        final = run.step()["engines"][0]
        self.assertEqual([job["status"] for job in final["jobs"]], ["COMPLETED", "RUNNING"])
        self.assertEqual((final["available"]["compute_units"], final["available"]["memory"]), (1, 5))

    def test_repeat_and_unknown_cancellation_do_not_release_twice(self):
        run = ChallengeRun("C2")
        run.step()
        first = run.step()["engines"][0]["available"]
        second = run.step()
        unknown = run.step()
        self.assertEqual(first, second["engines"][0]["available"])
        self.assertEqual(first, unknown["engines"][0]["available"])
        self.assertFalse(second["events"][-1]["outcomes"][0]["changed"])
        self.assertEqual(unknown["events"][-1]["outcomes"][0]["status"], "NOT_FOUND")

    def test_fragmentation_preserves_different_dimensions_without_fabricated_aggregate_gain(self):
        final = self.finish("C3").snapshot()["engines"]
        first, proposed = final
        self.assertEqual([job["gpu_id"] for job in first["jobs"]], ["N1", None, "N2"])
        self.assertEqual([job["gpu_id"] for job in proposed["jobs"]], ["N2", "N1", None])
        self.assertEqual(first["aggregate_utilization"], proposed["aggregate_utilization"])
        self.assertEqual((first["available"]["compute_units"], first["available"]["memory"]), (0, 4))
        self.assertEqual((proposed["available"]["compute_units"], proposed["available"]["memory"]), (4, 0))
        explanation = proposed["jobs"][0]["allocation_explanation"]
        self.assertEqual(explanation["placement_rule"], "MEMORY_BEST_FIT")
        self.assertIn("Smallest remaining memory", explanation["reasons"][1])

    def test_cycle_detection_recovery_and_final_release(self):
        run = ChallengeRun("C4")
        for _ in range(4):
            snapshot = run.step()
        self.assertEqual(snapshot["reservations"]["cycles"], [["A", "B"]])
        recovered = run.step()["reservations"]
        self.assertFalse(recovered["deadlock"])
        self.assertEqual(recovered["resources"], {"G1": "A", "G2": "A"})
        final = run.step()["reservations"]
        self.assertEqual(final["resources"], {"G1": None, "G2": None})
        self.assertEqual({task["id"]: task["status"] for task in final["processes"]}, {"A": "COMPLETED", "B": "ABORTED"})

    def test_impossible_type_rejected_before_ids_or_resources_are_mutated(self):
        run = ChallengeRun("C5")
        rejected = run.step()
        self.assertEqual(len(rejected["rejections"]), 1)
        self.assertEqual(rejected["engines"][0]["jobs"], [])
        run.step()
        final = run.step()["engines"][0]
        self.assertEqual([job["gpu_id"] for job in final["jobs"]], ["N1", "N2"])
        self.assertEqual([job["job_id"] for job in final["jobs"]], [1, 2])
        self.assertEqual(final["waiting"], 0)

    def test_preemption_never_releases_an_incompatible_victim(self):
        engine = Simulation(nodes=NODES)
        engine.scheduling_policy = "PREEMPTIVE"
        x = engine.submit_job(name="X full", compute_required=4, memory_required=8, required_node_type="X")
        engine.submit_job(name="Y full", compute_required=8, memory_required=4, required_node_type="Y", priority=10)
        urgent = engine.submit_job(name="Y urgent", compute_required=2, memory_required=2, required_node_type="Y", priority=5)
        self.assertEqual(urgent.status, "WAITING")
        self.assertEqual(x.status, "RUNNING")
        self.assertEqual(engine.preemption_count, 0)
        engine.assert_resource_invariants()

    def test_typed_preemption_releases_only_the_compatible_victim(self):
        engine = Simulation(nodes=NODES)
        engine.scheduling_policy = "PREEMPTIVE"
        x = engine.submit_job(name="X full", compute_required=4, memory_required=8, required_node_type="X")
        y = engine.submit_job(name="Y full", compute_required=8, memory_required=4, required_node_type="Y")
        urgent = engine.submit_job(name="Y urgent", compute_required=8, memory_required=4, required_node_type="Y", priority=5)
        self.assertEqual(urgent.gpu_id, "N2")
        self.assertEqual((x.status, y.status), ("RUNNING", "WAITING"))
        engine.assert_resource_invariants()

    def test_type_rejection_and_bad_node_configuration_are_atomic(self):
        engine = Simulation(nodes=NODES)
        before = engine.get_available_resources()
        for kind, compute, memory in [("Z", 1, 1), ("X", 5, 1), (" ", 1, 1)]:
            with self.assertRaises(ValueError):
                engine.submit_job(name="invalid", compute_required=compute, memory_required=memory, required_node_type=kind)
        self.assertEqual(engine.job_sequence, 0)
        self.assertEqual(engine.get_available_resources(), before)
        with self.assertRaises(ValueError):
            Simulation(nodes=[NODES[0], NODES[0]])
        with self.assertRaises(ValueError):
            Simulation(nodes=[{**NODES[0], "compute_units": True}])

    def test_infeasible_add_still_reports_type_in_diagnostics(self):
        engine = Simulation(nodes=NODES)
        job = Job(1, "wrong type", 1, 1, required_node_type="Z")
        engine.add_job(job)
        engine.try_allocate_job(job)
        self.assertEqual(engine.get_queue_diagnostics()["infeasible_count"], 1)
        self.assertTrue(all(candidate["compatible"] is False for candidate in engine.evaluate_candidates(job)))

    def test_reset_reproduces_actions_and_exports_are_detached(self):
        run = self.finish("C4")
        first = run.evidence()
        run.reset()
        for _ in range(6):
            run.step()
        self.assertEqual(first, run.evidence())
        first["run"]["reservations"]["resources"]["G1"] = "corrupted"
        self.assertIsNone(run.snapshot()["reservations"]["resources"]["G1"])

    def test_concurrent_steps_stop_at_the_end_and_never_duplicate_release(self):
        run = ChallengeRun("C2")
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(lambda _: run.step(), range(20)))
        snapshot = run.snapshot()
        self.assertEqual(snapshot["step_index"], 4)
        self.assertEqual(len(snapshot["events"]), 4)
        self.assertEqual(snapshot["engines"][0]["available"], snapshot["engines"][0]["total"])

    def test_registry_limit_and_session_isolation(self):
        registry = ChallengeRegistry(limit=2)
        first, second = registry.create("C1"), registry.create("C1")
        first.step()
        self.assertEqual(second.snapshot()["step_index"], 0)
        with self.assertRaises(ValueError):
            registry.create("C2")
        registry.delete(first.run_id)
        self.assertEqual(registry.create("C2").snapshot()["step_index"], 0)


class ReservationTests(unittest.TestCase):
    def test_acyclic_wait_is_not_deadlock_and_recovery_does_not_abort(self):
        simulation = ReservationSimulation()
        simulation.request("A", "G1")
        simulation.request("B", "G1")
        self.assertFalse(simulation.snapshot()["deadlock"])
        before = simulation.snapshot()["resources"]
        self.assertEqual(simulation.recover()["action"], "NO_DEADLOCK")
        self.assertEqual(simulation.snapshot()["resources"], before)
        simulation.complete("A")
        self.assertEqual(simulation.snapshot()["resources"]["G1"], "B")

    def test_terminal_completion_and_repeat_requests_never_double_grant(self):
        simulation = ReservationSimulation()
        simulation.request("A", "G1")
        self.assertEqual(simulation.request("A", "G1")["action"], "ALREADY_HELD")
        simulation.complete("A")
        self.assertEqual(simulation.complete("A")["action"], "TERMINAL_NOOP")
        self.assertEqual(simulation.request("A", "G2")["action"], "TERMINAL_NOOP")
        simulation.assert_invariants()

    def test_three_process_cycle_chooses_youngest_with_no_leaked_resources(self):
        simulation = ReservationSimulation(resources=("G1", "G2", "G3"))
        for process, resource in [("A", "G1"), ("B", "G2"), ("C", "G3"), ("A", "G2"), ("B", "G3"), ("C", "G1")]:
            simulation.request(process, resource)
        self.assertTrue(simulation.snapshot()["deadlock"])
        self.assertEqual(simulation.recover()["process"], "C")
        self.assertFalse(simulation.snapshot()["deadlock"])
        self.assertEqual(simulation.snapshot()["resources"]["G3"], "B")
        simulation.complete("B")
        simulation.complete("A")
        self.assertTrue(all(owner is None for owner in simulation.snapshot()["resources"].values()))

    def test_invalid_resource_or_second_pending_request_does_not_corrupt_state(self):
        simulation = ReservationSimulation(resources=("G1", "G2", "G3"))
        with self.assertRaises(ValueError):
            simulation.request("A", "unknown")
        self.assertEqual(simulation.processes, {})
        simulation.request("A", "G1")
        simulation.request("B", "G1")
        before = simulation.snapshot()
        with self.assertRaises(ValueError):
            simulation.request("B", "G2")
        self.assertEqual(before, simulation.snapshot())


class ChallengeApiTests(unittest.TestCase):
    def test_complete_workflow_exports_and_session_errors(self):
        with patch.object(challenges, "registry", ChallengeRegistry(limit=1)):
            client = TestClient(app)
            self.assertEqual(len(client.get("/challenges/catalog").json()["challenges"]), 5)
            self.assertEqual(client.post("/challenges/runs", json={"challenge_id": "unknown"}).status_code, 422)
            created = client.post("/challenges/runs", json={"challenge_id": "C4"})
            self.assertEqual(created.status_code, 201)
            run_id = created.json()["run_id"]
            self.assertEqual(client.post("/challenges/runs", json={"challenge_id": "C1"}).status_code, 409)
            for _ in range(6):
                self.assertEqual(client.post(f"/challenges/runs/{run_id}/control", json={"action": "step"}).status_code, 200)
            response = client.get(f"/challenges/runs/{run_id}/export")
            self.assertEqual(len(response.json()["snapshots"]), 7)
            self.assertIn("attachment", response.headers["content-disposition"])
            self.assertTrue(response.json()["run"]["complete"])
            self.assertEqual(client.post(f"/challenges/runs/{run_id}/control", json={"action": "reset"}).json()["step_index"], 0)
            self.assertEqual(client.delete(f"/challenges/runs/{run_id}").status_code, 200)
            self.assertEqual(client.get(f"/challenges/runs/{run_id}").status_code, 404)

    def test_live_job_api_rejects_incompatible_type_without_mutation(self):
        from app.api import jobs
        with patch.object(jobs, "simulation", Simulation()):
            client = TestClient(app)
            before = client.get("/jobs/").json()
            response = client.post("/jobs/", params={"name": "type Z", "compute_required": 1, "memory_required": 1, "required_node_type": "Z"})
            self.assertEqual(response.status_code, 422)
            self.assertEqual(client.get("/jobs/").json(), before)
