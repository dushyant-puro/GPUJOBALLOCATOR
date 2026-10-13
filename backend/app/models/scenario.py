from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator


class TraceJob(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    name: str = Field(min_length=1, max_length=120)
    compute_required: StrictInt = Field(gt=0)
    memory_required: StrictInt = Field(gt=0)
    accelerator_a_required: StrictInt = Field(default=0, ge=0)
    accelerator_b_required: StrictInt = Field(default=0, ge=0)
    priority: StrictInt = Field(default=1, ge=1)
    required_node_type: str | None = Field(default=None, min_length=1, max_length=40)
    arrival_seconds: float = Field(ge=0, le=604800)
    duration_seconds: float = Field(ge=0.001, le=86400)

    @field_validator("name")
    @classmethod
    def trim_name(cls, value):
        if not value.strip():
            raise ValueError("Job name cannot be blank.")
        return value.strip()

    @field_validator("required_node_type")
    @classmethod
    def trim_type(cls, value):
        if value is not None and not value.strip():
            raise ValueError("Required node type cannot be blank.")
        return value.strip() if value is not None else None


