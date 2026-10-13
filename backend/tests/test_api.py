import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.api import analytics, jobs, resources
from app.main import app
from app.services.simulation import Simulation


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.sim = Simulation()
        for module in (jobs, resources, analytics):
            patcher = patch.object(module, "simulation", self.sim)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def create(self, **params):
        spec = dict(name="API job", compute_required=8, memory_required=16)
        spec.update(params)
        response = self.client.post("/jobs/", params=spec)
        self.assertEqual(200, response.status_code, response.text)
        return response.json()["job"]

    def test_lifecycle_and_decision_history_contract(self):
        job = self.create()
        snapshot = job["allocation_explanation"]
        self.assertEqual("ALLOCATED", snapshot["decision"])
        self.assertTrue(next(c for c in snapshot["candidates"] if c["gpu_id"] == job["gpu_id"])["eligible"])
        path = f"/jobs/{job['job_id']}"
        result = self.client.post(path + "/complete")
        self.assertEqual(200, result.status_code)
        completed = result.json()["job"]
        self.assertEqual("COMPLETED", completed["allocation_explanation"]["decision"])
        self.assertEqual(snapshot, completed["allocation_explanation"]["last_allocation"])
        self.assertEqual(job["gpu_id"], completed["last_gpu_id"])
        self.assertEqual(400, self.client.post(path + "/complete").status_code)
        decisions = self.client.get(path + "/decisions").json()["decisions"]
        self.assertEqual(["ALLOCATED", "COMPLETED"], [d["decision"] for d in decisions])
        self.assertEqual(404, self.client.get("/jobs/999/decisions").status_code)

    def test_validation_and_infeasible_diagnostics(self):
        self.assertEqual(400, self.client.post("/jobs/", params={
            "name": "", "compute_required": 1, "memory_required": 1
        }).status_code)
        self.assertEqual(422, self.client.post("/jobs/", params={
            "name": "bad", "compute_required": "NaN", "memory_required": 1
        }).status_code)
        job = self.create(compute_required=9)
        self.assertEqual("INFEASIBLE", job["allocation_explanation"]["decision"])
        self.assertEqual(3, len(job["current_diagnostics"]["candidates"]))
        status = self.client.get("/resources/deadlock").json()
        self.assertEqual("NOT_APPLICABLE", status["status"])
        self.assertIsNone(status["deadlock_detected"])
        self.assertEqual(1, status["infeasible_count"])
        data = self.client.get("/analytics/resources").json()
        self.assertEqual(data["overall_fragmentation"], data["resource_imbalance"])
        self.assertIn("Deprecated alias", data["metric_definitions"]["fragmentation"])

    def test_generated_and_manual_ids_and_stress_contract(self):
        first = self.create()
        generated = self.client.post("/jobs/workload/generate", params={"count": 10, "seed": 42})
        self.assertEqual(200, generated.status_code, generated.text)
        final = self.create()
        ids = [first["job_id"], final["job_id"]] + [job["job_id"] for job in generated.json()["jobs"]]
        self.assertEqual(12, len(set(ids)))
        result = self.client.post("/jobs/stress-test", params={"count": 10, "seed": 42})
        self.assertEqual(200, result.status_code, result.text)
        self.assertEqual("submission_batch", result.json()["result"]["test_type"])
        self.assertTrue(self.sim.assert_resource_invariants())
        self.assertEqual(200, self.client.get("/jobs/statistics").status_code)
        self.assertEqual(200, self.client.get("/jobs/historical-analytics").status_code)
        self.assertEqual(200, self.client.get("/resources/").status_code)
        self.assertEqual(400, self.client.post("/jobs/policy", params={"policy": "bad"}).status_code)


if __name__ == "__main__":
    unittest.main()
