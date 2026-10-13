class InvariantError(AssertionError):
    """Accounting violation, raised even when Python runs with -O."""


def require(condition, message):
    if not condition:
        raise InvariantError(message)
