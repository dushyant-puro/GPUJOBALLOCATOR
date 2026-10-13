import json
from pathlib import Path
import re
import unittest

from fastapi.testclient import TestClient
from app.main import app
from app.services.replay import ReplayRun, make_trace


class StudioTests(unittest.TestCase):
    def test_guided_story_preserves_work_and_releases_resources(self):
        run = ReplayRun(make_trace("PREEMPTION"), policy="PREEMPTIVE")
        interrupted = run.control("advance", seconds=5)
        job = next(job for job in interrupted["jobs"] if job["name"] == "Long job 3")
        self.assertEqual((job["status"], job["execution_duration_seconds"], job["remaining_duration_seconds"]), ("WAITING", 5, 15))
        resumed = run.control("advance", seconds=4)
        job = next(job for job in resumed["jobs"] if job["name"] == "Long job 3")
        self.assertEqual((job["status"], job["waiting_duration_seconds"], job["remaining_duration_seconds"]), ("RUNNING", 4, 15))
        final = run.control("advance", seconds=15)
        self.assertEqual(final["metrics"]["completed"], 4)
        for gpu in final["resources"]["gpus"].values():
            self.assertEqual(gpu["total"], gpu["available"])

    def test_prepared_evidence_is_complete_and_matches_displayed_claim(self):
        path = Path(__file__).resolve().parents[2] / "frontend" / "public" / "demo-evidence.json"
        evidence = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(evidence["distinct_workloads"], 1)
        self.assertEqual({row["policy"]: row["metrics"]["p95_wait_seconds"]["mean"] for row in evidence["summary"]}, {"FCFS": 15, "PREEMPTIVE": 4})
        for trial in evidence["trials"]:
            self.assertEqual(trial["metrics"]["completed_jobs"], 4)
            self.assertEqual(trial["metrics"]["status"], "COMPLETED")

    @unittest.skipUnless((Path(__file__).resolve().parents[2] / "frontend" / "dist").is_dir(), "Build the frontend to verify production assets")
    def test_production_assets_share_the_api_origin(self):
        client = TestClient(app)
        self.assertEqual(client.get("/").json()["message"], "GPU Job Allocator API is running")
        response = client.get("/studio/")
        self.assertEqual(response.status_code, 200)
        assets = re.findall(r'(?:src|href)="(\./assets/[^\"]+)"', response.text)
        self.assertEqual(len(assets), 2)
        for asset in assets:
            self.assertEqual(client.get("/studio/" + asset[2:]).status_code, 200)
        self.assertEqual(client.get("/studio/demo-evidence.json").json()["distinct_workloads"], 1)
