"""Validate the Data Science handoff and prepare private aggregate analysis."""

from __future__ import annotations

import csv
import json
import math
import os
import time
from collections import defaultdict
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
INPUT = DATA_DIR.parents[1] / "data-science" / "reports" / "cleaned_inventory_summary.csv"
OUTPUT = DATA_DIR / "raw_references" / "csv" / "ai_analysis_summary.csv"
RULES = DATA_DIR / "mainbrain" / "corporate_knowledge" / "business_rules.json"
REQUIRED = {"partner_id", "product_id", "product_name", "current_qty", "par_level", "weekly_consumption", "days_of_cover"}
MAX_AGE_SECONDS = 7 * 24 * 60 * 60


def is_fresh_handoff(path: Path = INPUT) -> bool:
    return path.is_file() and 0 <= time.time() - path.stat().st_mtime <= MAX_AGE_SECONDS


def load_samples(path: Path = INPUT) -> tuple[list[str], list[str], list[dict[str, str]]]:
    if path.stat().st_size > 10_000_000:
        raise ValueError("CSV Data Science melebihi batas 10 MB")
    with RULES.open(encoding="utf-8") as source:
        products = set(json.load(source)["official_products"])
    texts: list[str] = []
    labels: list[str] = []
    grouped: dict[str, dict[str, float]] = defaultdict(lambda: {"partners": 0, "weekly_units": 0, "cover_total": 0})
    seen: set[tuple[str, str]] = set()
    with path.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        if not reader.fieldnames or not REQUIRED.issubset(reader.fieldnames):
            raise ValueError("Kolom CSV Data Science tidak sesuai kontrak cleaned_inventory_summary.csv")
        for index, row in enumerate(reader, 1):
            if index > 100_000:
                raise ValueError("CSV Data Science melebihi batas 100.000 baris")
            product = (row["product_name"] or "").strip()
            partner_id = (row["partner_id"] or "").strip()
            product_id = (row["product_id"] or "").strip()
            if product not in products or not partner_id or not product_id:
                raise ValueError(f"Produk atau identitas tidak valid pada baris {index}")
            key = (partner_id, product_id)
            if key in seen:
                raise ValueError(f"Pasangan mitra-produk ganda pada baris {index}")
            seen.add(key)
            try:
                qty = float(row["current_qty"] or "")
                buffer = float(row["par_level"] or "")
                weekly = float(row["weekly_consumption"] or "")
                cover = float(row["days_of_cover"] or "")
            except ValueError as error:
                raise ValueError(f"Angka tidak valid pada baris {index}") from error
            if not all(math.isfinite(value) and value >= 0 for value in (qty, buffer, weekly, cover)):
                raise ValueError(f"Angka negatif atau tidak terbatas pada baris {index}")
            label = ("urgent_restock" if qty <= buffer * 0.2 or cover < 2
                     else "regular_order" if qty <= buffer * 0.5 or cover < 6
                     else "normal")
            texts.append(f"Produk {product}. Sisa stok {qty:g} pcs, buffer minimal {buffer:g} pcs. "
                         f"Konsumsi 7 hari {weekly:g} pcs, cakupan stok {cover:g} hari.")
            labels.append(label)
            grouped[product]["partners"] += 1
            grouped[product]["weekly_units"] += weekly
            grouped[product]["cover_total"] += cover
    if not texts:
        raise ValueError("CSV Data Science tidak memiliki baris valid")
    summary = [
        {"product_name": product, "partner_count": str(int(values["partners"])),
         "weekly_consumption_total": f"{values['weekly_units']:.2f}",
         "average_days_of_cover": f"{values['cover_total'] / values['partners']:.2f}"}
        for product, values in sorted(grouped.items())
    ]
    return texts, labels, summary


def prepare_handoff(path: Path = INPUT, output: Path = OUTPUT) -> tuple[list[str], list[str], int]:
    texts, labels, summary = load_samples(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".csv.tmp")
    try:
        with temporary.open("w", newline="", encoding="utf-8") as target:
            writer = csv.DictWriter(target, fieldnames=["product_name", "partner_count", "weekly_consumption_total", "average_days_of_cover"])
            writer.writeheader()
            writer.writerows(summary)
        os.replace(temporary, output)
    finally:
        temporary.unlink(missing_ok=True)
    return texts, labels, len(summary)
