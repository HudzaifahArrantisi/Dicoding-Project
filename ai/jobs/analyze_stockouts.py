from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data-science" / "data" / "cleaned_inventory_summary.csv"
RISK_OUTPUT = ROOT / "ai" / "data" / "stockout_risks.csv"


def load_summary() -> list[dict[str, str]]:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Jalankan data-science/src/clean_logs.py lebih dulu: {DATA_PATH}")
    with DATA_PATH.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def classify(row: dict[str, str]) -> str:
    cover = float(row.get("days_of_cover") or 0)
    qty, par = int(float(row.get("current_qty") or 0)), int(float(row.get("par_level") or 0))
    if cover < 2 or qty <= 10 or (par > 0 and qty < par * 0.2):
        return "HIGH_STOCKOUT_RISK"
    if cover <= 4:
        return "MODERATE_RISK"
    return "SAFE"


def analyze_stockouts() -> list[dict[str, str]]:
    rows = load_summary()
    for row in rows:
        row["risk_level"] = classify(row)
    RISK_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    columns = list(rows[0].keys()) if rows else []
    with RISK_OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        if columns:
            writer = csv.DictWriter(handle, fieldnames=columns)
            writer.writeheader()
            writer.writerows(rows)
    counts = {risk: sum(row["risk_level"] == risk for row in rows) for risk in ("HIGH_STOCKOUT_RISK", "MODERATE_RISK", "SAFE")}
    print(f"resiko analisis: {len(rows)} baris; {counts}")
    return rows


if __name__ == "__main__":
    analyze_stockouts()
