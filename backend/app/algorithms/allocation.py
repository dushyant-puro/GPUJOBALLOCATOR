
import math


class GPUResourceManager:

    def __init__(
        self,
        compute_units=8,
        memory=16,
        accelerator_a=4,
        accelerator_b=2
    ):
        # ==========================================
        # TOTAL GPU RESOURCES
        # ==========================================

        self.total = {
            "compute_units": compute_units,
            "memory": memory,
            "accelerator_a": accelerator_a,
            "accelerator_b": accelerator_b
        }

        # Initially all resources are available
        self.available = self.total.copy()

    # ==========================================
    # CHECK WHETHER A JOB CAN BE ALLOCATED
    # ==========================================

    def can_allocate(self, request):
        """
        Check whether enough resources are currently
        available for the requested job.
        """

        for resource, amount in request.items():

            # Reject unknown resources
            if resource not in self.available:
                return False

            # Reject invalid requests
            if not isinstance(amount, (int, float)) or not math.isfinite(amount) or amount < 0:
                return False

            if amount > self.available[resource]:
                return False

        return True

    # ==========================================
    # CALCULATE UTILIZATION FOR A RESOURCE STATE
    # ==========================================

    def _calculate_utilization(self, available_resources):
        """
        Calculate utilization percentages for a supplied
        resource state without changing actual resources.
        """

        utilization = {}

        for resource, total_amount in self.total.items():

            if total_amount <= 0:
                utilization[resource] = 0.0
                continue

            used_amount = (
                total_amount - available_resources[resource]
            )

            utilization[resource] = round(
                (used_amount / total_amount) * 100,
                2
            )

        return utilization

    # ==========================================
    # CALCULATE FRAGMENTATION FOR A RESOURCE STATE
    # ==========================================

    def _calculate_overall_fragmentation(
        self,
        available_resources
    ):
        """
        Measure the spread between resource utilization
        percentages. A smaller spread means more balanced
        utilization according to this project's metric.
        """

        utilization = self._calculate_utilization(
            available_resources
        )

        if not utilization:
            return 0.0

        values = list(utilization.values())

        return round(
            min(max(values) - min(values), 100),
            2
        )

    # ==========================================
    # ALLOCATION SCORE
    # ==========================================

    def get_allocation_score_components(self, request):
        """
        Evaluate a possible allocation without actually
        allocating resources.

        Higher scores indicate a better fit according to
        this project's resource-balance and imbalance
        heuristics.

        Score components:
        - 40%: remaining-resource balance
        - 35%: utilization imbalance change
        - 25%: mean normalized resource footprint

        An allocation that cannot fit receives 0.
        """

        if not self.can_allocate(request):
            return {"eligible": False, "score": 0.0}

        # ------------------------------------------
        # STEP 1: Simulate the allocation
        # ------------------------------------------

        simulated_available = self.available.copy()

        for resource, amount in request.items():
            simulated_available[resource] -= amount

        # ------------------------------------------
        # STEP 2: Measure fragmentation before/after
        # ------------------------------------------

        fragmentation_before = (
            self._calculate_overall_fragmentation(
                self.available
            )
        )

        fragmentation_after = (
            self._calculate_overall_fragmentation(
                simulated_available
            )
        )

        # Lower fragmentation after allocation is better.
        # Improvement is positive; worsening is negative.
        fragmentation_improvement = (
            fragmentation_before - fragmentation_after
        )

        # Convert the change into a score between 0 and 100.
        # A neutral change receives 50.
        fragmentation_score = max(
            0.0,
            min(
                100.0,
                50.0 + fragmentation_improvement
            )
        )

        # ------------------------------------------
        # STEP 3: Measure remaining-resource balance
        # ------------------------------------------

        utilization_after = self._calculate_utilization(
            simulated_available
        )

        utilization_values = list(
            utilization_after.values()
        )

        if utilization_values:
            utilization_spread = (
                max(utilization_values)
                - min(utilization_values)
            )

            balance_score = max(
                0.0,
                100.0 - utilization_spread
            )
        else:
            balance_score = 100.0

        # ------------------------------------------
        # STEP 4: Measure resource efficiency
        # ------------------------------------------

        # Resource dimensions have different units: average capacity fractions.
        fractions = [
            request.get(resource, 0) / capacity
            for resource, capacity in self.total.items() if capacity > 0
        ]
        resource_efficiency = (sum(fractions) / len(fractions) * 100) if fractions else 0.0

        resource_efficiency = max(
            0.0,
            min(resource_efficiency, 100.0)
        )

        # ------------------------------------------
        # STEP 5: Calculate final weighted score
        # ------------------------------------------

        score = (
            balance_score * 0.40
            + fragmentation_score * 0.35
            + resource_efficiency * 0.25
        )

        return {
            "eligible": True,
            "score": round(max(0.0, min(score, 100.0)), 2),
            "balance_score": round(balance_score, 2),
            "imbalance_change_score": round(fragmentation_score, 2),
            "resource_footprint_score": round(resource_efficiency, 2),
            "imbalance_before": fragmentation_before,
            "imbalance_after": fragmentation_after,
            "weights": {"balance": 0.40, "imbalance_change": 0.35, "resource_footprint": 0.25},
        }

    def get_allocation_score(self, request):
        return self.get_allocation_score_components(request)["score"]

    # ==========================================
    # ALLOCATE RESOURCES
    # ==========================================

    def allocate(self, request):
        """
        Allocate resources only when the request is valid
        and sufficient resources are available.
        """

        if not self.can_allocate(request):
            return False

        for resource, amount in request.items():
            self.available[resource] -= amount

        return True

    # ==========================================
    # RELEASE RESOURCES
    # ==========================================

    def release(self, request):
        """Validate the entire release before mutating; never hide over-release."""
        for resource, amount in request.items():
            if (resource not in self.available
                    or not isinstance(amount, (int, float))
                    or not math.isfinite(amount) or amount < 0
                    or self.available[resource] + amount > self.total[resource]):
                raise ValueError("Invalid or excessive resource release.")
        for resource, amount in request.items():
            self.available[resource] += amount

    def get_available_resources(self):
        return self.available.copy()

    # ==========================================
    # GET TOTAL RESOURCES
    # ==========================================

    def get_total_resources(self):
        return self.total.copy()

    # ==========================================
    # RESOURCE UTILIZATION
    # ==========================================

    def get_utilization(self):
        """
        Return the percentage of each resource currently used.
        """

        return self._calculate_utilization(
            self.available
        )

    # ==========================================
    # RESOURCE AVAILABILITY PERCENTAGE
    # ==========================================

    def get_availability_percentage(self):

        availability = {}

        for resource, total_amount in self.total.items():

            if total_amount <= 0:
                availability[resource] = 0.0
                continue

            availability[resource] = round(
                (
                    self.available[resource]
                    / total_amount
                ) * 100,
                2
            )

        return availability

    # ==========================================
    # FRAGMENTATION
    # ==========================================

    def get_fragmentation(self):
        """
        Show how far each resource's utilization differs
        from the average utilization.
        """

        utilization = self.get_utilization()

        if not utilization:
            return {}

        values = list(utilization.values())

        average_utilization = (
            sum(values) / len(values)
        )

        fragmentation = {}

        for resource, value in utilization.items():

            difference = abs(
                value - average_utilization
            )

            fragmentation[resource] = round(
                difference,
                2
            )

        return fragmentation

    # ==========================================
    # OVERALL FRAGMENTATION
    # ==========================================

    def get_overall_fragmentation(self):
        """
        Calculate utilization spread across resource types.
        """

        return self._calculate_overall_fragmentation(
            self.available
        )

    # ==========================================
    # FRAGMENTATION LEVEL
    # ==========================================

    def get_resource_imbalance(self):
        return self.get_overall_fragmentation()

    def get_fragmentation_level(self):

        fragmentation = (
            self.get_overall_fragmentation()
        )

        if fragmentation <= 20:
            return "LOW"

        elif fragmentation <= 50:
            return "MEDIUM"

        else:
            return "HIGH"

    # ==========================================
    # ALLOCATION EFFICIENCY
    # ==========================================

    def get_allocation_efficiency(self):
        """
        Estimate overall utilization efficiency while
        penalizing uneven resource utilization.
        """

        utilization = self.get_utilization()

        if not utilization:
            return 100.0

        values = list(utilization.values())

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

        efficiency = max(
            0.0,
            min(efficiency, 100.0)
        )

        return round(efficiency, 2)

    # ==========================================
    # RESOURCE BALANCE SCORE
    # ==========================================

    def get_resource_balance_score(self):

        fragmentation = (
            self.get_overall_fragmentation()
        )

        score = 100.0 - fragmentation

        return round(
            max(0.0, min(score, 100.0)),
            2
        )

    # ==========================================
    # COMPLETE RESOURCE ANALYSIS
    # ==========================================

    def get_resource_analysis(self):

        return {
            "total": self.get_total_resources(),

            "available": self.get_available_resources(),

            "utilization": self.get_utilization(),

            "availability": self.get_availability_percentage(),

            "fragmentation": self.get_fragmentation(),

            "resource_imbalance": self.get_resource_imbalance(),
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
            )
        }