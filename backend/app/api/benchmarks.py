import json
from typing import Literal
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from app.models.benchmark import BenchmarkRequest
from app.services.benchmark import csv_export
from app.services.benchmark_store import BenchmarkManager


router = APIRouter(prefix="/benchmarks", tags=["Benchmarks"])
manager = BenchmarkManager(recover=False)


def get_study(identifier, artifact=False):
    try:
        return manager.store.get(identifier, artifact=artifact)
    except KeyError:
        raise HTTPException(status_code=404, detail="Benchmark not found.") from None


@router.post("/", status_code=202)
def create_benchmark(request: BenchmarkRequest):
    try:
        identifier = manager.submit(request.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return get_study(identifier)


@router.get("/")
def list_benchmarks():
    return {"benchmarks": manager.store.list(), "archive_limit": 50}


@router.get("/{identifier}")
def benchmark_status(identifier: str):
    return get_study(identifier)


@router.get("/{identifier}/export/{format}")
def export_benchmark(identifier: str, format: Literal["json", "csv"]):
    study = get_study(identifier, artifact=True)
    if study["status"] != "SUCCEEDED":
        raise HTTPException(status_code=409, detail="Exports are available after the benchmark succeeds.")
    result = study["artifact"]
    content = json.dumps(result, indent=2, allow_nan=False) if format == "json" else csv_export(result)
    return Response(content=content, media_type="application/json" if format == "json" else "text/csv",
                    headers={"Content-Disposition": f'attachment; filename="benchmark-{study["id"]}.{format}"'})
