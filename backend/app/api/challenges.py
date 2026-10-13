import json
from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

from app.services.challenges import CATALOG, ChallengeRegistry

router = APIRouter(prefix="/challenges", tags=["Organizer challenges"])
registry = ChallengeRegistry()


class CreateChallenge(BaseModel):
    model_config = ConfigDict(extra="forbid")
    challenge_id: Literal["C1", "C2", "C3", "C4", "C5"]
    reservation_mode: Literal["LEGACY", "NAIVE", "AVOIDANCE", "DETECT_RECOVER"] = "LEGACY"
    victim_policy: Literal["ABORT_YOUNGEST_IN_CYCLE", "COST_WEIGHTED"] = "ABORT_YOUNGEST_IN_CYCLE"
    restart_limit: int = Field(default=3, ge=1, le=10)


class ControlChallenge(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["step", "reset"]


def find_run(run_id):
    try:
        return registry.get(run_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Challenge session not found.") from None


@router.get("/catalog")
def catalog():
    return {"challenges": list(CATALOG.values()), "note": "Five organizer options; assigned challenges are confirmed at the event."}


@router.post("/runs", status_code=201)
def create_run(request: CreateChallenge):
    try:
        return registry.create(request.challenge_id, reservation_mode=request.reservation_mode, victim_policy=request.victim_policy, restart_limit=request.restart_limit).snapshot()
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.get("/runs/{run_id}")
def get_run(run_id: str):
    return find_run(run_id).snapshot()


@router.post("/runs/{run_id}/control")
def control(run_id: str, request: ControlChallenge):
    run = find_run(run_id)
    return run.step() if request.action == "step" else run.reset()


@router.get("/runs/{run_id}/export")
def export(run_id: str):
    run = find_run(run_id)
    return Response(json.dumps(run.evidence(), indent=2), media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="challenge-{run.definition["id"]}-{run_id[:8]}.json"'})


@router.delete("/runs/{run_id}")
def delete(run_id: str):
    try:
        registry.delete(run_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Challenge session not found.") from None
    return {"deleted": run_id}
