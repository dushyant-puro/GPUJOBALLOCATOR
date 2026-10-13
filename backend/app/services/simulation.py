from copy import deepcopy
from threading import RLock
from app.models.job import Job
from app.services.synchronization import synchronized
from app.algorithms.gpu_selection import GPUSelector
from datetime import datetime, timezone


class Simulation:

    # ==========================================
    # SUPPORTED SCHEDULING POLICIES
    # ==========================================

    SUPPORTED_POLICIES = [
        "FCFS",
        "PRIORITY",
        "SJF",
        "RESOURCE_EFFICIENT",
        "RESOURCE_BALANCED",
        "PREEMPTIVE"
    ]

    # ==========================================
    # INITIALIZATION
    # ==========================================

    def __init__(self, clock=None, nodes=None, placement_rule="NORMALIZED"):
        if placement_rule not in {"NORMALIZED", "FIRST_FIT", "MEMORY_BEST_FIT"}:
            raise ValueError("Unknown placement rule.")
        self.placement_rule = placement_rule
        self.lock = RLock()
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self.state_version = 0
        self.resource_version = 0
        self.decision_sequence = 0
        self._allocations = {}

        # ==========================================
        # MULTI-GPU CLUSTER
        # ==========================================

        self.gpu_selector = GPUSelector(
            gpu_count=3, nodes=nodes
        )

        # Keep GPU-0 available through the legacy
        # self.gpu reference for compatibility.
        self.gpu = next(iter(self.gpu_selector.get_all_gpus().values()))

        self.jobs = []
        self.job_sequence = 0
        self.scheduling_policy = "RESOURCE_BALANCED"
        self.preemption_count = 0
        self.preempted_job_ids = []

        # ==========================================
        # HISTORICAL ANALYTICS
        # ==========================================

        self.analytics_started_at = self.clock()
        self.completed_job_history = []
        self.cancelled_job_history = []
        self.allocation_attempts = 0
        self.successful_allocations = 0
        self.total_preemptions = 0

        # ==========================================
        # WORKLOAD / STRESS TEST HISTORY
        # ==========================================

        self.workload_batches = []
        self.stress_test_runs = []

    # ==========================================
    # JOB MANAGEMENT
    # ==========================================

    @synchronized
    def add_job(self, job):
        if any(existing.job_id == job.job_id for existing in self.jobs):
            raise ValueError("Duplicate job ID.")
        if not job.is_queued():
            raise ValueError("Only queued jobs can be submitted.")
        request = self.get_job_resource_request(job)
        if (not job.name.strip() or job.priority < 1
                or request["compute_units"] <= 0 or request["memory"] <= 0
                or any(not isinstance(amount, int) or amount < 0 for amount in request.values())):
            raise ValueError("Invalid job specification.")
        self.job_sequence = max(self.job_sequence + 1, job.job_id)
        job.queue_position = self.job_sequence
        self.jobs.append(job)
        self.state_version += 1

    @synchronized
    def submit_job(self, **spec):
        job = Job(job_id=self.job_sequence + 1, clock=self.clock, **spec)
        if job.required_node_type is not None and not any(candidate["fits_total_capacity"] for candidate in self.evaluate_candidates(job)):
            raise ValueError(f"No compatible node has sufficient total capacity for type {job.required_node_type}.")
        self.add_job(job)
        job.wait()
        self.retry_waiting_jobs()
        return job

    @synchronized
    def get_jobs(self):
        return list(self.jobs)

    @synchronized
    def get_job_resource_request(self, job):
        return {
            "compute_units": job.compute_required,
            "memory": job.memory_required,
            "accelerator_a": job.accelerator_a_required,
            "accelerator_b": job.accelerator_b_required
        }

    # ==========================================
    # GPU PLACEMENT HELPERS
    # ==========================================

    @synchronized
    def get_job_gpu_id(self, job):

        return getattr(
            job,
            "gpu_id",
            None
        )

    @synchronized
    def set_job_gpu_id(self, job, gpu_id):

        job.gpu_id = gpu_id

    @synchronized
    def can_allocate_on_any_gpu(self, request):

        return bool(
            self.gpu_selector.get_candidate_gpus(
                request
            )
        )

    @synchronized
    def select_best_gpu(self, request):

        return self.gpu_selector.select_best_gpu(
            request
        )

    @synchronized
    def allocate_on_best_gpu(self, job):
        if job not in self.jobs or not (job.is_queued() or job.is_waiting()):
            return None
        if job.job_id in self._allocations:
            raise RuntimeError("Job already owns resources.")
        self.allocation_attempts += 1
        candidates = self.evaluate_candidates(job)
        eligible = [candidate for candidate in candidates if candidate["eligible"]]
        if not eligible:
            job.last_failed_resource_version = self.resource_version
            job.last_failed_policy = self.scheduling_policy
            self.record_decision(job, "INFEASIBLE" if not any(
                candidate["fits_total_capacity"] for candidate in candidates
            ) else "WAITING", candidates=candidates)
            return None
        if self.placement_rule == "FIRST_FIT":
            selected = eligible[0]
        elif self.placement_rule == "MEMORY_BEST_FIT":
            for candidate in eligible:
                candidate["remaining_memory_after"] = candidate["available_before"]["memory"] - job.memory_required
            selected = min(eligible, key=lambda item: (item["remaining_memory_after"], -item["score"], item["gpu_id"]))
        else:
            selected = min(eligible, key=lambda item: (-item["score"], item["gpu_id"]))
        gpu_id = selected["gpu_id"]
        request = self.get_job_resource_request(job)
        # Snapshot evaluated state and policy before committing resources.
        self.record_decision(job, "ALLOCATED", candidates=candidates,
                             gpu_id=gpu_id, score=selected["score"])
        if not self.gpu_selector.get_gpu(gpu_id).allocate(request):
            raise RuntimeError("Selected allocation became infeasible inside the lock.")
        self._allocations[job.job_id] = (gpu_id, request.copy())
        job.gpu_id = gpu_id
        job.last_gpu_id = gpu_id
        job.allocation_score = selected["score"]
        job.start()
        job.placement_history.append({"gpu_id": gpu_id, "started_at": self.clock().isoformat()})
        self.successful_allocations += 1
        self.state_version += 1
        self.resource_version += 1
        return {"gpu_id": gpu_id, "score": selected["score"]}

    @synchronized
    def evaluate_candidates(self, job):
        request = self.get_job_resource_request(job)
        candidates = []
        for gpu_id, gpu in self.gpu_selector.get_all_gpus().items():
            available = gpu.get_available_resources()
            total = gpu.get_total_resources()
            deficits = {key: amount - available[key] for key, amount in request.items()
                        if amount > available[key]}
            capacity_deficits = {key: amount - total[key] for key, amount in request.items()
                                 if amount > total[key]}
            components = gpu.get_allocation_score_components(request)
            compatible = job.required_node_type is None or job.required_node_type == gpu.node_type
            candidates.append({
                "gpu_id": gpu_id, "node_type": gpu.node_type, "compatible": compatible,
                "required_node_type": job.required_node_type,
                "eligible": components["eligible"] and compatible,
                "score": components["score"], "score_components": components,
                "available_before": available, "total": total,
                "blocking_resources": deficits,
                "capacity_deficits": capacity_deficits,
                "fits_total_capacity": not capacity_deficits and compatible,
            })
        return candidates

    @synchronized
    def record_decision(self, job, decision, candidates=None, gpu_id=None, score=0.0, state_before=None):
        if (decision in {"WAITING", "INFEASIBLE"} and job.decision_history
                and job.decision_history[-1]["decision"] == decision
                and job.decision_history[-1]["policy"] == self.scheduling_policy
                and job.decision_history[-1]["candidates"] == (candidates or [])):
            return job.decision_history[-1]
        self.decision_sequence += 1
        headlines = {
            "ALLOCATED": f"{gpu_id} selected by the scheduler.",
            "WAITING": "Temporarily blocked by occupied GPU resources.",
            "INFEASIBLE": "No compatible GPU has sufficient total capacity.",
            "PREEMPTED": "Resources released so another job can run.",
            "COMPLETED": "Job completed; its resources were released.",
            "CANCELLED": "Job cancelled; it no longer holds resources.",
        }
        reasons = {
            "ALLOCATED": ["All requested resources fit in the recorded pre-allocation state.",
                          "Highest candidate score wins; GPU ID breaks score ties.",
                          "Score uses resource balance, imbalance change and normalized footprint."],
            "WAITING": ["At least one GPU has sufficient total capacity, but none currently fits.",
                        "Release of the listed blocking resources may allow allocation."],
            "INFEASIBLE": ["Waiting or preempting jobs cannot make this request fit.",
                           "Reduce the request or configure a compatible GPU with sufficient capacity."],
            "PREEMPTED": ["The job returned to the waiting queue; running time is preserved."],
            "COMPLETED": ["The job has reached its terminal state."],
            "CANCELLED": ["The job has reached its terminal state."],
        }
        record = {
            "decision_id": self.decision_sequence, "job_id": job.job_id,
            "recorded_at": self.clock().isoformat(), "state_version": self.state_version,
            "resource_version": self.resource_version,
            "job_state_before": state_before or job.status, "decision": decision,
            "allocated": decision == "ALLOCATED", "gpu_id": gpu_id,
            "score": score, "headline": headlines[decision], "reasons": reasons[decision],
            "policy": self.scheduling_policy, "candidates": deepcopy(candidates or []),
            "resource_request": self.get_job_resource_request(job),
            "tie_breaker": "score descending, GPU ID ascending",
            "scoring_version": "normalized-footprint-v2",
            "placement_rule": self.placement_rule,
        }
        if decision == "ALLOCATED" and self.placement_rule != "NORMALIZED":
            explanation = ("First eligible node in configured order wins." if self.placement_rule == "FIRST_FIT" else "Smallest remaining memory wins among vector-feasible nodes; break ties by score, then GPU ID.")
            record["reasons"] = ["Compute, memory, accelerators and node type all fit.", explanation]
            record["tie_breaker"] = explanation
        job.decision_history.append(record)
        return record

    @synchronized
    def get_job_allocation_explanation(self, job):
        if job.decision_history:
            record = deepcopy(job.decision_history[-1])
            if job.is_completed() or job.is_cancelled():
                record["last_allocation"] = next((deepcopy(item) for item in reversed(job.decision_history)
                                                  if item["decision"] == "ALLOCATED"), None)
            return record
        return {"decision": job.status, "allocated": False, "gpu_id": None,
                "score": 0.0, "headline": "Job has not been evaluated yet.",
                "reasons": [], "candidates": [], "policy": None}

    @synchronized
    def get_job_decisions(self, job):
        return deepcopy(job.decision_history)

    @synchronized
    def release_job_resources(self, job):
        if job not in self.jobs:
            return False
        allocation = self._allocations.get(job.job_id)
        if allocation is None:
            return False
        gpu_id, request = allocation
        self.gpu_selector.get_gpu(gpu_id).release(request)
        del self._allocations[job.job_id]
        job.gpu_id = None
        if job.placement_history:
            job.placement_history[-1]["ended_at"] = self.clock().isoformat()
        self.state_version += 1
        self.resource_version += 1
        return True

    @synchronized
    def assert_resource_invariants(self):
        for gpu_id, gpu in self.gpu_selector.get_all_gpus().items():
            used = {resource: 0 for resource in gpu.total}
            for assigned_id, request in self._allocations.values():
                if assigned_id == gpu_id:
                    for resource, amount in request.items():
                        used[resource] += amount
            for resource, capacity in gpu.total.items():
                if gpu.available[resource] != capacity - used[resource]:
                    raise AssertionError(f"Resource conservation failed: {gpu_id}/{resource}")
            if any(not 0 <= gpu.available[key] <= capacity for key, capacity in gpu.total.items()):
                raise AssertionError("Resources out of bounds.")
        for job in self.jobs:
            allocation = self._allocations.get(job.job_id)
            if job.is_running() != (allocation is not None):
                raise AssertionError("Running state and resource ownership differ.")
            if job.gpu_id != (allocation[0] if allocation else None):
                raise AssertionError("GPU assignment and resource ownership differ.")
        return True

    @synchronized
    def calculate_job_allocation_score(self, job):
        if job.is_running():
            return job.allocation_score
        candidates = [item for item in self.evaluate_candidates(job) if item["eligible"]]
        return max((item["score"] for item in candidates), default=0.0)

    @synchronized
    def try_allocate_job(self, job):
        if job not in self.jobs or not (job.is_queued() or job.is_waiting()):
            return False
        allocation = self.allocate_on_best_gpu(job)
        if allocation is not None:
            return True
        job.wait()
        job.allocation_score = 0.0
        if self.scheduling_policy == "PREEMPTIVE":
            return self.try_preempt_for_job(job)
        return False

    @synchronized
    def complete_job(self, job, dispatch=True):
        if job not in self.jobs or not job.is_running():
            return False
        gpu_id = job.gpu_id
        if not self.release_job_resources(job):
            raise RuntimeError("Running job has no owned resources.")
        job.complete()
        self.record_decision(job, "COMPLETED", gpu_id=gpu_id, state_before="RUNNING")
        self.completed_job_history.append(self.finished_job_snapshot(job, "completed_at"))
        if dispatch:
            self.retry_waiting_jobs()
        return True

    @synchronized
    def finished_job_snapshot(self, job, timestamp_field):
        return {
            "job_id": job.job_id, timestamp_field: getattr(job, timestamp_field).isoformat(),
            "queue_wait_seconds": job.get_queue_wait_seconds(),
            "waiting_duration_seconds": job.get_waiting_duration_seconds(),
            "execution_duration_seconds": job.get_execution_duration_seconds(),
            "total_duration_seconds": job.get_total_duration_seconds(),
            "gpu_id": job.last_gpu_id,
            "placement_history": deepcopy(job.placement_history),
        }

    @synchronized
    def cancel_job(self, job):
        if job not in self.jobs or job.is_completed() or job.is_cancelled():
            return False
        gpu_id = job.gpu_id
        if job.is_running() and not self.release_job_resources(job):
            raise RuntimeError("Running job has no owned resources.")
        state_before = job.status
        job.cancel()
        self.state_version += 1
        self.record_decision(job, "CANCELLED", gpu_id=gpu_id, state_before=state_before)
        self.cancelled_job_history.append(self.finished_job_snapshot(job, "cancelled_at"))
        self.retry_waiting_jobs()
        return True

    @synchronized
    def calculate_resource_efficiency_for_gpu(
        self,
        job,
        gpu
    ):

        total_resources = gpu.get_total_resources()
        request = self.get_job_resource_request(job)

        normalized_footprints = []

        resource_pairs = [
            (
                request.get("compute_units", 0),
                total_resources.get("compute_units", 0)
            ),
            (
                request.get("memory", 0),
                total_resources.get("memory", 0)
            ),
            (
                request.get("accelerator_a", 0),
                total_resources.get("accelerator_a", 0)
            ),
            (
                request.get("accelerator_b", 0),
                total_resources.get("accelerator_b", 0)
            )
        ]

        for requested, capacity in resource_pairs:

            if capacity <= 0 or requested <= 0:
                continue

            footprint = requested / capacity

            footprint = max(
                0.0,
                min(footprint, 1.0)
            )

            normalized_footprints.append(
                footprint
            )

        if not normalized_footprints:
            return 100.0

        average_footprint = (
            sum(normalized_footprints)
            / len(normalized_footprints)
        )

        return round(
            (1.0 - average_footprint) * 100,
            2
        )

    @synchronized
    def calculate_resource_efficiency(self, job):
        """
        Calculate resource efficiency against the individual
        GPU nodes in the cluster. A smaller normalized resource
        footprint produces a higher efficiency score.
        """

        gpu_ids = self.gpu_selector.get_gpu_ids()

        if not gpu_ids:
            return 0.0

        scores = []

        for gpu_id in gpu_ids:

            gpu = self.gpu_selector.get_gpu(
                gpu_id
            )

            if gpu is None:
                continue

            if not gpu.can_allocate(
                self.get_job_resource_request(job)
            ):
                continue

            scores.append(
                self.calculate_resource_efficiency_for_gpu(
                    job,
                    gpu
                )
            )

        if not scores:
            return 0.0

        return round(
            max(scores),
            2
        )

    # ==========================================
    # JOB SIZE
    # ==========================================

    @synchronized
    def calculate_job_size(self, job):
        request = self.get_job_resource_request(job)
        return min(sum(request[key] / capacity for key, capacity in gpu.total.items()
                       if capacity > 0)
                   for gpu in self.gpu_selector.get_all_gpus().values())

    @synchronized
    def sort_jobs_by_policy(self, jobs):
        jobs = list(jobs)
        policy = self.scheduling_policy

        if policy == "FCFS":
            return sorted(
                jobs,
                key=lambda job: job.queue_position
            )

        if policy == "PRIORITY":
            return sorted(
                jobs,
                key=lambda job: (
                    -job.priority,
                    job.queue_position
                )
            )

        if policy == "SJF":
            timed = all(job.duration_seconds is not None for job in jobs)
            return sorted(
                jobs,
                key=lambda job: (
                    job.get_remaining_duration_seconds() if timed else self.calculate_job_size(job),
                    job.queue_position
                )
            )

        if policy == "RESOURCE_EFFICIENT":
            return sorted(
                jobs,
                key=lambda job: (
                    -self.calculate_resource_efficiency(job),
                    job.queue_position
                )
            )

        if policy == "RESOURCE_BALANCED":
            return sorted(jobs, key=lambda job: (
                -self.calculate_job_allocation_score(job), -job.priority, job.queue_position
            ))

        if policy == "PREEMPTIVE":
            return sorted(
                jobs,
                key=lambda job: (
                    -job.priority,
                    job.queue_position
                )
            )

        return sorted(
            jobs,
            key=lambda job: job.queue_position
        )

    # ==========================================
    # UPDATE WAITING JOB SCORES
    # ==========================================

    @synchronized
    def update_waiting_job_scores(self):
        for job in self.jobs:
            if job.is_waiting():
                job.allocation_score = self.calculate_job_allocation_score(job)

    # ==========================================
    # PREEMPTION DECISION
    # ==========================================

    @synchronized
    def should_preempt(self, waiting_job, running_job):
        if not waiting_job.is_waiting():
            return False

        if not running_job.is_running():
            return False

        policy = self.scheduling_policy

        if policy == "PREEMPTIVE":
            if waiting_job.priority > running_job.priority:
                return True

            if waiting_job.priority == running_job.priority:
                return (
                    waiting_job.queue_position
                    < running_job.queue_position
                )

            return False

        if policy == "PRIORITY":
            return waiting_job.priority > running_job.priority

        if policy == "SJF":
            return (
                self.calculate_job_size(waiting_job)
                < self.calculate_job_size(running_job)
            )

        if policy == "RESOURCE_EFFICIENT":
            return (
                self.calculate_resource_efficiency(waiting_job)
                > self.calculate_resource_efficiency(running_job)
            )

        if policy == "RESOURCE_BALANCED":
            waiting_score = self.calculate_job_allocation_score(waiting_job)
            running_score = self.calculate_job_allocation_score(running_job)

            return (
                waiting_score > running_score
                and waiting_job.priority >= running_job.priority
            )

        if policy == "FCFS":
            return waiting_job.queue_position < running_job.queue_position

        return False

    # ==========================================
    # SELECT PREEMPTION VICTIM
    # ==========================================

    @synchronized
    def select_preemption_victim(self, waiting_job):
        running_jobs = self.get_running_jobs()

        if not running_jobs:
            return None

        eligible_jobs = [
            job
            for job in running_jobs
            if self.should_preempt(waiting_job, job)
            and self.victim_enables_allocation(waiting_job, job)
        ]

        if not eligible_jobs:
            return None

        if self.scheduling_policy in (
            "PREEMPTIVE",
            "PRIORITY"
        ):
            return min(
                eligible_jobs,
                key=lambda job: (
                    job.priority,
                    -job.queue_position
                )
            )

        if self.scheduling_policy == "SJF":
            return max(
                eligible_jobs,
                key=lambda job: (
                    self.calculate_job_size(job),
                    -job.queue_position
                )
            )

        if self.scheduling_policy == "RESOURCE_EFFICIENT":
            return min(
                eligible_jobs,
                key=lambda job: (
                    self.calculate_resource_efficiency(job),
                    job.queue_position
                )
            )

        if self.scheduling_policy == "RESOURCE_BALANCED":
            return min(
                eligible_jobs,
                key=lambda job: (
                    self.calculate_job_allocation_score(job),
                    job.priority
                )
            )

        return max(
            eligible_jobs,
            key=lambda job: job.queue_position
        )

    # ==========================================
    # PREEMPT RUNNING JOB
    # ==========================================

    @synchronized
    def preempt_job(self, job):
        if job not in self.jobs or not job.is_running():
            return False
        gpu_id = job.gpu_id
        if not self.release_job_resources(job):
            return False
        job.wait()
        job.allocation_score = 0.0
        self.record_decision(job, "PREEMPTED", gpu_id=gpu_id, state_before="RUNNING")
        self.preemption_count += 1
        if job.job_id not in self.preempted_job_ids:
            self.preempted_job_ids.append(job.job_id)
        return True

    @synchronized
    def victim_enables_allocation(self, waiting_job, victim):
        allocation = self._allocations.get(victim.job_id)
        if allocation is None:
            return False
        gpu_id, released = allocation
        if waiting_job.required_node_type is not None and self.gpu_selector.get_gpu(gpu_id).node_type != waiting_job.required_node_type:
            return False
        available = self.gpu_selector.get_gpu(gpu_id).available
        return all(amount <= available[key] + released[key]
                   for key, amount in self.get_job_resource_request(waiting_job).items())

    @synchronized
    def try_preempt_for_job(self, waiting_job):
        if waiting_job not in self.jobs or not waiting_job.is_waiting():
            return False
        if any(candidate["eligible"] for candidate in self.evaluate_candidates(waiting_job)):
            return self.allocate_on_best_gpu(waiting_job) is not None
        victim = self.select_preemption_victim(waiting_job)
        if victim is None:
            return False
        if not self.preempt_job(victim):
            return False
        # Victim sufficiency was checked against copied resource arithmetic.
        if self.allocate_on_best_gpu(waiting_job) is None:
            raise RuntimeError("Preemption failed despite verified capacity.")
        return True

    @synchronized
    def run_preemption_pass(self):
        if self.scheduling_policy != "PREEMPTIVE":
            return False

        waiting_jobs = [
            job
            for job in self.jobs
            if job.is_waiting()
            and (getattr(job, "last_failed_resource_version", None) != self.resource_version
                 or getattr(job, "last_failed_policy", None) != self.scheduling_policy)
        ]

        if not waiting_jobs:
            return False

        self.update_waiting_job_scores()

        ordered_jobs = self.sort_jobs_by_policy(waiting_jobs)
        preempted_any = False

        for job in ordered_jobs:
            if not job.is_waiting():
                continue

            if self.try_preempt_for_job(job):
                preempted_any = True

        return preempted_any

    # ==========================================
    # RETRY WAITING JOBS
    # ==========================================

    @synchronized
    def retry_waiting_jobs(self):

        waiting_jobs = [
            job
            for job in self.jobs
            if job.is_waiting()
            and (getattr(job, "last_failed_resource_version", None) != self.resource_version
                 or getattr(job, "last_failed_policy", None) != self.scheduling_policy)
        ]

        if not waiting_jobs:
            return

        if self.scheduling_policy == "PREEMPTIVE":

            self.run_preemption_pass()

            waiting_jobs = [
                job
                for job in self.jobs
                if job.is_waiting()
            ]

            if not waiting_jobs:
                return

        self.update_waiting_job_scores()

        ordered_jobs = self.sort_jobs_by_policy(
            waiting_jobs
        )

        for job in ordered_jobs:

            if not job.is_waiting():
                continue

            allocation = self.allocate_on_best_gpu(
                job
            )

            if allocation is None:
                continue

            job.allocation_score = round(
                float(allocation["score"]),
                2
            )

        self.update_waiting_job_scores()

    # ==========================================
    # WAITING JOBS
    # ==========================================

    @synchronized
    def get_waiting_jobs(self):
        waiting_jobs = [
            job
            for job in self.jobs
            if job.is_waiting()
        ]

        return self.sort_jobs_by_policy(waiting_jobs)

    # ==========================================
    # RUNNING JOBS
    # ==========================================

    @synchronized
    def get_running_jobs(self):
        return [
            job
            for job in self.jobs
            if job.is_running()
        ]

    # ==========================================
    # COMPLETED JOBS
    # ==========================================

    @synchronized
    def get_completed_jobs(self):
        return [
            job
            for job in self.jobs
            if job.is_completed()
        ]

    # ==========================================
    # CANCELLED JOBS
    # ==========================================

    @synchronized
    def get_cancelled_jobs(self):
        return [
            job
            for job in self.jobs
            if job.is_cancelled()
        ]

    # ==========================================
    # DEADLOCK DETECTION
    # ==========================================

    @synchronized
    def detect_deadlock(self):
        """Not applicable: this model has no dependencies or partial acquisition."""
        return None

    @synchronized
    def get_deadlock_status(self):
        diagnostics = self.get_queue_diagnostics()
        return {
            "deadlock_detected": None, "supported": False, "status": "NOT_APPLICABLE",
            "reason": "Jobs acquire all resources together; no dependency graph is modeled.",
            **diagnostics,
        }

    @synchronized
    def get_queue_diagnostics(self):
        blocked = []
        infeasible = []
        for job in self.jobs:
            if not (job.is_queued() or job.is_waiting()):
                continue
            candidates = self.evaluate_candidates(job)
            if any(candidate["eligible"] for candidate in candidates):
                continue
            destination = blocked if any(candidate["fits_total_capacity"] for candidate in candidates) else infeasible
            destination.append({"job_id": job.job_id, "candidates": candidates})
        return {"blocked_jobs": blocked, "infeasible_jobs": infeasible,
                "blocked_count": len(blocked), "infeasible_count": len(infeasible)}

    @synchronized
    def get_metric_definitions(self):
        return {
            "resource_imbalance": "max(resource utilization %) - min(resource utilization %)",
            "fragmentation": "Deprecated alias for resource imbalance, not demand-aware fragmentation",
            "allocation_efficiency": "Heuristic: max(0, mean utilization % - 0.5 * imbalance)",
            "successful_allocation_rate": "Successful placements / all placement attempts, including retries",
            "average_waiting_time": "Accumulated QUEUED and WAITING intervals; historical mean uses completed jobs only",
            "queue_wait_seconds": "Submission to first start, or cancellation if never started",
            "deadlock_detected": "null: unsupported by the all-at-once resource model",
        }

    @synchronized
    def get_total_resources(self):

        return self.gpu_selector.get_cluster_total_resources()

    @synchronized
    def get_available_resources(self):

        return self.gpu_selector.get_cluster_available_resources()

    @synchronized
    def get_utilization(self):

        total = self.get_total_resources()
        available = self.get_available_resources()

        utilization = {}

        for resource, total_amount in total.items():

            if total_amount <= 0:
                utilization[resource] = 0.0
                continue

            used = (
                total_amount
                - available.get(resource, 0)
            )

            utilization[resource] = round(
                (used / total_amount) * 100,
                2
            )

        return utilization

    @synchronized
    def get_availability_percentage(self):

        total = self.get_total_resources()
        available = self.get_available_resources()
        result = {}

        for resource, total_amount in total.items():

            if total_amount <= 0:
                result[resource] = 0.0
                continue

            result[resource] = round(
                (
                    available.get(resource, 0)
                    / total_amount
                ) * 100,
                2
            )

        return result

    @synchronized
    def get_fragmentation(self):

        utilization = self.get_utilization()

        if not utilization:
            return {}

        values = list(
            utilization.values()
        )

        average_utilization = (
            sum(values) / len(values)
        )

        return {
            resource: round(
                abs(
                    value - average_utilization
                ),
                2
            )
            for resource, value
            in utilization.items()
        }

    @synchronized
    def get_overall_fragmentation(self):

        utilization = self.get_utilization()

        if not utilization:
            return 0.0

        values = list(
            utilization.values()
        )

        return round(
            min(
                max(values) - min(values),
                100
            ),
            2
        )

    @synchronized
    def get_resource_imbalance(self):
        return self.get_overall_fragmentation()

    @synchronized
    def get_fragmentation_level(self):

        fragmentation = (
            self.get_overall_fragmentation()
        )

        if fragmentation <= 20:
            return "LOW"

        if fragmentation <= 50:
            return "MEDIUM"

        return "HIGH"

    @synchronized
    def get_allocation_efficiency(self):

        utilization = self.get_utilization()

        if not utilization:
            return 100.0

        values = list(
            utilization.values()
        )

        average_utilization = (
            sum(values) / len(values)
        )

        fragmentation = (
            self.get_overall_fragmentation()
        )

        efficiency = (
            average_utilization
            - (fragmentation * 0.5)
        )

        return round(
            max(
                0.0,
                min(efficiency, 100.0)
            ),
            2
        )

    @synchronized
    def get_resource_balance_score(self):

        fragmentation = (
            self.get_overall_fragmentation()
        )

        return round(
            max(
                0.0,
                min(100.0 - fragmentation, 100.0)
            ),
            2
        )

    @synchronized
    def get_resource_analysis(self):

        analysis = {
            "total": self.get_total_resources(),
            "available": self.get_available_resources(),
            "utilization": self.get_utilization(),
            "availability": self.get_availability_percentage(),
            "fragmentation": self.get_fragmentation(),
            "resource_imbalance": self.get_overall_fragmentation(),
            "metric_definitions": self.get_metric_definitions(),
            "queue_diagnostics": self.get_queue_diagnostics(),
            "overall_fragmentation": (
                self.get_overall_fragmentation()
            ),
            "fragmentation_level": (
                self.get_fragmentation_level()
            ),
            "allocation_efficiency": (
                self.get_allocation_efficiency()
            ),
            "resource_balance_score": (
                self.get_resource_balance_score()
            ),
            "gpu_count": len(
                self.gpu_selector.get_gpu_ids()
            ),
            "gpus": self.gpu_selector.get_gpu_analysis()
        }

        return analysis

    # ==========================================
    # SCHEDULING POLICY
    # ==========================================

    @synchronized
    def get_scheduling_policy(self):
        return {
            "policy": self.scheduling_policy,
            "available_policies": list(self.SUPPORTED_POLICIES),
            "policy_descriptions": {"SJF": "Remaining runtime for timed jobs; normalized resource demand for untimed queues",
                                    "FCFS": "Queue arrival order with feasible-job backfilling"}
        }

    @synchronized
    def set_scheduling_policy(self, policy):
        if policy is None:
            return False

        normalized_policy = str(policy).strip().upper()

        if normalized_policy not in self.SUPPORTED_POLICIES:
            return False

        self.scheduling_policy = normalized_policy
        self.state_version += 1

        self.update_waiting_job_scores()
        self.retry_waiting_jobs()

        return True

    # ==========================================
    # PREEMPTION STATISTICS
    # ==========================================

    @synchronized
    def get_preemption_statistics(self):
        return {
            "preemption_count": self.preemption_count,
            "preempted_job_ids": list(self.preempted_job_ids),
            "preemptive_scheduling": (
                self.scheduling_policy == "PREEMPTIVE"
            )
        }

    # ==========================================
    # WORKLOAD / STRESS TEST HISTORY
    # ==========================================

    @synchronized
    def record_workload_batch(self, result):
        self.workload_batches.append(deepcopy(result))

        # Keep the in-memory simulation lightweight while still
        # retaining enough recent history for dashboard reporting.
        if len(self.workload_batches) > 20:
            self.workload_batches = self.workload_batches[-20:]

    @synchronized
    def record_stress_test(self, result):
        self.stress_test_runs.append(deepcopy(result))

        if len(self.stress_test_runs) > 20:
            self.stress_test_runs = self.stress_test_runs[-20:]

    @synchronized
    def get_workload_statistics(self):
        return {
            "workload_batches": len(self.workload_batches),
            "stress_test_runs": len(self.stress_test_runs),
            "recent_workload_batches": deepcopy(self.workload_batches[-10:]),
            "recent_stress_tests": deepcopy(self.stress_test_runs[-10:])
        }

    # ==========================================
    # HISTORICAL ANALYTICS
    # ==========================================

    @synchronized
    def get_historical_analytics(self):

        now = self.clock()

        elapsed_seconds = max(
            0.0,
            (now - self.analytics_started_at).total_seconds()
        )

        completed_jobs = [
            job for job in self.jobs
            if job.is_completed()
        ]

        cancelled_jobs = [
            job for job in self.jobs
            if job.is_cancelled()
        ]

        finished_jobs = completed_jobs

        if finished_jobs:
            average_waiting_time = round(
                sum(
                    job.get_waiting_duration_seconds()
                    for job in finished_jobs
                ) / len(finished_jobs),
                2
            )

            average_execution_time = round(
                sum(
                    job.get_execution_duration_seconds()
                    for job in finished_jobs
                ) / len(finished_jobs),
                2
            )

            average_total_duration = round(
                sum(
                    job.get_total_duration_seconds()
                    for job in finished_jobs
                ) / len(finished_jobs),
                2
            )
        else:
            average_waiting_time = 0.0
            average_execution_time = 0.0
            average_total_duration = 0.0

        completed_count = len(completed_jobs)
        total_submitted = len(self.jobs)

        successful_allocation_rate = (
            round(
                (
                    self.successful_allocations
                    / self.allocation_attempts
                ) * 100,
                2
            )
            if self.allocation_attempts > 0
            else 0.0
        )

        throughput_per_minute = (
            round(
                completed_count
                / (elapsed_seconds / 60),
                2
            )
            if elapsed_seconds > 0
            else 0.0
        )

        throughput_per_hour = (
            round(
                completed_count
                / (elapsed_seconds / 3600),
                2
            )
            if elapsed_seconds > 0
            else 0.0
        )

        try:
            cluster_utilization = self.get_utilization()
        except Exception:
            cluster_utilization = {}

        try:
            allocation_efficiency = (
                self.get_allocation_efficiency()
            )
        except Exception:
            allocation_efficiency = 0.0

        try:
            fragmentation = (
                self.get_overall_fragmentation()
            )
        except Exception:
            fragmentation = 0.0

        return {
            "analytics_started_at":
                self.analytics_started_at.isoformat(),

            "analytics_elapsed_seconds":
                round(elapsed_seconds, 2),

            "total_submitted_jobs":
                total_submitted,

            "completed_jobs":
                completed_count,

            "cancelled_jobs":
                len(cancelled_jobs),

            "active_jobs":
                len([
                    job for job in self.jobs
                    if job.is_running() or job.is_waiting()
                ]),

            "average_waiting_time":
                average_waiting_time,

            "average_execution_time":
                average_execution_time,

            "average_total_duration":
                average_total_duration,

            "throughput_per_minute":
                throughput_per_minute,

            "throughput_per_hour":
                throughput_per_hour,

            "allocation_attempts":
                self.allocation_attempts,

            "successful_allocations":
                self.successful_allocations,

            "successful_allocation_rate":
                successful_allocation_rate,

            "allocation_efficiency":
                allocation_efficiency,

            "resource_imbalance": fragmentation,
            "metric_definitions": self.get_metric_definitions(),
            "fragmentation":
                fragmentation,

            "cluster_utilization":
                cluster_utilization,

            "gpu_count":
                len(self.gpu_selector.get_gpu_ids()),

            "gpu_utilization":
                self.gpu_selector.get_gpu_utilization(),

            "gpu_availability":
                self.gpu_selector.get_gpu_availability(),

            "preemption_count":
                self.preemption_count,

            "completed_history":
                deepcopy(self.completed_job_history),

            "cancelled_history":
                deepcopy(self.cancelled_job_history)
        }

    # ==========================================
    # STATISTICS
    # ==========================================

    @synchronized
    def get_statistics(self):
        queued_jobs = [
            job for job in self.jobs
            if job.is_queued()
        ]

        waiting_jobs = [
            job for job in self.jobs
            if job.is_waiting()
        ]

        running_jobs = [
            job for job in self.jobs
            if job.is_running()
        ]

        completed_jobs = [
            job for job in self.jobs
            if job.is_completed()
        ]

        cancelled_jobs = [
            job for job in self.jobs
            if job.is_cancelled()
        ]

        completed_or_running = [
            job
            for job in self.jobs
            if job.is_completed() or job.is_running()
        ]

        if completed_or_running:
            average_waiting_time = round(
                sum(
                    job.get_waiting_duration_seconds()
                    for job in completed_or_running
                ) / len(completed_or_running),
                2
            )
        else:
            average_waiting_time = 0.0

        execution_jobs = [
            job
            for job in self.jobs
            if job.is_completed() or job.is_running()
        ]

        if execution_jobs:
            average_execution_time = round(
                sum(
                    job.get_execution_duration_seconds()
                    for job in execution_jobs
                ) / len(execution_jobs),
                2
            )
        else:
            average_execution_time = 0.0

        try:
            utilization = self.get_utilization()
        except Exception:
            utilization = {}

        try:
            allocation_efficiency = self.get_allocation_efficiency()
        except Exception:
            allocation_efficiency = 0.0

        try:
            fragmentation = self.get_overall_fragmentation()
        except Exception:
            fragmentation = 0.0

        return {
            "total_jobs": len(self.jobs),
            "queued_jobs": len(queued_jobs),
            "waiting_jobs": len(waiting_jobs),
            "running_jobs": len(running_jobs),
            "completed_jobs": len(completed_jobs),
            "cancelled_jobs": len(cancelled_jobs),
            "average_waiting_time": average_waiting_time,
            "average_execution_time": average_execution_time,
            "utilization": utilization,
            "allocation_efficiency": allocation_efficiency,
            "resource_imbalance": fragmentation,
            "metric_definitions": self.get_metric_definitions(),
            "fragmentation": fragmentation,
            "deadlock_detected": self.detect_deadlock(),
            "scheduling_policy": self.scheduling_policy,
            "gpu_count": len(
                self.gpu_selector.get_gpu_ids()
            ),
            "gpu_utilization": (
                self.gpu_selector.get_gpu_utilization()
            ),
            "gpu_availability": (
                self.gpu_selector.get_gpu_availability()
            ),
            "preemption_count": self.preemption_count,
            "preempted_job_ids": list(self.preempted_job_ids),
            "preemptive_scheduling": (
                self.scheduling_policy == "PREEMPTIVE"
            )
        }
