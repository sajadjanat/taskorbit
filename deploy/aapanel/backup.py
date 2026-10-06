#!/usr/bin/env python3
"""Create a consistent, private SQLite backup without stopping the server."""
import datetime
import gzip
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile

os.umask(0o077)
mountpoint = subprocess.check_output(
    ["docker", "volume", "inspect", "taskorbit-board-data", "--format", "{{.Mountpoint}}"],
    text=True,
).strip()
source_path = Path(mountpoint) / "taskorbit.sqlite"
if not source_path.is_file():
    raise SystemExit("TaskOrbit database was not found; no backup was created")
directory = Path("/opt/taskorbit-board/private/backups")
directory.mkdir(parents=True, exist_ok=True, mode=0o700)
stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
archive_path = directory / f"taskorbit-{stamp}.sqlite.gz"
with tempfile.TemporaryDirectory(prefix="snapshot-", dir=directory) as temporary:
    snapshot_path = Path(temporary) / "taskorbit.sqlite"
    source = sqlite3.connect(source_path.as_uri() + "?mode=ro", uri=True)
    snapshot = sqlite3.connect(snapshot_path)
    try:
        source.backup(snapshot)
        if snapshot.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise SystemExit("Backup integrity check failed")
    finally:
        snapshot.close()
        source.close()
    with archive_path.open("xb") as output:
        with gzip.GzipFile(fileobj=output, mode="wb") as compressed:
            with snapshot_path.open("rb") as contents:
                shutil.copyfileobj(contents, compressed)
print(json.dumps({"backup": archive_path.name, "integrity": "ok", "bytes": archive_path.stat().st_size}))
