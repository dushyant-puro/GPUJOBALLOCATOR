from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from contextlib import closing
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
from threading import RLock
from uuid import uuid4
import zlib

from app.services.benchmark import run_benchmark, summary_view


DEFAULT_DATABASE = Path(__file__).resolve().parents[2] / "data" / "benchmarks.sqlite3"


class BenchmarkStore:
    """Durable summaries plus compressed, reproducible evidence bundles."""
    def __init__(self, path=DEFAULT_DATABASE):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = RLock()
        with closing(sqlite3.connect(self.path)) as db:
            db.execute("""CREATE TABLE IF NOT EXISTS benchmarks (
                id TEXT PRIMARY KEY, created_at TEXT NOT NULL, name TEXT NOT NULL,
                status TEXT NOT NULL, config TEXT NOT NULL, progress TEXT NOT NULL,
                summary TEXT, artifact BLOB, error TEXT)""")
            db.commit()

    def recover(self):
        with self.lock, closing(sqlite3.connect(self.path)) as db:
            db.execute("UPDATE benchmarks SET status='FAILED', error=? WHERE status IN ('QUEUED','RUNNING')",
                       ("Backend restarted before this benchmark finished. Submit the saved configuration again.",))
            db.commit()

    def create(self, config):
        identifier = str(uuid4())
        with self.lock, closing(sqlite3.connect(self.path)) as db:
            if db.execute("SELECT count(*) FROM benchmarks").fetchone()[0] >= 50:
                raise ValueError("Benchmark archive has reached its 50-study limit.")
            if db.execute("SELECT count(*) FROM benchmarks WHERE status IN ('QUEUED','RUNNING')").fetchone()[0] >= 4:
                raise ValueError("Benchmark queue is full. Wait for an active study to finish.")
            db.execute("INSERT INTO benchmarks(id,created_at,name,status,config,progress) VALUES(?,?,?,?,?,?)",
                       (identifier, datetime.now(timezone.utc).isoformat(), config["name"], "QUEUED",
                        json.dumps(config), json.dumps({"completed": 0, "total": None})))
            db.commit()
        return identifier

    def update(self, identifier, status, progress=None, error=None):
        with self.lock, closing(sqlite3.connect(self.path)) as db:
            db.execute("UPDATE benchmarks SET status=?, progress=COALESCE(?,progress), error=? WHERE id=?",
                       (status, json.dumps(progress) if progress is not None else None, error, identifier))
            db.commit()

    def finish(self, identifier, result):
        result = {"benchmark_id": identifier, **result}
        summary = summary_view(result)
        archive = zlib.compress(json.dumps(result, allow_nan=False, separators=(",", ":")).encode())
        with self.lock, closing(sqlite3.connect(self.path)) as db:
            db.execute("UPDATE benchmarks SET status='SUCCEEDED', summary=?, artifact=?, progress=? WHERE id=?",
                       (json.dumps(summary, allow_nan=False), archive,
                        json.dumps({"completed": result["trial_count"], "total": result["trial_count"]}), identifier))
            db.commit()

    def get(self, identifier, artifact=False):
        with self.lock, closing(sqlite3.connect(self.path)) as db:
            db.row_factory = sqlite3.Row
            columns = "*" if artifact else "id,created_at,name,status,config,progress,summary,error"
            row = db.execute(f"SELECT {columns} FROM benchmarks WHERE id=?", (identifier,)).fetchone()
            if row is None:
                raise KeyError(identifier)
            data = dict(row)
        for key in ("config", "progress", "summary"):
            data[key] = json.loads(data[key]) if data[key] is not None else None
        if artifact:
            data["artifact"] = json.loads(zlib.decompress(data["artifact"])) if data["artifact"] else None
        return data

    def list(self):
        with self.lock, closing(sqlite3.connect(self.path)) as db:
            db.row_factory = sqlite3.Row
            return [dict(row) for row in db.execute(
                "SELECT id,created_at,name,status FROM benchmarks ORDER BY created_at DESC")]


class BenchmarkManager:
    def __init__(self, store=None, recover=True):
        self.store = store or BenchmarkStore()
        if recover:
            self.store.recover()
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="benchmark")

    def submit(self, config):
        config = deepcopy(config)
        identifier = self.store.create(config)
        try:
            self.executor.submit(self._work, identifier, config)
        except Exception as error:
            self.store.update(identifier, "FAILED", error=str(error))
            raise
        return identifier

    def _work(self, identifier, config):
        try:
            self.store.update(identifier, "RUNNING")
            def progress(completed, total, policy, seed):
                self.store.update(identifier, "RUNNING", {"completed": completed, "total": total,
                                                          "policy": policy, "seed": seed})
            result = run_benchmark(config, progress=progress)
            self.store.finish(identifier, result)
        except Exception as error:
            self.store.update(identifier, "FAILED", error=f"{type(error).__name__}: {error}")

    def close(self):
        self.executor.shutdown(wait=True)
