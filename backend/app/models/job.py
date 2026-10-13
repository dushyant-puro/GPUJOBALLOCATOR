from datetime import datetime, timezone
import math


class Job:

    def __init__(
        self,
        job_id,
        name,
        compute_required,
        memory_required,
        accelerator_a_required=0,
        accelerator_b_required=0,
        priority=1,
        clock=None,
        duration_seconds=None,
        required_node_type=None
    ):
        if required_node_type is not None and (not isinstance(required_node_type, str) or not required_node_type.strip() or len(required_node_type) > 40):
            raise ValueError("Required node type must be a nonblank string of at most 40 characters.")
        self.required_node_type = required_node_type.strip() if required_node_type is not None else None
        if duration_seconds is not None and (
                not isinstance(duration_seconds, (int, float))
                or not math.isfinite(duration_seconds) or duration_seconds < 0.001):
            raise ValueError("Execution duration must be finite and at least 0.001 seconds.")
        self.duration_seconds = round(duration_seconds, 6) if duration_seconds is not None else None
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self.job_id = job_id
        self.name = name
        self.compute_required = compute_required
        self.memory_required = memory_required
        self.accelerator_a_required = accelerator_a_required
        self.accelerator_b_required = accelerator_b_required
        self.priority = priority

        self.status = "QUEUED"

        # GPU placement
        self.gpu_id = None

        self.queue_position = 0
        self.allocation_score = 0.0

        self.submitted_at = self._now()
        self.started_at = None
        self.waiting_started_at = None
        self.completed_at = None
        self.cancelled_at = None
        self.last_gpu_id = None
        self.placement_history = []
        self.decision_history = []
        self.intervals = []
        self._interval_started_at = self.submitted_at

    def _now(self):
        return self.clock()

    def _transition(self, status, allowed):
        if self.status not in allowed:
            raise ValueError(f"Cannot transition {self.status} to {status}.")
        now = self._now()
        if now < self._interval_started_at:
            raise ValueError("Job clock must not move backwards.")
        self.intervals.append({
            "status": self.status,
            "started_at": self._interval_started_at,
            "ended_at": now,
        })
        self.status = status
        self._interval_started_at = now
        return now

    def get_resource_request(self):
        return {
            "compute_units": self.compute_required,
            "memory": self.memory_required,
            "accelerator_a": self.accelerator_a_required,
            "accelerator_b": self.accelerator_b_required
        }

    def start(self):
        now = self._transition("RUNNING", {"QUEUED", "WAITING"})
        if self.started_at is None:
            self.started_at = now

    def wait(self):
        if self.is_waiting():
            return
        now = self._transition("WAITING", {"QUEUED", "RUNNING"})
        if self.waiting_started_at is None:
            self.waiting_started_at = now

    def complete(self):
        self.completed_at = self._transition("COMPLETED", {"RUNNING"})

    def cancel(self):
        self.cancelled_at = self._transition("CANCELLED", {"QUEUED", "WAITING", "RUNNING"})

    def is_queued(self):
        return self.status == "QUEUED"

    def is_running(self):
        return self.status == "RUNNING"

    def is_waiting(self):
        return self.status == "WAITING"

    def is_completed(self):
        return self.status == "COMPLETED"

    def is_cancelled(self):
        return self.status == "CANCELLED"

    @staticmethod
    def _seconds_between(start, end):
        if start is None or end is None:
            return 0.0

        return round(
            max(
                0.0,
                (end - start).total_seconds()
            ),
            2
        )

    def _end_time(self):
        return self.completed_at or self.cancelled_at or self._now()

    def get_queue_wait_seconds(self):
        """Time to first start; freezes on cancellation before first start."""
        return self._seconds_between(self.submitted_at, self.started_at or self._end_time())

    def _duration_in(self, states, rounded=True):
        seconds = sum(
            (interval["ended_at"] - interval["started_at"]).total_seconds()
            for interval in self.intervals if interval["status"] in states
        )
        if self.status in states:
            seconds += (self._end_time() - self._interval_started_at).total_seconds()
        return round(max(0.0, seconds), 2) if rounded else max(0.0, seconds)

    def get_waiting_duration_seconds(self):
        """Accumulated queue and waiting intervals, including preemption waits."""
        return self._duration_in({"QUEUED", "WAITING"})

    def get_execution_duration_seconds(self):
        """Accumulated RUNNING intervals; interrupted time is excluded."""
        return self._duration_in({"RUNNING"})

    def get_execution_progress_seconds(self):
        return self._duration_in({"RUNNING"}, rounded=False)

    def get_remaining_duration_seconds(self):
        if self.duration_seconds is None:
            return None
        return round(max(0.0, self.duration_seconds - self.get_execution_progress_seconds()), 6)

    def get_total_duration_seconds(self):
        return self._seconds_between(self.submitted_at, self._end_time())

    @staticmethod
    def _timestamp_to_string(timestamp):
        if timestamp is None:
            return None

        return timestamp.isoformat()

    def to_dict(self):
        return {
            "job_id": self.job_id,
            "name": self.name,

            "compute_required": self.compute_required,
            "memory_required": self.memory_required,
            "accelerator_a_required": self.accelerator_a_required,
            "accelerator_b_required": self.accelerator_b_required,

            "priority": self.priority,
            "required_node_type": self.required_node_type,
            "duration_seconds": self.duration_seconds,
            "remaining_duration_seconds": self.get_remaining_duration_seconds(),

            # GPU placement
            "gpu_id": self.gpu_id,
            "last_gpu_id": self.last_gpu_id,
            "placement_history": [dict(item) for item in self.placement_history],
            "intervals": [
                {"status": item["status"],
                 "started_at": item["started_at"].isoformat(),
                 "ended_at": item["ended_at"].isoformat()}
                for item in self.intervals
            ],

            "queue_position": self.queue_position,

            "allocation_score": round(
                float(self.allocation_score),
                2
            ),

            "status": self.status,

            "submitted_at": self._timestamp_to_string(
                self.submitted_at
            ),

            "started_at": self._timestamp_to_string(
                self.started_at
            ),

            "waiting_started_at": self._timestamp_to_string(
                self.waiting_started_at
            ),

            "completed_at": self._timestamp_to_string(
                self.completed_at
            ),

            "cancelled_at": self._timestamp_to_string(
                self.cancelled_at
            ),

            "queue_wait_seconds":
                self.get_queue_wait_seconds(),

            "waiting_duration_seconds":
                self.get_waiting_duration_seconds(),

            "execution_duration_seconds":
                self.get_execution_duration_seconds(),

            "total_duration_seconds":
                self.get_total_duration_seconds()
        }

    def __repr__(self):
        return (
            f"Job("
            f"id={self.job_id}, "
            f"name='{self.name}', "
            f"status='{self.status}', "
            f"priority={self.priority}, "
            f"gpu='{self.gpu_id}'"
            f")"
        )
