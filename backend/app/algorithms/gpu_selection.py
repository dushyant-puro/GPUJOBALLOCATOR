from app.algorithms.allocation import GPUResourceManager


class GPUSelector:

    # ==========================================
    # INITIALIZATION
    # ==========================================

    def __init__(self, gpu_count=3, nodes=None):

        if nodes is not None:
            if not nodes or len(nodes) > 32:
                raise ValueError("Configure between 1 and 32 GPU nodes.")
            self.gpus = {}
            for node in nodes:
                gpu_id = node["gpu_id"]
                if not isinstance(gpu_id, str) or not gpu_id.strip() or gpu_id in self.gpus:
                    raise ValueError("GPU IDs must be distinct nonblank strings.")
                capacities = {key: node.get(key, 0) for key in ("compute_units", "memory", "accelerator_a", "accelerator_b")}
                if any(type(value) is not int or value < 0 for value in capacities.values()) or capacities["compute_units"] <= 0 or capacities["memory"] <= 0:
                    raise ValueError("Node capacities require positive compute/memory and nonnegative integer accelerators.")
                gpu = GPUResourceManager(**capacities)
                gpu.node_type = node.get("node_type", "GENERIC")
                if not isinstance(gpu.node_type, str) or not gpu.node_type.strip():
                    raise ValueError("Node type cannot be blank.")
                self.gpus[gpu_id] = gpu
            return

        if gpu_count <= 0:
            raise ValueError(
                "GPU count must be greater than 0."
            )

        self.gpus = {}

        for gpu_index in range(gpu_count):

            gpu_id = f"GPU-{gpu_index}"

            self.gpus[gpu_id] = GPUResourceManager()
            self.gpus[gpu_id].node_type = "GENERIC"

    # ==========================================
    # GET GPU
    # ==========================================

    def get_gpu(self, gpu_id):

        return self.gpus.get(gpu_id)

    # ==========================================
    # GET ALL GPUS
    # ==========================================

    def get_all_gpus(self):

        return self.gpus

    # ==========================================
    # GET GPU IDS
    # ==========================================

    def get_gpu_ids(self):

        return list(
            self.gpus.keys()
        )

    # ==========================================
    # FIND GPUs THAT CAN HANDLE THE JOB
    # ==========================================

    def get_candidate_gpus(self, request):

        candidates = []

        for gpu_id, gpu in self.gpus.items():

            if gpu.can_allocate(request):

                candidates.append(
                    gpu_id
                )

        return candidates

    # ==========================================
    # CALCULATE GPU SCORE
    # ==========================================

    def calculate_gpu_score(
        self,
        gpu_id,
        request
    ):

        gpu = self.get_gpu(gpu_id)

        if gpu is None:
            return 0.0

        if not gpu.can_allocate(request):
            return 0.0

        try:

            score = gpu.get_allocation_score(
                request
            )

            return round(
                float(score),
                2
            )

        except Exception:

            return 0.0

    # ==========================================
    # SELECT BEST GPU
    # ==========================================

    def select_best_gpu(self, request):

        candidates = (
            self.get_candidate_gpus(request)
        )

        if not candidates:

            return None

        scored_gpus = []

        for gpu_id in candidates:

            score = self.calculate_gpu_score(
                gpu_id,
                request
            )

            gpu = self.get_gpu(gpu_id)

            available = (
                gpu.get_available_resources()
            )

            scored_gpus.append(
                {
                    "gpu_id": gpu_id,
                    "score": score,
                    "available": available
                }
            )

        # Highest allocation score wins.
        #
        # GPU ID is used as a deterministic
        # tie-breaker.

        scored_gpus.sort(
            key=lambda item: (
                -item["score"],
                item["gpu_id"]
            )
        )

        return scored_gpus[0]

    # ==========================================
    # ALLOCATE TO BEST GPU
    # ==========================================

    def allocate_to_best_gpu(self, request):

        selection = self.select_best_gpu(
            request
        )

        if selection is None:

            return None

        gpu_id = selection["gpu_id"]

        gpu = self.get_gpu(gpu_id)

        success = gpu.allocate(
            request
        )

        if not success:

            return None

        return {
            "gpu_id": gpu_id,
            "score": selection["score"],
            "available": (
                gpu.get_available_resources()
            )
        }

    # ==========================================
    # RELEASE FROM GPU
    # ==========================================

    def release_from_gpu(
        self,
        gpu_id,
        request
    ):

        gpu = self.get_gpu(gpu_id)

        if gpu is None:

            return False

        gpu.release(
            request
        )

        return True

    # ==========================================
    # GPU UTILIZATION
    # ==========================================

    def get_gpu_utilization(self):

        result = {}

        for gpu_id, gpu in self.gpus.items():

            result[gpu_id] = (
                gpu.get_utilization()
            )

        return result

    # ==========================================
    # GPU AVAILABILITY
    # ==========================================

    def get_gpu_availability(self):

        result = {}

        for gpu_id, gpu in self.gpus.items():

            result[gpu_id] = (
                gpu.get_availability_percentage()
            )

        return result

    # ==========================================
    # GPU FRAGMENTATION
    # ==========================================

    def get_gpu_fragmentation(self):

        result = {}

        for gpu_id, gpu in self.gpus.items():

            result[gpu_id] = {
                "fragmentation":
                    gpu.get_fragmentation(),

                "overall_fragmentation":
                    gpu.get_overall_fragmentation(),

                "fragmentation_level":
                    gpu.get_fragmentation_level()
            }

        return result

    # ==========================================
    # GPU RESOURCE ANALYSIS
    # ==========================================

    def get_gpu_analysis(self):

        result = {}

        for gpu_id, gpu in self.gpus.items():

            result[gpu_id] = (
                gpu.get_resource_analysis()
            )

        return result

    # ==========================================
    # CLUSTER TOTAL RESOURCES
    # ==========================================

    def get_cluster_total_resources(self):

        totals = {
            "compute_units": 0,
            "memory": 0,
            "accelerator_a": 0,
            "accelerator_b": 0
        }

        for gpu in self.gpus.values():

            resources = (
                gpu.get_total_resources()
            )

            for resource in totals:

                totals[resource] += (
                    resources.get(
                        resource,
                        0
                    )
                )

        return totals

    # ==========================================
    # CLUSTER AVAILABLE RESOURCES
    # ==========================================

    def get_cluster_available_resources(self):

        available = {
            "compute_units": 0,
            "memory": 0,
            "accelerator_a": 0,
            "accelerator_b": 0
        }

        for gpu in self.gpus.values():

            resources = (
                gpu.get_available_resources()
            )

            for resource in available:

                available[resource] += (
                    resources.get(
                        resource,
                        0
                    )
                )

        return available

    # ==========================================
    # CLUSTER ANALYSIS
    # ==========================================

    def get_cluster_analysis(self):

        return {
            "gpu_count": len(
                self.gpus
            ),

            "gpu_ids": self.get_gpu_ids(),

            "total_resources":
                self.get_cluster_total_resources(),

            "available_resources":
                self.get_cluster_available_resources(),

            "utilization":
                self.get_gpu_utilization(),

            "availability":
                self.get_gpu_availability(),

            "fragmentation":
                self.get_gpu_fragmentation(),

            "gpus":
                self.get_gpu_analysis()
        }
