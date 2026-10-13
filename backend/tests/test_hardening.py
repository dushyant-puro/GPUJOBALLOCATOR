import os
from pathlib import Path
import random
import subprocess
import sys
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.api import jobs
from app.services.simulation import Simulation

from app.algorithms.demand_fragmentation import measure
from app.services.replay import ReplayRun, make_trace
from app.services.challenges import ChallengeRun
from app.services.banker import MultiUnitReservations
from app.services.reservations import ReservationSimulation
from app.services.invariants import InvariantError
from app.models.benchmark import BenchmarkRequest
from app.services.benchmark import run_benchmark


class FragmentationTests(unittest.TestCase):
    def test_trap_and_packing_are_hand_calculated(self):
        a=ReplayRun(make_trace("FRAGMENTATION_TRAP"), policy="FCFS")
        b=ReplayRun(make_trace("FRAGMENTATION_TRAP"), policy="FCFS", placement_rule="BEST_FIT_PACKING")
        a.control("advance", seconds=1); b.control("advance", seconds=1)
        metrics=measure(a.simulation)
        self.assertEqual(metrics["blocked_by_fragmentation"], 1)
        self.assertEqual(metrics["by_resource"]["compute_units"]["total_free"],18)
        self.assertEqual(metrics["by_resource"]["compute_units"]["largest_free_block"],6)
        self.assertAlmostEqual(metrics["by_resource"]["compute_units"]["external_fragmentation"],2/3)
        self.assertEqual(metrics["stranded_capacity"],1)
        self.assertEqual(a.simulation.jobs[-1].status,"WAITING")
        self.assertEqual(b.simulation.jobs[-1].status,"RUNNING")
        self.assertEqual(measure(b.simulation)["stranded_capacity"],0)
        self.assertEqual(a.control("advance", seconds=100)["time_seconds"],28)
        self.assertEqual(b.control("advance", seconds=100)["time_seconds"],20)

    def test_arena_compares_the_exact_same_trace_across_placements(self):
        config=BenchmarkRequest(preset="FRAGMENTATION_TRAP", policies=["FCFS"], placement_rules=["NORMALIZED","BEST_FIT_PACKING"], seeds=[42,43], count=4).model_dump()
        result=run_benchmark(config)
        self.assertEqual(result["distinct_workloads"],1)
        self.assertEqual(result["trial_count"],2)
        self.assertEqual(result["trials"][0]["trace_hash"],result["trials"][1]["trace_hash"])
        self.assertEqual([trial["metrics"]["p95_wait_seconds"] for trial in result["trials"]],[19,0])

    def test_aging_enforces_service_on_balanced_priority_stream(self):
        result=run_benchmark(BenchmarkRequest(preset="FAIRNESS_STREAM",policies=["PRIORITY","PRIORITY_AGING"],baseline="PRIORITY",seeds=[42]).model_dump())
        priority,aging=result["trials"]
        self.assertEqual(priority["jobs"][0]["accumulated_wait_seconds"],310)
        self.assertEqual(aging["jobs"][0]["accumulated_wait_seconds"],10)
        self.assertEqual(aging["metrics"]["starvation_rate_percent"],0)
        self.assertEqual(priority["metrics"]["makespan_seconds"],aging["metrics"]["makespan_seconds"])
        self.assertGreater(aging["metrics"]["p95_wait_seconds"],priority["metrics"]["p95_wait_seconds"])

    def test_bad_aging_rate_and_work_input_fail_before_mutation(self):
        for rate in [0,float("nan"),101]:
            with self.assertRaises(ValueError): Simulation(aging_rate=rate)
        engine=MultiUnitReservations({"C":1},{"A":{"C":1}})
        with self.assertRaises(ValueError): engine.record_work("A",float("nan"))


