"""Interactive, isolated executions of the organizer's five challenge setups."""
from copy import deepcopy
from threading import RLock
from uuid import uuid4

from app.services.replay import VirtualClock
from app.services.simulation import Simulation
from app.services.reservations import ReservationSimulation
from app.services.banker import MultiUnitReservations


def node(gpu_id, compute, memory, kind="GENERIC"):
    return {"gpu_id": gpu_id, "compute_units": compute, "memory": memory, "node_type": kind}


def submit(name, compute, memory, kind=None):
    return {"action": "submit", "label": f"Submit {name} ({compute}, {memory})" + (f" · type {kind}" if kind else ""),
            "spec": {"name": name, "compute_required": compute, "memory_required": memory, "required_node_type": kind}}


CATALOG = {
    "C1": {"id": "C1", "code": "KO-03-C1", "title": "Vector fit and release", "difficulty": "Easy",
           "mechanism": "All resource dimensions must fit on the same node. A release retries waiting jobs.",
           "nodes": [node("N1", 4, 8)], "steps": [submit("J1", 2, 6), submit("J2", 3, 3), {"action": "complete", "job_id": 1, "label": "Release J1; retry J2"}],
           "assumptions": ["Jobs acquire compute and memory atomically; accelerator requests are zero."]},
    "C2": {"id": "C2", "code": "KO-03-C2", "title": "Repeat cancellation", "difficulty": "Medium",
           "mechanism": "The ownership ledger permits one release. Repeated or unknown cancellation changes no resources.",
           "nodes": [node("N1", 4, 8)], "steps": [submit("J1", 2, 6), {"action": "cancel", "job_id": 1, "label": "Cancel J1"},
                                                     {"action": "cancel", "job_id": 1, "label": "Cancel J1 again"}, {"action": "cancel", "job_id": 99, "label": "Cancel unknown J99"}],
           "assumptions": ["Terminal jobs stay in the record. Unknown IDs are reported as NOT_FOUND."]},
    "C3": {"id": "C3", "code": "KO-03-C3", "title": "Fragmentation counterexample", "difficulty": "Medium",
           "mechanism": "Compare node-order first fit with memory best fit. Both obey vector feasibility; they strand different capacity.",
           "nodes": [node("N1", 4, 8), node("N2", 8, 4)], "steps": [submit("J1", 4, 4), submit("J2", 4, 8), submit("J3", 8, 4)],
           "assumptions": ["Jobs arrive in the stated order and retain resources. No future arrivals are inspected.",
                           "Memory best fit minimizes remaining memory among feasible nodes, then uses score and ID ties.",
                           "This trace admits two jobs under both rules. Memory utilization improves at the expense of compute utilization; there is no aggregate utilization win."]},
    "C4": {"id": "C4", "code": "KO-03-C4", "title": "Circular wait recovery", "difficulty": "Hard",
           "mechanism": "A wait-for graph detects the cycle. Abort its youngest process, release its holdings, then grant pending requests.",
           "nodes": [], "steps": [{"action": "reserve", "process": "A", "resource": "G1", "label": "A reserves G1"},
                                     {"action": "reserve", "process": "B", "resource": "G2", "label": "B reserves G2"},
                                     {"action": "reserve", "process": "A", "resource": "G2", "label": "A requests G2"},
                                     {"action": "reserve", "process": "B", "resource": "G1", "label": "B requests G1; detect cycle"},
                                     {"action": "recover", "label": "Recover: abort B and release G2"},
                                     {"action": "finish", "process": "A", "label": "Complete A; restore both resources"}],
           "assumptions": ["A separate partial-acquisition simulation uses two unit resources and one pending request per process.",
                           "The ordinary GPU scheduler still acquires a full vector atomically. Aborted work is not restarted automatically."]},
    "C5": {"id": "C5", "code": "KO-03-C5", "title": "Compatible-node constraint", "difficulty": "Hard",
           "mechanism": "Node type and total capacity are admission gates. Reject impossible demand without placing it ahead of feasible jobs.",
           "nodes": [node("N1", 4, 8, "X"), node("N2", 8, 4, "Y")],
           "steps": [submit("J0", 1, 1, "Z"), submit("J1", 2, 4, "X"), submit("J2", 2, 2, "Y")],
           "assumptions": ["Exact, case-sensitive node-type matching. An absent required type allows any node.",
                           "Rejected requests hold no resources and do not consume a job ID."]},
}


