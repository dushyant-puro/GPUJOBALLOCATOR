from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator, model_validator
from app.models.scenario import TraceJob
from app.services.simulation import Simulation


class BenchmarkRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    name: str = Field(default="Policy comparison", min_length=1, max_length=120)
    preset: Literal["MIXED", "BURST", "PREEMPTION", "INFEASIBLE", "FRAGMENTATION_TRAP", "FAIRNESS_STREAM"] = "MIXED"
    count: StrictInt = Field(default=30, ge=1, le=200)
    seeds: list[Annotated[StrictInt, Field(ge=0, le=2147483647)]] = Field(default=[42, 43, 44], min_length=1, max_length=5)
    policies: list[str] = Field(default=["FCFS", "PRIORITY", "RESOURCE_BALANCED"], min_length=1, max_length=7)
    placement_rules: list[str] = Field(default=["NORMALIZED"], min_length=1, max_length=5)
    aging_rate: float = Field(default=1.0, ge=0.01, le=100)
    alignment_weight: float = Field(default=0.6, ge=0, le=1)
    stranded_weight: float = Field(default=0.3, ge=0, le=1)
    baseline: str = "FCFS"
    horizon_seconds: float = Field(default=10000, ge=0.001, le=604800)
    starvation_threshold_seconds: float = Field(default=30, ge=0.001, le=604800)
    jobs: list[TraceJob] | None = Field(default=None, min_length=1, max_length=200)

    @field_validator("name")
    @classmethod
    def trim_name(cls, value):
        if not value.strip():
            raise ValueError("Experiment name cannot be blank.")
        return value.strip()

    @model_validator(mode="after")
    def validate_comparison(self):
        if len(set(self.policies)) != len(self.policies) or any(policy not in Simulation.SUPPORTED_POLICIES for policy in self.policies):
            raise ValueError("Choose distinct supported policies.")
        from app.algorithms.placement import RULES
        if len(set(self.placement_rules)) != len(self.placement_rules) or any(rule not in RULES for rule in self.placement_rules):
            raise ValueError("Choose distinct supported placement rules.")
        if len(self.policies) * len(self.placement_rules) < 2:
            raise ValueError("Compare at least two policy/placement variants.")
        if self.alignment_weight + self.stranded_weight > 1:
            raise ValueError("Alignment weights must sum to at most one.")
        if self.baseline not in self.policies:
            raise ValueError("The baseline must be selected for comparison.")
        count = len(self.jobs) if self.jobs is not None else (4 if self.preset in {"PREEMPTION", "INFEASIBLE", "FRAGMENTATION_TRAP"} else self.count)
        if self.jobs is None and self.preset == "FAIRNESS_STREAM":
            count = 94
        if count * len(self.seeds) * len(self.policies) * len(self.placement_rules) > 3000:
            raise ValueError("A study may contain at most 3000 job-policy evaluations. Reduce jobs, seeds, or policies.")
        return self


