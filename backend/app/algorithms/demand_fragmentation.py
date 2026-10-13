"""Free-block concentration and stranded capacity relative to admitted waiting demand."""

DEFINITIONS = {
    "largest_free_block_ratio": "Per dimension: largest single-node free block / compatible cluster free units; null if no free units.",
    "external_fragmentation": "Per dimension: 1 minus largest-free-block ratio; zero if no free units. Overall is mean across dimensions with free units.",
    "stranded_capacity": "Free units on nodes where no feasible waiting job fits / cluster free units, per dimension; zero with no feasible waiting demand. Overall is mean across dimensions with free units.",
    "blocked_by_fragmentation": "Feasible waiting jobs that fit summed compatible-node free vectors but fit no single compatible node. Infeasible requests are excluded.",
}


def measure(simulation):
    nodes = list(simulation.gpu_selector.gpus.values())
    waiting = [job for job in simulation.jobs if (job.is_waiting() or job.is_queued())
               and any(item["fits_total_capacity"] for item in simulation.evaluate_candidates(job))]
    blocked = []
    for job in waiting:
        candidates = simulation.evaluate_candidates(job)
        compatible = [node for node in nodes if job.required_node_type is None or job.required_node_type == node.node_type]
        if not any(item["eligible"] for item in candidates) and all(amount <= sum(node.available[key] for node in compatible)
                                                                    for key, amount in job.get_resource_request().items()):
            blocked.append(job.job_id)
    stranded_nodes = [node for node in nodes if waiting and not any(
        (job.required_node_type is None or job.required_node_type == node.node_type) and node.can_allocate(job.get_resource_request()) for job in waiting)]
    dimensions = {}
    for key in nodes[0].total:
        free = sum(node.available[key] for node in nodes)
        largest = max(node.available[key] for node in nodes)
        dimensions[key] = {"total_free": free, "largest_free_block": largest,
                           "largest_free_block_ratio": largest / free if free else None,
                           "external_fragmentation": 1 - largest / free if free else 0,
                           "stranded_free_units": sum(node.available[key] for node in stranded_nodes),
                           "stranded_capacity": sum(node.available[key] for node in stranded_nodes) / free if free else 0}
    active = [item for item in dimensions.values() if item["total_free"]]
    return {"by_resource": dimensions,
            "external_fragmentation": sum(item["external_fragmentation"] for item in active) / len(active) if active else 0,
            "stranded_capacity": sum(item["stranded_capacity"] for item in active) / len(active) if active else 0,
            "blocked_by_fragmentation": len(blocked), "blocked_job_ids": blocked, "metric_definitions": DEFINITIONS}