class ChallengeRun:
    def __init__(self, challenge_id, reservation_mode="LEGACY", victim_policy="ABORT_YOUNGEST_IN_CYCLE", restart_limit=3):
        self.lock = RLock()
        self.run_id = str(uuid4())
        self.definition = deepcopy(CATALOG[challenge_id])
        self.reservation_mode, self.victim_policy, self.restart_limit = reservation_mode, victim_policy, restart_limit
        if reservation_mode != "LEGACY":
            if challenge_id != "C4":
                raise ValueError("Reservation modes apply only to C4.")
            self.definition["steps"] = [
                {"action":"ensure", "process":"A", "amounts":{"Compute":2}, "label":"A requests 2 Compute"},
                {"action":"ensure", "process":"B", "amounts":{"Memory":2}, "label":"B requests 2 Memory"},
                {"action":"ensure", "process":"A", "amounts":{"Memory":2}, "label":"A requests 2 Memory"},
                {"action":"ensure", "process":"B", "amounts":{"Compute":2}, "label":"B requests 2 Compute"},
                {"action":"recover", "label":"Evaluate recovery"},
                {"action":"finish", "process":"A", "label":"Complete A if its claim is held"},
                {"action":"ensure", "process":"B", "amounts":{"Compute":2}, "label":"Retry B's Compute claim"},
                {"action":"finish", "process":"B", "label":"Complete B if its claim is held"}]
            self.definition["mechanism"] = f"Multi-unit mode {reservation_mode}: total (2 Compute, 2 Memory); A and B each declare maximum (2,2)."
            self.definition["assumptions"] = ["Declared maximum claims. Multi-instance deadlock uses current-request reduction; avoidance uses Banker's safe-sequence check.", "Recovery restarts a victim with zero holdings and requeues its full claim. After the restart limit it is protected; unresolved recovery is reported, never hidden.", "No hardware is used. Cost-weighted recovery uses accumulated work plus held units, with youngest-process ties."]
        self.reset()

    def reset(self):
        with self.lock:
            self.clock = VirtualClock()
            self.step_index = 0
            self.events = []
            self.history = []
            self.rejections = []
            self.reservations = (ReservationSimulation() if self.reservation_mode == "LEGACY" else MultiUnitReservations({"Compute":2,"Memory":2},{"A":{"Compute":2,"Memory":2},"B":{"Compute":2,"Memory":2}},mode=self.reservation_mode,victim_policy=self.victim_policy,restart_limit=self.restart_limit)) if self.definition["id"] == "C4" else None
            rules = [("First fit", "FIRST_FIT"), ("Memory best fit", "MEMORY_BEST_FIT")] if self.definition["id"] == "C3" else [("Vector allocator", "NORMALIZED")]
            self.engines = {} if self.reservations else {label: Simulation(clock=self.clock, nodes=self.definition["nodes"], placement_rule=rule) for label, rule in rules}
            for engine in self.engines.values():
                engine.scheduling_policy = "FCFS"
            snapshot = self.snapshot()
            self.history.append(deepcopy(snapshot))
            return snapshot

    def step(self):
        with self.lock:
            if self.step_index >= len(self.definition["steps"]):
                return self.snapshot()
            operation = self.definition["steps"][self.step_index]
            self.clock.advance_to(self.step_index + 1)
            outcomes = []
            if self.reservations:
                action = operation["action"]
                if action == "ensure":
                    result = self.reservations.ensure(operation["process"], operation["amounts"])
                elif action == "reserve":
                    result = self.reservations.request(operation["process"], operation["resource"])
                elif action == "recover":
                    result = self.reservations.recover()
                else:
                    result = self.reservations.complete(operation["process"])
                outcomes.append(result)
            else:
                for label, engine in self.engines.items():
                    before = engine.get_available_resources()
                    if operation["action"] == "submit":
                        try:
                            job = engine.submit_job(**operation["spec"])
                            result = {"status": job.status, "job_id": job.job_id, "job": job.name, "gpu_id": job.gpu_id,
                                      "decision": engine.get_job_allocation_explanation(job)}
                        except ValueError as error:
                            rejection = {**operation["spec"], "status": "REJECTED", "reason": str(error), "engine": label}
                            self.rejections.append(rejection)
                            result = {"status": "REJECTED", "job": operation["spec"]["name"], "reason": str(error)}
                    else:
                        job = next((item for item in engine.jobs if item.job_id == operation["job_id"]), None)
                        if job is None:
                            result = {"status": "NOT_FOUND", "job_id": operation["job_id"], "changed": False}
                        else:
                            changed = engine.cancel_job(job) if operation["action"] == "cancel" else engine.complete_job(job)
                            result = {"status": job.status, "job_id": job.job_id, "job": job.name, "changed": changed,
                                      "outcome": "APPLIED" if changed else "ALREADY_TERMINAL"}
                    outcomes.append({"engine": label, "before": before, "after": engine.get_available_resources(), **result})
                    engine.assert_resource_invariants()
            self.step_index += 1
            self.events.append({"sequence": self.step_index, "operation": deepcopy(operation), "outcomes": deepcopy(outcomes)})
            snapshot = self.snapshot()
            self.history.append(deepcopy(snapshot))
            return snapshot

    def _engine_snapshot(self, label, engine):
        gpus = [{"gpu_id": gpu_id, "node_type": gpu.node_type, "total": gpu.total.copy(), "available": gpu.available.copy(),
                 "jobs": [job.name for job in engine.jobs if job.gpu_id == gpu_id]} for gpu_id, gpu in engine.gpu_selector.gpus.items()]
        jobs = [{**job.to_dict(), "allocation_explanation": engine.get_job_allocation_explanation(job)} for job in engine.jobs]
        total, available = engine.get_total_resources(), engine.get_available_resources()
        compute = (total["compute_units"] - available["compute_units"]) / total["compute_units"] * 100
        memory = (total["memory"] - available["memory"]) / total["memory"] * 100
        return {"label": label, "placement_rule": engine.placement_rule, "nodes": gpus, "jobs": jobs,
                "available": available, "total": total, "compute_utilization": round(compute, 2), "memory_utilization": round(memory, 2),
                "aggregate_utilization": round((compute + memory) / 2, 2),
                "running": len(engine.get_running_jobs()), "waiting": len(engine.get_waiting_jobs()),
                "invariants_ok": engine.assert_resource_invariants()}

    def snapshot(self):
        with self.lock:
            return {"run_id": self.run_id, "definition": deepcopy(self.definition), "step_index": self.step_index,
                    "complete": self.step_index == len(self.definition["steps"]),
                    "engines": [self._engine_snapshot(label, engine) for label, engine in self.engines.items()],
                    "reservations": self.reservations.snapshot() if self.reservations else None,
                    "rejections": deepcopy(self.rejections), "events": deepcopy(self.events),
                    "invariants_ok": all(engine.assert_resource_invariants() for engine in self.engines.values()) and (self.reservations is None or self.reservations.assert_invariants())}

    def evidence(self):
        with self.lock:
            return {"schema_version": 1, "engine_version": "organizer-challenges-v1", "run": self.snapshot(),
                    "snapshots": deepcopy(self.history), "note": "Executed steps only. Unit counts and virtual timestamps are simulated."}


class ChallengeRegistry:
    def __init__(self, limit=32):
        self.limit = limit
        self.runs = {}
        self.lock = RLock()

    def create(self, challenge_id, **options):
        with self.lock:
            if len(self.runs) >= self.limit:
                raise ValueError("Challenge session limit reached. Reuse or delete an existing session.")
            run = ChallengeRun(challenge_id, **options)
            self.runs[run.run_id] = run
            return run

    def get(self, run_id):
        with self.lock:
            return self.runs[run_id]

    def delete(self, run_id):
        with self.lock:
            if run_id not in self.runs:
                raise KeyError(run_id)
            del self.runs[run_id]
