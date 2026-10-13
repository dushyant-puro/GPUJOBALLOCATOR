"""Bounded credential-pattern scan of source and all available Git history. Never prints secrets."""
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = {
    "github_token": re.compile(rb"(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})"),
    "aws_access_key": re.compile(rb"(?:AKIA|ASIA)[A-Z0-9]{16}"),
    "private_key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "openai_key": re.compile(rb"sk-(?:proj-)?[A-Za-z0-9_-]{35,}"),
}


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def scan():
    hits, working, historical = [], 0, 0
    ignored = {".git", "node_modules", ".venv", ".demo", "dist", "__pycache__", "data", "results"}
    def inspect(data, location):
        if b"\0" in data:
            return
        for kind, pattern in PATTERNS.items():
            if pattern.search(data):
                hits.append({"location": location, "pattern": kind})
    for parent, dirs, files in os.walk(ROOT):
        dirs[:] = [name for name in dirs if name not in ignored]
        for name in files:
            path=Path(parent)/name
            if path.stat().st_size <= 5_000_000:
                inspect(path.read_bytes(), path.relative_to(ROOT).as_posix())
                working += 1
    commits=git("rev-list", "--all").decode().splitlines()
    objects=git("rev-list", "--objects", "--all").decode().splitlines()
    for line in objects:
        oid, _, name=line.partition(" ")
        if git("cat-file", "-t", oid).strip()==b"blob" and int(git("cat-file", "-s", oid)) <= 5_000_000:
            inspect(git("cat-file", "blob", oid), "history:"+oid[:10]+":"+name)
            historical += 1
    report={"working_files":working,"history_commits":len(commits),"history_blobs":historical,"findings":hits,
            "scope":"Credential patterns only; excludes dependency/build/cache/database directories and files over 5MB. No finding is not proof that no secrets exist."}
    output=ROOT/".demo"/"security-scan.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps(report,indent=2))
    return bool(hits)


if __name__=="__main__":
    raise SystemExit(scan())
