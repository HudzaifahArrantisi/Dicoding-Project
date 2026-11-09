"""Return dated stock consumption and current model risk counts for the admin chart."""

from __future__ import annotations

import json
import os
from pathlib import Path

import psycopg

from filter import DaisukiFilter, MODEL_FILE
from source import build_training_samples, database_url, fetch_training_records


def load_daily_consumption() -> list[dict[str, int | str]]:
    with psycopg.connect(database_url(), connect_timeout=10) as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                WITH days AS (
                  SELECT generate_series(
                    (now() AT TIME ZONE 'Asia/Jakarta')::date - 13,
                    (now() AT TIME ZONE 'Asia/Jakarta')::date,
                    interval '1 day'
                  )::date AS day
                ), consumption AS (
                  SELECT (created_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
                    SUM(qty_before - qty_after)::int AS units
                  FROM stock_logs
                  WHERE source = 'manual_update' AND qty_before > qty_after
                    AND created_at >= now() - interval '15 days'
                  GROUP BY 1
                )
                SELECT days.day::text, COALESCE(consumption.units, 0)::int
                FROM days LEFT JOIN consumption ON consumption.day = days.day
                ORDER BY days.day
            """)
            return [{"day": day, "units": units} for day, units in cursor.fetchall()]


def load_model_summary() -> dict[str, object]:
    model_path = Path(os.environ.get("DAISUKI_MODEL_PATH") or MODEL_FILE)
    classifier = DaisukiFilter(model_path, model_key="risk")
    if not classifier.is_ready:
        return {"available": False, "sample_count": 0, "risk_counts": {}}
    records = fetch_training_records()
    texts, _ = build_training_samples(records)
    labels = classifier.predict(texts)
    counts = {"urgent_restock": 0, "regular_order": 0, "normal": 0}
    for label in labels:
        if label in counts:
            counts[label] += 1
    return {"available": True, "sample_count": len(labels), "risk_counts": counts}


if __name__ == "__main__":
    print(json.dumps({"days": load_daily_consumption(), "model": load_model_summary()}, separators=(",", ":")))
