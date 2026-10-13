class FragmentationAnalyzer:

    def calculate_utilization(self, total, available):
        if total == 0:
            return 0

        used = total - available
        return round((used / total) * 100, 2)

    def analyze(self, total_resources, available_resources):
        result = {}

        for resource, total in total_resources.items():
            available = available_resources.get(resource, 0)

            utilization = self.calculate_utilization(
                total,
                available
            )

            result[resource] = {
                "total": total,
                "available": available,
                "used": total - available,
                "utilization": utilization
            }

        return result