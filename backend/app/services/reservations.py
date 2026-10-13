"""Separate partial-acquisition simulator: unit resources and one pending request per process."""
from copy import deepcopy
from app.services.invariants import require
from app.algorithms.deadlock import DeadlockDetector


class ReservationSimulation:
    def __init__(self, resources=("G1", "G2")):
        if not resources or len(set(resources)) != len(resources):
            raise ValueError("Resources must be distinct.")
        self.owners = dict.fromkeys(resources)
        self.processes = {}
        self.events = []

    def _event(self, action, process=None, resource=None, **details):
        event = {"sequence": len(self.events) + 1, "action": action, "process": process,
                 "resource": resource, **details}
        self.events.append(event)
        return deepcopy(event)

    def request(self, process, resource):
        if resource not in self.owners:
            raise ValueError("Unknown reservation resource.")
        if process not in self.processes:
            self.processes[process] = {"id": process, "order": len(self.processes), "held": [],
                                       "waiting_for": None, "status": "RUNNING"}
        task = self.processes[process]
        if task["status"] in {"ABORTED", "COMPLETED"}:
            return self._event("TERMINAL_NOOP", process, resource)
        if task["waiting_for"] and task["waiting_for"] != resource:
            raise ValueError("A process may have only one outstanding request.")
        if self.owners[resource] == process:
            return self._event("ALREADY_HELD", process, resource)
        if self.owners[resource] is None:
            self.owners[resource] = process
            task["held"].append(resource)
            task["waiting_for"] = None
            task["status"] = "RUNNING"
            result = self._event("GRANTED", process, resource)
        else:
            task["waiting_for"] = resource
            task["status"] = "WAITING"
            result = self._event("WAITING", process, resource, owner=self.owners[resource])
        self.assert_invariants()
        return result

    def edges(self):
        return [{"from": task["id"], "to": self.owners[task["waiting_for"]], "resource": task["waiting_for"]}
                for task in self.processes.values() if task["waiting_for"] and self.owners[task["waiting_for"]]]

    def cycles(self):
        detector = DeadlockDetector()
        for edge in self.edges():
            detector.add_edge(edge["from"], edge["to"])
        if not detector.has_cycle():
            return []
        links = {edge["from"]: edge["to"] for edge in self.edges()}
        found, seen = [], set()
        for start in links:
            path = []
            cursor = start
            while cursor in links and cursor not in seen:
                if cursor in path:
                    cycle = path[path.index(cursor):]
                    found.append(cycle)
                    break
                path.append(cursor)
                cursor = links[cursor]
            seen.update(path)
        return found

    def _release(self, process, status):
        task = self.processes[process]
        released = list(task["held"])
        for resource in released:
            self.owners[resource] = None
        task.update(held=[], waiting_for=None, status=status)
        self._event(status, process, released=released)
        # Atomic release, then grant pending requests in process creation order.
        granted = []
        for pending in sorted(self.processes.values(), key=lambda item: item["order"]):
            resource = pending["waiting_for"]
            if resource and self.owners[resource] is None:
                self.request(pending["id"], resource)
                granted.append({"process": pending["id"], "resource": resource})
        self.assert_invariants()
        return {"action": status, "process": process, "released": released, "granted": granted}

    def recover(self):
        cycles = self.cycles()
        if not cycles:
            return self._event("NO_DEADLOCK")
        cycle = cycles[0]
        victim = max(cycle, key=lambda item: self.processes[item]["order"])
        self._event("RECOVERY", victim, cycle=cycle, policy="ABORT_YOUNGEST_IN_CYCLE")
        return self._release(victim, "ABORTED")

    def complete(self, process):
        if process not in self.processes:
            return self._event("NOT_FOUND", process)
        task = self.processes[process]
        if task["status"] in {"ABORTED", "COMPLETED"}:
            return self._event("TERMINAL_NOOP", process)
        if task["waiting_for"]:
            return self._event("BLOCKED_NOOP", process)
        return self._release(process, "COMPLETED")

    def assert_invariants(self):
        for resource, owner in self.owners.items():
            require(owner is None or (owner in self.processes and resource in self.processes[owner]["held"]), "Reservation ownership mismatch")
        for task in self.processes.values():
            require(len(task["held"]) == len(set(task["held"])), "Reservation accounting/state mismatch")
            require(all(self.owners[resource] == task["id"] for resource in task["held"]), "Reservation accounting/state mismatch")
            require((task["status"] == "WAITING") == (task["waiting_for"] is not None), "Reservation accounting/state mismatch")
            require(task["waiting_for"] is None or self.owners[task["waiting_for"]] not in (None, task["id"]), "Reservation accounting/state mismatch")
            require(task["status"] not in {"ABORTED", "COMPLETED"} or (not task["held"] and task["waiting_for"] is None), "Reservation accounting/state mismatch")
        return True

    def snapshot(self):
        return {"resources": deepcopy(self.owners), "processes": deepcopy(list(self.processes.values())),
                "edges": self.edges(), "cycles": self.cycles(), "deadlock": bool(self.cycles()),
                "events": deepcopy(self.events), "invariants_ok": self.assert_invariants(),
                "recovery_policy": "ABORT_YOUNGEST_IN_CYCLE"}
