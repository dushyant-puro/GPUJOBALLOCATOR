from fastapi import APIRouter

from app.api.jobs import simulation
from app.services.synchronization import simulation_endpoint

router = APIRouter(
    prefix="/resources",
    tags=["Resources"]
)


@router.get("/")
@simulation_endpoint(simulation)
def get_resources():
    return simulation.get_resource_analysis()


@router.get("/deadlock")
@simulation_endpoint(simulation)
def get_deadlock_status():

    return simulation.get_deadlock_status()
