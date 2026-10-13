"""Deterministic alternative placement rules; the historical scorer stays available."""
import math

RULES = ["NORMALIZED", "FIRST_FIT", "MEMORY_BEST_FIT", "BEST_FIT_PACKING", "ALIGNMENT"]


def packing_key(candidate, request):
    leftover = [(candidate["available_before"][key] - request[key]) / capacity
                for key, capacity in candidate["total"].items() if capacity > 0]
    return (max(leftover, default=0), sum(leftover), candidate["gpu_id"])


def alignment_score(candidate, request, waiting, alignment_weight, stranded_weight):
    keys = [key for key, total in candidate["total"].items() if total > 0]
    demand = [request[key] / candidate["total"][key] for key in keys]
    available = [candidate["available_before"][key] / candidate["total"][key] for key in keys]
    norm = math.sqrt(sum(x*x for x in demand) * sum(x*x for x in available))
    cosine = sum(x*y for x, y in zip(demand, available)) / norm if norm else 0
    remaining = {key: value - request[key] for key, value in candidate["available_before"].items()}
    fits = any((job.required_node_type is None or job.required_node_type == candidate["node_type"])
               and all(amount <= remaining[key] for key, amount in job.get_resource_request().items()) for job in waiting)
    penalty = sum(remaining[key] / candidate["total"][key] for key in keys) / len(keys) if waiting and not fits else 0
    candidate["alignment_components"] = {"cosine": cosine, "stranded_penalty": penalty,
                                         "alignment_weight": alignment_weight, "stranded_weight": stranded_weight}
    return alignment_weight * cosine - stranded_weight * penalty
