from fastapi import APIRouter

from app.api.jobs import simulation
from app.services.synchronization import simulation_endpoint

from app.algorithms.fragmentation import FragmentationAnalyzer


router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"]
)


analyzer = FragmentationAnalyzer()


@router.get("/resources")
@simulation_endpoint(simulation)
def resource_analysis():

    # Keep the existing fragmentation analyzer
    # resource-level analysis.
    fragmentation_analysis = analyzer.analyze(
        simulation.get_total_resources(),
        simulation.get_available_resources()
    )

    # Use the Simulation's existing analytics methods
    # for the dashboard-level metrics.
    return {
        "resource_imbalance": simulation.get_overall_fragmentation(),
        "metric_definitions": simulation.get_metric_definitions(),
        "queue_diagnostics": simulation.get_queue_diagnostics(),
        "utilization": simulation.get_utilization(),

        "overall_fragmentation":
            simulation.get_overall_fragmentation(),

        "fragmentation_level":
            simulation.get_fragmentation_level(),

        "allocation_efficiency":
            simulation.get_allocation_efficiency(),

        "availability":
            simulation.get_availability_percentage(),

        "fragmentation":
            simulation.get_fragmentation(),

        "resource_balance_score":
            simulation.get_resource_balance_score(),

        "total":
            simulation.get_total_resources(),

        "available":
            simulation.get_available_resources(),

        "resources":
            fragmentation_analysis,

        "gpu_count":
            len(simulation.gpu_selector.get_gpu_ids()),

        "gpus":
            simulation.gpu_selector.get_gpu_analysis()
    }