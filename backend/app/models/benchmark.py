from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator, model_validator
from app.models.scenario import TraceJob
from app.services.simulation import Simulation


class BenchmarkRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    name: str = Field(default="Policy comparison", min_length=1, max_length=120)
    preset: Literal["MIXED", "BURST", "PREEMPTION", "INFEASIBLE"] = "MIXED"
    count: StrictInt = Field(default=30, ge=1, le=200)
    seeds: list[Annotated[StrictInt, Field(ge=0, le=2147483647)]] = Field(default=[42, 43, 44], min_length=1, max_length=5)
    policies: list[str] = Field(default=["FCFS", "PRIORITY", "RESOURCE_BALANCED"], min_length=2, max_length=6)
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
        if self.baseline not in self.policies:
            raise ValueError("The baseline must be selected for comparison.")
        count = len(self.jobs) if self.jobs is not None else (4 if self.preset in {"PREEMPTION", "INFEASIBLE"} else self.count)
        if count * len(self.seeds) * len(self.policies) > 3000:
            raise ValueError("A study may contain at most 3000 job-policy evaluations. Reduce jobs, seeds, or policies.")
        return self


