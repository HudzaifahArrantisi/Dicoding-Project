"""Return the Data Science consumption series and current model classifications."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from csv_handoff import INPUT, load_samples
from filter import DaisukiFilter, MODEL_FILE

AI_ROOT = str(Path(__file__).resolve().parents[1])
if AI_ROOT not in sys.path:
    sys.path.insert(0, AI_ROOT)
from jobs.run_context import run_id, source_file, stage_dir

REPORT = source_file("weekly_analytics_summary.json")


def load_daily_consumption() -> list[dict[str, int | str]]:
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    days = report.get("daily_consumption")
    if not isinstance(days, list):
        raise ValueError("Laporan Data Science belum memuat grafik konsumsi")
    return days[-14:]


def load_model_summary() -> dict[str, object]:
    model_path = stage_dir() / "daisuki.pkl" if run_id() else Path(os.environ.get("DAISUKI_MODEL_PATH") or MODEL_FILE)
    classifier = DaisukiFilter(model_path, model_key="risk")
    if not classifier.is_ready:
        return {"available": False, "sample_count": 0, "risk_counts": {}}
    texts, _, _ = load_samples(source_file("cleaned_inventory_summary.csv") if run_id() else INPUT)
    labels = classifier.predict(texts)
    counts = {"urgent_restock": 0, "regular_order": 0, "normal": 0}
    for label in labels:
        if label in counts:
            counts[label] += 1
    return {"available": True, "sample_count": len(labels), "risk_counts": counts}


if __name__ == "__main__":
    result = {"days": load_daily_consumption(), "model": load_model_summary(), "source_run_id": run_id()}
    if run_id():
        (stage_dir() / "chart_data.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(result, separators=(",", ":")))
