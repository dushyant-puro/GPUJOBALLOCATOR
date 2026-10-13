class DeadlockDetector:

    def __init__(self):
        self.graph = {}

    def add_edge(self, source, target):
        if source not in self.graph:
            self.graph[source] = []

        self.graph[source].append(target)

    def clear(self):
        self.graph = {}

    def has_cycle(self):
        visited = set()
        recursion_stack = set()

        def dfs(node):
            if node in recursion_stack:
                return True

            if node in visited:
                return False

            visited.add(node)
            recursion_stack.add(node)

            for neighbor in self.graph.get(node, []):
                if dfs(neighbor):
                    return True

            recursion_stack.remove(node)
            return False

        for node in self.graph:
            if dfs(node):
                return True

        return False

    def get_graph(self):
        return self.graph