class BankerTests(unittest.TestCase):
    def test_three_modes_and_restart(self):
        for mode in ["NAIVE","AVOIDANCE","DETECT_RECOVER"]:
            run=ChallengeRun("C4",reservation_mode=mode)
            while not run.snapshot()["complete"]:
                snapshot=run.step()
                if mode=="AVOIDANCE":
                    self.assertIsNotNone(snapshot["reservations"]["safe_sequence"])
                    self.assertFalse(snapshot["reservations"]["deadlock"])
            state=run.snapshot()["reservations"]
            self.assertEqual(state["deadlock"], mode=="NAIVE")
            self.assertEqual(sum(task["status"]=="COMPLETED" for task in state["processes"]),0 if mode=="NAIVE" else 2)
            if mode=="DETECT_RECOVER":
                self.assertEqual(sum(task["restarts"] for task in state["processes"]),1)

    def test_200_fixed_seed_avoidance_sequences(self):
        for seed in range(200):
            rng=random.Random(seed)
            engine=MultiUnitReservations({"C":3,"M":3},{name:{"C":rng.randint(1,3),"M":rng.randint(1,3)} for name in ["A","B","C"]})
            for _ in range(25):
                name=rng.choice(list(engine.tasks))
                task=engine.tasks[name]
                if task["status"]=="COMPLETED" or task["pending"] is not None:
                    continue
                need={key:task["maximum"][key]-task["allocation"][key] for key in engine.capacities}
                if not any(need.values()): engine.complete(name)
                else:
                    key=rng.choice([key for key,n in need.items() if n])
                    engine.request(name,{key:1})
                self.assertFalse(engine.deadlocked())
                self.assertIsNotNone(engine.safe_sequence())
                engine.assert_invariants()

    def test_cost_weighted_recovery_and_impossible_claims(self):
        engine=MultiUnitReservations({"C":2,"M":2},{"A":{"C":2,"M":2},"B":{"C":2,"M":2}},mode="DETECT_RECOVER",victim_policy="COST_WEIGHTED")
        engine.request("A",{"C":2}); engine.request("B",{"M":2})
        engine.record_work("B",10)
        engine.request("A",{"M":2});engine.request("B",{"C":2})
        self.assertEqual(engine.recover()["process"],"A")
        self.assertEqual(engine.tasks["A"]["allocation"],{"C":0,"M":0})
        with self.assertRaises(ValueError): MultiUnitReservations({"C":1},{"A":{"C":2}})

    def test_optimized_python_keeps_invariant_checks(self):
        script="from app.services.reservations import ReservationSimulation; s=ReservationSimulation(); s.owners['G1']='ghost'; s.assert_invariants()"
        result=subprocess.run([sys.executable,"-O","-c",script],capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0)
        self.assertIn("InvariantError",result.stderr)
        engine=MultiUnitReservations({"C":1},{"A":{"C":1}})
        engine.tasks["A"]["allocation"]["C"]=2
        with self.assertRaises(InvariantError): engine.assert_invariants()


class SecurityTests(unittest.TestCase):
    def setUp(self):
        self.engine=Simulation()
        self.patcher=patch.object(jobs,"simulation",self.engine)
        self.patcher.start();self.addCleanup(self.patcher.stop)
        self.client=TestClient(app);self.addCleanup(self.client.close)

    def test_json_and_query_compatibility_and_bounds(self):
        spec={"name":"job","compute_required":1,"memory_required":1}
        self.assertEqual(self.client.post("/jobs/",json=spec).status_code,200)
        self.assertEqual(self.client.post("/jobs/",params=spec).status_code,200)
        for bad in [{**spec,"name":"x"*121},{**spec,"priority":10001},{**spec,"priority":True},{**spec,"compute_required":False}]:
            self.assertEqual(self.client.post("/jobs/",json=bad).status_code,422)
        self.assertEqual(self.client.post("/jobs/",json=spec,params={"priority":2}).status_code,400)
        self.assertEqual(len(self.engine.jobs),2)

    def test_atomic_batch_limit_and_reset_without_reused_ids(self):
        self.engine.max_jobs=2
        spec={"name":"job","compute_required":1,"memory_required":1}
        self.client.post("/jobs/",json=spec)
        self.assertEqual(self.client.post("/jobs/workload/generate",params={"count":10}).status_code,409)
        self.assertEqual(len(self.engine.jobs),1)
        self.client.post("/jobs/",json=spec)
        self.assertEqual(self.client.post("/jobs/",json=spec).status_code,409)
        lock=self.engine.lock
        self.assertEqual(self.client.post("/jobs/reset").json()["removed_jobs"],2)
        self.assertEqual(self.client.post("/jobs/reset").json()["removed_jobs"],0)
        self.assertIs(self.engine.lock,lock)
        self.assertEqual(self.client.post("/jobs/",json=spec).json()["job"]["job_id"],3)
        self.engine.assert_resource_invariants()

    def test_cors_origin_gate_and_optional_bearer_token(self):
        spec={"name":"job","compute_required":1,"memory_required":1}
        self.assertEqual(self.client.post("/jobs/",json=spec,headers={"Origin":"https://evil.example"}).status_code,403)
        with patch.dict(os.environ,{"GPU_ALLOCATOR_API_TOKEN":"test-only-secret"}):
            self.assertEqual(self.client.post("/jobs/",json=spec).status_code,401)
            self.assertEqual(self.client.post("/jobs/",json=spec,headers={"Authorization":"test-only-secret"}).status_code,401)
            self.assertEqual(self.client.post("/jobs/",json=spec,headers={"Authorization":"Bearer test-only-secret"}).status_code,200)
            self.assertEqual(self.client.get("/health").status_code,200)
        cors=self.client.options("/jobs/",headers={"Origin":"http://127.0.0.1:5173","Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"content-type"})
        self.assertEqual(cors.status_code,200)
        self.assertNotIn("access-control-allow-credentials",cors.headers)
        self.assertNotIn("*",cors.headers["access-control-allow-methods"])

    def test_security_headers_and_real_fragmentation_on_analytics(self):
        response=self.client.get("/studio/")
        self.assertEqual(response.headers["x-content-type-options"],"nosniff")
        self.assertIn("script-src 'self'",response.headers["content-security-policy"])
        self.assertEqual(response.headers["referrer-policy"],"no-referrer")
        self.assertIn("demand_fragmentation",self.engine.get_resource_analysis())
