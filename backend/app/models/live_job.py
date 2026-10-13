from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator


class LiveJobInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=120)
    compute_required: StrictInt = Field(gt=0, le=1_000_000_000)
    memory_required: StrictInt = Field(gt=0, le=1_000_000_000)
    accelerator_a_required: StrictInt = Field(default=0, ge=0, le=1_000_000_000)
    accelerator_b_required: StrictInt = Field(default=0, ge=0, le=1_000_000_000)
    priority: StrictInt = Field(default=1, ge=1, le=10000)
    required_node_type: str | None = Field(default=None, min_length=1, max_length=40)

    @field_validator("name", "required_node_type")
    @classmethod
    def trim(cls, value):
        if value is not None and not value.strip():
            raise ValueError("Value cannot be blank.")
        return value.strip() if value is not None else value
