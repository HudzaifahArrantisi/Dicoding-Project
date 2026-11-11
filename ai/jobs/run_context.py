"""Resolve and verify one immutable Data Science handoff."""
from __future__ import annotations

import hashlib
import json
import os
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPORTS = ROOT / "data-science" / "reports"
STAGES = ROOT / "ai" / "data" / "private" / "runs"
ARTIFACTS = ("weekly_analytics_summary.json", "cleaned_inventory_summary.csv", "weekly_analytics_report.md")


def run_id() -> str | None:
    value = os.getenv("DAISUKI_ANALYSIS_RUN_ID")
    return str(uuid.UUID(value)) if value else None


def source_dir() -> Path:
    identifier = run_id()
    return REPORTS / "runs" / identifier if identifier else REPORTS


def stage_dir() -> Path:
    identifier = run_id()
    if identifier:
        path = STAGES / identifier
        path.mkdir(parents=True, exist_ok=True)
        return path
    path = ROOT / "ai" / "data" / "private" / "legacy"
    path.mkdir(parents=True, exist_ok=True)
    return path


def verify_manifest() -> dict | None:
    identifier = run_id()
    if not identifier:
        return None
    path = source_dir()
    manifest = json.loads((path / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("run_id") != identifier or manifest.get("schema_version") != 1:
        raise ValueError("Identitas atau versi manifest Data Science tidak valid")
    hashes = manifest.get("sha256", {})
    for name in ARTIFACTS:
        digest = hashlib.sha256((path / name).read_bytes()).hexdigest()
        if hashes.get(name) != digest:
            raise ValueError(f"Checksum artefak Data Science tidak cocok: {name}")
    return manifest


def source_file(name: str) -> Path:
    if name not in ARTIFACTS:
        raise ValueError("Nama artefak tidak dikenal")
    verify_manifest()
    return source_dir() / name
