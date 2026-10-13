from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from app.api import benchmarks

from app.api.jobs import router as jobs_router
from app.api.resources import router as resources_router
from app.api.analytics import router as analytics_router
from app.api.replay import router as replay_router
from app.api.benchmarks import router as benchmarks_router
from app.api.challenges import router as challenges_router


@asynccontextmanager
async def lifespan(app):
    benchmarks.manager.store.recover()
    try:
        yield
    finally:
        benchmarks.manager.close()


app = FastAPI(
    lifespan=lifespan,
    title="GPU Job Allocator",
    description="GPU Resource Allocation and Workload Replay Simulator",
    version="1.0.0"
)


# Allow the React frontend to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# API Routers
app.include_router(jobs_router)
app.include_router(resources_router)
app.include_router(analytics_router)
app.include_router(replay_router)
app.include_router(benchmarks_router)
app.include_router(challenges_router)

# A production build runs on the same local origin as the API, without Vite.
studio_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if studio_dist.is_dir():
    app.mount("/studio", StaticFiles(directory=studio_dist, html=True), name="studio")


@app.get("/")
def root():
    return {
        "message": "GPU Job Allocator API is running",
        "version": "1.0.0"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "GPU Job Allocator"
    }
