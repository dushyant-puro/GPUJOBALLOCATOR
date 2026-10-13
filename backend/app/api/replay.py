from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

from app.services.replay import PRESETS, ReplayRegistry, make_trace
from app.services.simulation import Simulation
from app.models.scenario import TraceJob


router = APIRouter(prefix="/replay", tags=["Replay"])
registry = ReplayRegistry()


class CreateRun(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(default="Replay", min_length=1, max_length=120)
    preset: Literal["MIXED", "BURST", "PREEMPTION", "INFEASIBLE", "FRAGMENTATION_TRAP", "FAIRNESS_STREAM"] = "MIXED"
    placement_rule: Literal["NORMALIZED", "FIRST_FIT", "MEMORY_BEST_FIT", "BEST_FIT_PACKING", "ALIGNMENT"] = "NORMALIZED"
    aging_rate: float = Field(default=1.0, ge=0.01, le=100)
    alignment_weight: float = Field(default=0.6, ge=0, le=1)
    stranded_weight: float = Field(default=0.3, ge=0, le=1)
    policy: str = "RESOURCE_BALANCED"
    seed: StrictInt = 42
    count: StrictInt = Field(default=30, ge=1, le=200)
    jobs: list[TraceJob] | None = Field(default=None, min_length=1, max_length=200)

    @field_validator("policy")
    @classmethod
    def valid_policy(cls, value):
        if value not in Simulation.SUPPORTED_POLICIES:
            raise ValueError("Unknown scheduling policy.")
        return value

    @field_validator("name")
    @classmethod
    def trim_name(cls, value):
        if not value.strip():
            raise ValueError("Run name cannot be blank.")
        return value.strip()


class ControlRun(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    action: Literal["play", "pause", "step", "advance", "reset", "speed"]
    seconds: float | None = Field(default=None, ge=0, le=604800)
    speed: float | None = Field(default=None, ge=0.1, le=100)


def find_run(run_id):
    try:
        return registry.get(run_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Replay run not found.") from None


@router.get("/presets")
def presets():
    return {"presets": PRESETS, "policies": Simulation.SUPPORTED_POLICIES, "placement_rules": ["NORMALIZED", "FIRST_FIT", "MEMORY_BEST_FIT", "BEST_FIT_PACKING", "ALIGNMENT"]}


@router.post("/runs", status_code=201)
def create_run(request: CreateRun):
    trace = ([job.model_dump() for job in request.jobs] if request.jobs is not None
             else make_trace(request.preset, request.seed, request.count))
    try:
        run = registry.create(trace, request.policy, request.name, placement_rule=request.placement_rule, alignment_weight=request.alignment_weight, stranded_weight=request.stranded_weight, aging_rate=request.aging_rate)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return run.snapshot()


@router.get("/runs")
def list_runs():
    # Listing is a read-only inventory; selected run snapshots synchronize playback.
    with registry.lock:
        runs = [{"run_id": run.run_id, "name": run.name, "policy": run.policy}
                for run in registry.runs.values()]
    return {"runs": runs, "limit": registry.limit, "max_jobs": 200}


@router.get("/runs/{run_id}")
def get_run(run_id: str):
    return find_run(run_id).snapshot()


@router.post("/runs/{run_id}/control")
def control_run(run_id: str, request: ControlRun):
    try:
        return find_run(run_id).control(request.action, seconds=request.seconds, speed=request.speed)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.delete("/runs/{run_id}")
def delete_run(run_id: str):
    try:
        registry.delete(run_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Replay run not found.") from None
    return {"deleted": run_id}


@router.get("/runs/{run_id}/events")
def get_events(run_id: str, offset: int = Query(default=0, ge=0), limit: int = Query(default=200, ge=1, le=200)):
    return find_run(run_id).event_page(offset, limit)
