from copy import deepcopy
from functools import wraps


def synchronized(method):
    """Serialize a simulation operation, including nested scheduling calls."""
    @wraps(method)
    def wrapper(self, *args, **kwargs):
        with self.lock:
            return method(self, *args, **kwargs)
    return wrapper


def simulation_endpoint(simulation):
    """Keep API validation, mutation and response snapshots in one boundary."""
    def decorate(endpoint):
        @wraps(endpoint)
        def wrapper(*args, **kwargs):
            with simulation.lock:
                return deepcopy(endpoint(*args, **kwargs))
        return wrapper
    return decorate
