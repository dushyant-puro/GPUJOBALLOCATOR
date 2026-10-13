from time import perf_counter


class StressTester:
    """Run repeatable scheduler workload tests against a Simulation."""

    SUPPORTED_SIZES = [
        10,
        50,
        100,
        500,
        1000
    ]

    def run(
        self,
        simulation,
        workload_specs,
        pattern="MIXED"
    ):
        start = perf_counter()

        jobs_before = len(
            simulation.get_jobs()
        )

        attempts_before = (
            simulation.allocation_attempts
        )

        successful_before = (
            simulation.successful_allocations
        )

        generated = 0
        allocated = 0
        waiting = 0
        queued = 0

        for spec in workload_specs:

            job = simulation.submit_job(**spec)

            generated += 1

            if job.is_running():
                allocated += 1

            elif job.is_waiting():
                waiting += 1

            elif job.is_queued():
                queued += 1

        elapsed = perf_counter() - start

        attempts_delta = (
            simulation.allocation_attempts
            - attempts_before
        )

        successful_delta = (
            simulation.successful_allocations
            - successful_before
        )

        allocation_success_rate = (
            round(
                (
                    successful_delta
                    / attempts_delta
                ) * 100,
                2
            )
            if attempts_delta > 0
            else 0.0
        )

        jobs_per_second = (
            round(
                generated / elapsed,
                2
            )
            if elapsed > 0
            else 0.0
        )

        return {
            "test_type": "submission_batch",
            "completes_jobs": False,
            "pattern": pattern,

            "generated_jobs": generated,

            "jobs_before": jobs_before,

            "jobs_after": len(
                simulation.get_jobs()
            ),

            "allocated_jobs": allocated,

            "waiting_jobs": waiting,

            "queued_jobs": queued,

            "allocation_attempts": attempts_delta,

            "successful_allocations": successful_delta,

            "allocation_success_rate": allocation_success_rate,

            "processing_time_ms": round(
                elapsed * 1000,
                2
            ),

            "jobs_per_second": jobs_per_second,

            "running_jobs_after": len(
                simulation.get_running_jobs()
            ),

            "waiting_jobs_after": len(
                simulation.get_waiting_jobs()
            ),

            "total_jobs_after": len(
                simulation.get_jobs()
            )
        }