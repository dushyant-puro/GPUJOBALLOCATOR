import random


class WorkloadGenerator:
    """Generate deterministic or random GPU workload specifications."""

    SUPPORTED_PATTERNS = [
        "LIGHT",
        "BALANCED",
        "HEAVY",
        "MIXED",
        "ACCELERATOR_HEAVY"
    ]

    def __init__(self, seed=None):
        self.seed = seed
        self.random = random.Random(seed)

    def _priority(self):
        return self.random.randint(1, 5)

    def _light(self):
        return {
            "compute_required": self.random.randint(1, 3),
            "memory_required": self.random.randint(1, 4),
            "accelerator_a_required": self.random.randint(0, 1),
            "accelerator_b_required": self.random.randint(0, 1),
            "priority": self.random.randint(1, 3)
        }

    def _balanced(self):
        return {
            "compute_required": self.random.randint(1, 6),
            "memory_required": self.random.randint(1, 12),
            "accelerator_a_required": self.random.randint(0, 2),
            "accelerator_b_required": self.random.randint(0, 1),
            "priority": self._priority()
        }

    def _heavy(self):
        return {
            "compute_required": self.random.randint(4, 8),
            "memory_required": self.random.randint(8, 16),
            "accelerator_a_required": self.random.randint(1, 4),
            "accelerator_b_required": self.random.randint(0, 2),
            "priority": self._priority()
        }

    def _accelerator_heavy(self):
        return {
            "compute_required": self.random.randint(2, 8),
            "memory_required": self.random.randint(4, 16),
            "accelerator_a_required": self.random.randint(2, 4),
            "accelerator_b_required": self.random.randint(1, 2),
            "priority": self._priority()
        }

    def generate_one(
        self,
        pattern="MIXED",
        index=1,
        name_prefix="Generated Job"
    ):
        normalized = str(pattern or "MIXED").strip().upper()

        if normalized not in self.SUPPORTED_PATTERNS:
            raise ValueError(
                f"Unsupported workload pattern: {normalized}. "
                f"Supported patterns: {self.SUPPORTED_PATTERNS}"
            )

        if normalized == "LIGHT":
            resources = self._light()

        elif normalized == "BALANCED":
            resources = self._balanced()

        elif normalized == "HEAVY":
            resources = self._heavy()

        elif normalized == "ACCELERATOR_HEAVY":
            resources = self._accelerator_heavy()

        else:
            pattern_choice = self.random.choices(
                [
                    "LIGHT",
                    "BALANCED",
                    "HEAVY",
                    "ACCELERATOR_HEAVY"
                ],
                weights=[20, 40, 25, 15],
                k=1
            )[0]

            return self.generate_one(
                pattern=pattern_choice,
                index=index,
                name_prefix=name_prefix
            )

        return {
            "name": f"{name_prefix} #{index}",
            **resources
        }

    def generate(
        self,
        count,
        pattern="MIXED",
        name_prefix="Generated Job"
    ):
        count = int(count)

        if count < 1:
            raise ValueError(
                "Workload count must be at least 1."
            )

        if count > 1000:
            raise ValueError(
                "Workload count cannot exceed 1000 jobs."
            )

        return [
            self.generate_one(
                pattern=pattern,
                index=index,
                name_prefix=name_prefix
            )
            for index in range(1, count + 1)
        ]