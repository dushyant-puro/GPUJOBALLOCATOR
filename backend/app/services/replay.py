"""Deterministic event replay over an isolated, single-writer Simulation."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import math
import random
from threading import RLock
from time import monotonic
from uuid import uuid4

from app.models.job import Job
from app.services.simulation import Simulation
from app.services.workload_generator import WorkloadGenerator


MAX_REPLAY_JOBS = 200

EPOCH = datetime(2000, 1, 1, tzinfo=timezone.utc)
PRESETS = [
    {"id": "MIXED", "name": "Mixed arrivals", "description": "Seeded demand, staggered arrivals and varied runtimes."},
    {"id": "BURST", "name": "Burst traffic", "description": "A seeded batch arrives together and drains automatically."},
    {"id": "PREEMPTION", "name": "Urgent interruption", "description": "An urgent job interrupts a full GPU under PREEMPTIVE."},
    {"id": "INFEASIBLE", "name": "Impossible request", "description": "Valid jobs finish; an oversized request remains infeasible."},
]


class VirtualClock:
    def __init__(self):
        self.seconds = 0.0

    def __call__(self):
        return EPOCH + timedelta(seconds=self.seconds)

    def advance_to(self, seconds):
        if not math.isfinite(seconds) or seconds < self.seconds:
            raise ValueError("Virtual time must be finite and cannot move backwards.")
        self.seconds = round(seconds, 6)


def make_trace(preset="MIXED", seed=42, count=30):
    if preset not in {item["id"] for item in PRESETS}:
        raise ValueError("Unknown replay preset.")
    if not 1 <= count <= MAX_REPLAY_JOBS:
        raise ValueError("Replay count must be between 1 and 200.")
    if preset in {"MIXED", "BURST"}:
        rng = random.Random(seed)
        specs = WorkloadGenerator(seed=seed).generate(count=count, pattern="MIXED", name_prefix="Replay job")
        return [{**spec, "arrival_seconds": index * 2 if preset == "MIXED" else 0,
                 "duration_seconds": rng.randint(5, 25)} for index, spec in enumerate(specs)]
    full = dict(compute_required=8, memory_required=16, accelerator_a_required=4, accelerator_b_required=2)
    trace = [{**full, "name": f"Long job {index + 1}", "priority": 1,
              "arrival_seconds": 0, "duration_seconds": 20} for index in range(3)]
    if preset == "PREEMPTION":
        trace.append({**full, "name": "Urgent job", "priority": 5,
                      "arrival_seconds": 5, "duration_seconds": 4})
    else:
        trace.append({**full, "compute_required": 9, "name": "Oversized job", "priority": 1,
                      "arrival_seconds": 1, "duration_seconds": 10})
    return trace


class ReplayRun:
    def __init__(self, trace, policy="RESOURCE_BALANCED", name="Replay", wall_clock=monotonic):
        if policy not in Simulation.SUPPORTED_POLICIES:
            raise ValueError("Unknown scheduling policy.")
        if not trace or len(trace) > MAX_REPLAY_JOBS:
            raise ValueError("Replay requires between 1 and 200 jobs.")
        self.lock = RLock()
        self.run_id = str(uuid4())
        self.name = name
        self.policy = policy
        self.wall_clock = wall_clock
        self.speed = 1.0
        self._anchor = None
        # Stable trace index determines simultaneous-arrival IDs and tie ordering.
        self.trace = sorted([{**deepcopy(spec), "trace_index": index}
                             for index, spec in enumerate(trace)],
                            key=lambda spec: (spec["arrival_seconds"], spec["trace_index"]))
        for spec in self.trace:
            arrival = spec["arrival_seconds"]
            if not isinstance(arrival, (int, float)) or not math.isfinite(arrival) or arrival < 0:
                raise ValueError("Arrival time must be finite and nonnegative.")
            spec["arrival_seconds"] = round(arrival, 6)
            if spec.get("duration_seconds") is None:
                raise ValueError("Replay jobs require execution durations.")
            # Validate before allocating a run or modifying any cluster state.
            job = Job(1, clock=VirtualClock(), **self._job_spec(spec))
            validator = Simulation(clock=job.clock)
            validator.add_job(job)
        self.trace.sort(key=lambda spec: (spec["arrival_seconds"], spec["trace_index"]))
        self._reset()

    @staticmethod
    def _job_spec(spec):
        return {key: value for key, value in spec.items() if key not in {"arrival_seconds", "trace_index"}}

    def _reset(self):
        self.clock = VirtualClock()
        self.simulation = Simulation(clock=self.clock)
        self.simulation.scheduling_policy = self.policy
        capacities = self.simulation.get_total_resources()
        self.resource_time = {key: 0.0 for key in capacities}
        self._resource_work = {key: 0 for key in capacities}
        self._imbalance_scale = math.lcm(*(capacity for capacity in capacities.values() if capacity))
        self._imbalance_work = 0
        self.imbalance_time = 0.0
        self.cursor = 0
        self._last_decision_id = 0
        self.events = []
        self.status = "PAUSED"
        self._anchor = None
        self._process_timestamp()  # All time-zero arrivals are admitted together.

    def _event(self, kind, **data):
        self.events.append({"event_id": len(self.events) + 1,
                            "time_seconds": self.clock.seconds, "kind": kind, **data})

    def _process_timestamp(self):
        # Complete ALL jobs due now before considering arrivals or dispatching.
        completed = [job for job in self.simulation.get_running_jobs()
                     if job.get_remaining_duration_seconds() <= 0]
        for job in sorted(completed, key=lambda job: job.job_id):
            self.simulation.complete_job(job, dispatch=False)
        self._flush_decisions()
        while self.cursor < len(self.trace) and self.trace[self.cursor]["arrival_seconds"] <= self.clock.seconds:
            spec = self.trace[self.cursor]
            job = Job(self.simulation.job_sequence + 1, clock=self.clock, **self._job_spec(spec))
            self.simulation.add_job(job)
            job.trace_index = spec["trace_index"]
            job.wait()
            self._event("ARRIVAL", job_id=job.job_id, name=job.name)
            self.cursor += 1
        self.simulation.retry_waiting_jobs()
        self._flush_decisions()
        self.simulation.assert_resource_invariants()
        if self.cursor == len(self.trace) and not self.simulation.get_running_jobs():
            self.status = "STALLED" if self.simulation.get_waiting_jobs() else "COMPLETED"
            self._anchor = None

    def _flush_decisions(self):
        decisions = sorted([record for job in self.simulation.jobs for record in job.decision_history
                            if record["decision_id"] > self._last_decision_id],
                           key=lambda record: record["decision_id"])
        for decision in decisions:
            self._event(decision["decision"], job_id=decision["job_id"],
                        gpu_id=decision["gpu_id"], decision_id=decision["decision_id"])
        self._last_decision_id = self.simulation.decision_sequence

    def _next_event(self):
        times = []
        if self.cursor < len(self.trace):
            times.append(self.trace[self.cursor]["arrival_seconds"])
        times.extend(self.clock.seconds + job.get_remaining_duration_seconds()
                     for job in self.simulation.get_running_jobs())
        return round(min(times), 6) if times else None

    def _advance_clock(self, target):
        microseconds = round(target * 1_000_000) - round(self.clock.seconds * 1_000_000)
        # Integer resource-microseconds make integration independent of polling.
        total = self.simulation.get_total_resources()
        available = self.simulation.get_available_resources()
        scaled_usage = []
        for key, capacity in total.items():
            used = capacity - available[key]
            self._resource_work[key] += used * microseconds
            self.resource_time[key] = self._resource_work[key] / (capacity * 1_000_000) if capacity else 0.0
            scaled_usage.append(used * (self._imbalance_scale // capacity) if capacity else 0)
        self._imbalance_work += (max(scaled_usage) - min(scaled_usage)) * microseconds
        self.imbalance_time = self._imbalance_work / (self._imbalance_scale * 1_000_000)
        self.clock.advance_to(target)

    def _advance(self, target):
        if self.status in {"COMPLETED", "STALLED"}:
            return
        while (next_time := self._next_event()) is not None and next_time <= target:
            self._advance_clock(next_time)
            self._process_timestamp()
            if self.status in {"COMPLETED", "STALLED"}:
                return
        self._advance_clock(target)

    def _sync(self):
        if self.status == "PLAYING":
            now = self.wall_clock()
            target = self.clock.seconds + max(0, now - self._anchor) * self.speed
            self._advance(target)
            if self.status == "PLAYING":
                self._anchor = now

    def control(self, action, seconds=None, speed=None):
        with self.lock:
            # Validate before synchronizing so invalid requests have no side effects.
            if action not in {"play", "pause", "step", "advance", "reset", "speed"}:
                raise ValueError("Unknown replay action.")
            if action == "advance" and (seconds is None or not math.isfinite(seconds) or not 0 <= seconds <= 604800):
                raise ValueError("Advance seconds must be between 0 and 604800.")
            if action == "speed" and (speed is None or not math.isfinite(speed) or not 0.1 <= speed <= 100):
                raise ValueError("Playback speed must be between 0.1 and 100.")
            if action in {"step", "advance"} and self.status == "PLAYING":
                raise ValueError("Pause playback before stepping or advancing.")
            self._sync()
            if action == "reset":
                self._last_decision_id = 0
                self._reset()
            elif action == "play" and self.status == "PAUSED":
                self.status = "PLAYING"
                self._anchor = self.wall_clock()
            elif action == "pause" and self.status == "PLAYING":
                self.status = "PAUSED"
                self._anchor = None
            elif action == "speed":
                self.speed = speed
            elif action == "step" and (next_time := self._next_event()) is not None:
                self._advance(next_time)
            elif action == "advance":
                self._advance(round(self.clock.seconds + seconds, 6))
            return self._snapshot()

    def snapshot(self):
        with self.lock:
            self._sync()
            return self._snapshot()

    def event_page(self, offset=0, limit=200):
        with self.lock:
            self._sync()
            return {"events": deepcopy(self.events[offset:offset + limit]),
                    "total": len(self.events), "offset": offset, "limit": limit}

    def _snapshot(self):
        jobs = []
        for job in self.simulation.jobs:
            data = job.to_dict()
            data["trace_index"] = job.trace_index
            data["allocation_explanation"] = self.simulation.get_job_allocation_explanation(job)
            intervals = [{"status": interval["status"],
                          "start": (interval["started_at"] - EPOCH).total_seconds(),
                          "end": (interval["ended_at"] - EPOCH).total_seconds()}
                         for interval in job.intervals]
            if job.is_running() or job.is_waiting():
                intervals.append({"status": job.status,
                                  "start": (job._interval_started_at - EPOCH).total_seconds(),
                                  "end": self.clock.seconds})
            data["timeline"] = intervals
            jobs.append(data)
        pending = [deepcopy(spec) for spec in self.trace[self.cursor:]]
        elapsed = self.clock.seconds
        completed = len(self.simulation.get_completed_jobs())
        return {
            "run_id": self.run_id, "name": self.name, "policy": self.policy,
            "status": self.status, "speed": self.speed, "time_seconds": elapsed,
            "next_event_seconds": self._next_event(), "epoch": EPOCH.isoformat(),
            "jobs": jobs, "pending_jobs": pending, "total_jobs": len(self.trace),
            "resources": self.simulation.get_resource_analysis(), "events": deepcopy(self.events[-200:]),
            "event_count": len(self.events),
            "time_integrals": {"resource_seconds": deepcopy(self.resource_time), "imbalance_seconds": self.imbalance_time},
            "metrics": {"completed": completed, "running": len(self.simulation.get_running_jobs()),
                        "waiting": len(self.simulation.get_waiting_jobs()), "scheduled": len(pending),
                        "throughput_per_simulated_minute": round(completed * 60 / elapsed, 4) if elapsed else 0,
                        "mean_wait_seconds": round(sum(job.get_waiting_duration_seconds()
                                                       for job in self.simulation.get_completed_jobs()) / completed, 4) if completed else 0,
                        "makespan_seconds": elapsed if self.status == "COMPLETED" else None},
            "trace": deepcopy(self.trace),
        }


class ReplayRegistry:
    """Bounded, in-memory sessions; never references the legacy dashboard cluster."""
    def __init__(self, limit=20):
        self.lock = RLock()
        self.runs = {}
        self.limit = limit

    def create(self, trace, policy, name):
        with self.lock:
            if len(self.runs) >= self.limit:
                raise ValueError("Replay session limit reached. Delete a run before creating another.")
            run = ReplayRun(trace, policy=policy, name=name)
            self.runs[run.run_id] = run
            return run

    def get(self, run_id):
        with self.lock:
            if run_id not in self.runs:
                raise KeyError(run_id)
            return self.runs[run_id]

    def delete(self, run_id):
        with self.lock:
            run = self.get(run_id)
            with run.lock:
                run.control("pause")
                del self.runs[run_id]
