"""Declared multi-unit claims, Banker's avoidance, reduction detection and bounded restart."""
from copy import deepcopy
import math
from app.services.invariants import require


class MultiUnitReservations:
    def __init__(self, capacities, claims, mode="AVOIDANCE", victim_policy="ABORT_YOUNGEST_IN_CYCLE", restart_limit=3):
        if mode not in {"NAIVE", "AVOIDANCE", "DETECT_RECOVER"} or victim_policy not in {"ABORT_YOUNGEST_IN_CYCLE", "COST_WEIGHTED"}:
            raise ValueError("Unknown reservation mode or victim policy.")
        if not 1 <= restart_limit <= 10 or not capacities or any(type(n) is not int or n <= 0 for n in capacities.values()):
            raise ValueError("Capacities must be positive integers; restart limit is 1–10.")
        self.capacities = dict(capacities)
        self.mode, self.victim_policy, self.restart_limit = mode, victim_policy, restart_limit
        self.tasks, self.events = {}, []
        for name, maximum in claims.items():
            self._validate(maximum)
            if any(maximum.get(key, 0) > total for key, total in capacities.items()):
                raise ValueError("A maximum claim exceeds total capacity.")
            self.tasks[name] = {"id": name, "order": len(self.tasks), "maximum": self._vector(maximum),
                                "allocation": self._vector({}), "pending": None, "status": "RUNNING",
                                "restarts": 0, "work_done": 0}
        self.assert_invariants()

    def _vector(self, values):
        return {key: values.get(key, 0) for key in self.capacities}

    def _validate(self, values):
        if not isinstance(values, dict) or any(key not in self.capacities or type(n) is not int or n < 0 for key, n in values.items()):
            raise ValueError("Requests must use known types and nonnegative integer units.")

    def available(self, allocations=None):
        return {key: total - sum((allocations or {}).get(name, task["allocation"])[key] for name, task in self.tasks.items())
                for key, total in self.capacities.items()}

    def safe_sequence(self, allocations=None):
        work = self.available(allocations)
        remaining = [name for name, task in self.tasks.items() if task["status"] != "COMPLETED"]
        sequence = []
        while remaining:
            candidate = next((name for name in remaining if all(self.tasks[name]["maximum"][key] - (allocations or {}).get(name, self.tasks[name]["allocation"])[key] <= work[key] for key in work)), None)
            if candidate is None:
                return None
            for key in work:
                work[key] += (allocations or {}).get(candidate, self.tasks[candidate]["allocation"])[key]
            sequence.append(candidate)
            remaining.remove(candidate)
        return sequence

    def deadlocked(self):
        # Standard current-request reduction, not a cycle test for multi-instance resources.
        work = self.available()
        remaining = [name for name, task in self.tasks.items() if any(task["allocation"].values())]
        while remaining:
            candidate = next((name for name in remaining if self.tasks[name]["pending"] is None or all(self.tasks[name]["pending"][key] <= work[key] for key in work)), None)
            if candidate is None:
                break
            for key in work:
                work[key] += self.tasks[candidate]["allocation"][key]
            remaining.remove(candidate)
        return remaining

    def _event(self, action, process=None, **data):
        event = {"sequence": len(self.events)+1, "action": action, "process": process, **data}
        self.events.append(event)
        return deepcopy(event)

    def _can_grant(self, name, request):
        if any(amount > self.available()[key] for key, amount in request.items()):
            return False, "UNAVAILABLE"
        prospective = {name: {key: value + request[key] for key, value in self.tasks[name]["allocation"].items()}}
        if self.mode == "AVOIDANCE" and self.safe_sequence(prospective) is None:
            return False, "UNSAFE_STATE"
        return True, "SAFE" if self.mode == "AVOIDANCE" else "AVAILABLE"

    def request(self, name, values):
        self.assert_invariants()
        self._validate(values)
        if name not in self.tasks:
            raise ValueError("Unknown process.")
        task = self.tasks[name]
        request = self._vector(values)
        if task["status"] == "COMPLETED":
            return self._event("TERMINAL_NOOP", name)
        if task["pending"] is not None and task["pending"] != request:
            raise ValueError("A process may have one outstanding vector request.")
        if any(request[key] > task["maximum"][key] - task["allocation"][key] for key in request):
            raise ValueError("Request exceeds remaining maximum claim.")
        grant, reason = self._can_grant(name, request)
        if grant:
            for key in request:
                task["allocation"][key] += request[key]
            task.update(pending=None, status="RUNNING")
            result = self._event("GRANTED", name, request=request, reason=reason)
        else:
            task.update(pending=request, status="WAITING")
            result = self._event("WAITING", name, request=request, reason=reason)
        self.assert_invariants()
        return result

    def ensure(self, name, desired):
        self._validate(desired)
        if name not in self.tasks:
            raise ValueError("Unknown process.")
        if self.tasks[name]["pending"] is not None:
            return self._event("WAITING_NOOP", name, reason="Existing vector request remains pending")
        difference = {key: max(0, amount - self.tasks[name]["allocation"][key]) for key, amount in desired.items()}
        if not any(difference.values()):
            return self._event("ALREADY_HELD", name)
        return self.request(name, difference)

    def record_work(self, name, units):
        if name not in self.tasks or not isinstance(units, (int,float)) or not math.isfinite(units) or not 0 <= units <= 1_000_000:
            raise ValueError("Work must be a finite nonnegative simulated quantity for a known process.")
        self.tasks[name]["work_done"] += units
        return self._event("WORK_RECORDED", name, units=units)

    def _drain(self):
        granted = []
        for name, task in self.tasks.items():
            request = task["pending"]
            if request is not None and self._can_grant(name, request)[0]:
                self.request(name, request)
                granted.append(name)
        return granted

    def complete(self, name):
        self.assert_invariants()
        task = self.tasks.get(name)
        if task is None:
            return self._event("NOT_FOUND", name)
        if task["status"] == "COMPLETED":
            return self._event("TERMINAL_NOOP", name)
        if task["pending"] is not None or any(task["allocation"][key] < task["maximum"][key] for key in self.capacities):
            return self._event("BLOCKED_NOOP", name)
        released = task["allocation"].copy()
        task.update(allocation=self._vector({}), pending=None, status="COMPLETED")
        self._event("COMPLETED", name, released=released)
        granted = self._drain()
        self.assert_invariants()
        return {"action": "COMPLETED", "process": name, "released": released, "granted_processes": granted}

    def recover(self):
        self.assert_invariants()
        victims = [name for name in self.deadlocked() if self.tasks[name]["restarts"] < self.restart_limit]
        if self.mode != "DETECT_RECOVER" or not self.deadlocked():
            return self._event("NO_RECOVERY", reason="No recovery-enabled deadlock")
        if not victims:
            return self._event("RECOVERY_BLOCKED", reason="All deadlocked holders reached their restart limit; operator intervention required")
        if self.victim_policy == "COST_WEIGHTED":
            victim = min(victims, key=lambda name: (self.tasks[name]["work_done"] + sum(self.tasks[name]["allocation"].values()), -self.tasks[name]["order"]))
        else:
            victim = max(victims, key=lambda name: self.tasks[name]["order"])
        task = self.tasks[victim]
        released = task["allocation"].copy()
        task.update(allocation=self._vector({}), pending=task["maximum"].copy(), status="WAITING", restarts=task["restarts"]+1, work_done=0)
        self._event("ABORT_RESTART", victim, released=released, policy=self.victim_policy, restart_count=task["restarts"])
        granted = self._drain()
        self.assert_invariants()
        return {"action": "ABORT_RESTART", "process": victim, "released": released, "granted_processes": granted}

    def assert_invariants(self):
        for task in self.tasks.values():
            require(set(task["allocation"]) == set(self.capacities), "Wrong allocation dimensions")
            require(all(type(n) is int and 0 <= n <= task["maximum"][key] for key, n in task["allocation"].items()), "Allocation exceeds declared claim")
            require((task["status"] == "WAITING") == (task["pending"] is not None), "Pending request/state mismatch")
            require(task["status"] != "COMPLETED" or not any(task["allocation"].values()), "Completed process holds resources")
        require(all(0 <= n <= self.capacities[key] for key, n in self.available().items()), "Resource conservation violated")
        return True

    def snapshot(self):
        self.assert_invariants()
        edges = []
        for name, task in self.tasks.items():
            if task["pending"]:
                for key, amount in task["pending"].items():
                    if amount > self.available()[key]:
                        for owner, holding in self.tasks.items():
                            if owner != name and holding["allocation"][key]:
                                edges.append({"from": name, "to": owner, "resource": key})
        tasks = [{**deepcopy(task), "held": [f"{key}×{n}" for key,n in task["allocation"].items() if n]} for task in self.tasks.values()]
        resources = {key: ", ".join(f"{name} ({task['allocation'][key]})" for name, task in self.tasks.items() if task["allocation"][key]) or None for key in self.capacities}
        return {"multi_unit": True, "mode": self.mode, "resources": resources, "resource_vectors": {"total": self.capacities.copy(), "available": self.available()},
                "processes": tasks, "edges": edges, "cycles": [], "deadlocked_processes": self.deadlocked(), "deadlock": bool(self.deadlocked()),
                "safe_sequence": self.safe_sequence(), "events": deepcopy(self.events), "invariants_ok": True, "recovery_policy": self.victim_policy}
