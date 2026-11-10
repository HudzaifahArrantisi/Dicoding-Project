"""Cached word packs and corporate rules shared by Python guardrails."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "data"


@lru_cache(maxsize=32)
def load_json(relative_path: str) -> dict:
    path = (ROOT / relative_path).resolve()
    if not path.is_relative_to(ROOT.resolve()):
        raise ValueError("Path data berada di luar workspace")
    with path.open(encoding="utf-8") as source:
        return json.load(source)


@lru_cache(maxsize=32)
def compiled_patterns(relative_path: str) -> tuple[re.Pattern[str], ...]:
    return tuple(re.compile(pattern, re.IGNORECASE) for pattern in load_json(relative_path).get("regex_patterns", []))


def matches(relative_path: str, text: str) -> bool:
    return any(pattern.search(text) for pattern in compiled_patterns(relative_path))
