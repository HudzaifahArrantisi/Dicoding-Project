"""Publish the Data Science snapshot with Naive Bayes regional risk."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from run_context import source_file, stage_dir, run_id

ROOT = Path(__file__).resolve().parents[2]
SOURCE = source_file("weekly_analytics_summary.json")
REGIONAL = stage_dir() / "regional_stockout_insights.json"
OUTPUT = stage_dir() / "weekly_operational_facts.json"


def percentage(numerator: int, denominator: int) -> float:
    return round(numerator * 100 / denominator, 1) if denominator else 0.0


def build_facts(source: dict, regional: dict) -> dict:
    if regional.get("source_generated_at") != source.get("metadata", {}).get("generated_at"):
        raise ValueError("Skor Naive Bayes tidak cocok dengan laporan Data Science terbaru")
    if run_id() and regional.get("source_run_id") != run_id():
        raise ValueError("Skor Naive Bayes berasal dari run lain")
    sales = source["network_sales"]
    sold, previous = sales["total_sold_7d"], sales["total_sold_prev_7d"]
    requested, approved = sales["requested_restock_units"], sales["approved_restock_units"]
    days = source["metadata"]["period_days"]
    warehouse = [{"id": p["product_id"], "name": p["product_name"], "sku": p["sku"],
                  "central_stock": p["central_stock"],
                  "category": next((x["category"] for x in source["products"] if x["product_id"] == p["product_id"]), "")}
                 for p in source["warehouse"]]
    categories: dict[str, int] = {}
    for product in source["products"]:
        categories[product["category"]] = categories.get(product["category"], 0) + product["weekly_units"]
    region_facts = {(r["province_name"], r["regency_name"]): r for r in source["regions"]}
    hotspots = []
    for item in regional["regional_rankings"]:
        facts = region_facts.get((item["province_name"], item["regency_name"]), {})
        zone = item["regional_zone"]
        hotspots.append({"region": item["regency_name"], "province": item["province_name"],
                         "status": zone, "active_partners": facts.get("active_partners", 0),
                         "weekly_units": facts.get("weekly_units", 0),
                         "stockout_probability": item["peak_stockout_probability"],
                         "urgency": "DARURAT" if zone == "ZONA_MERAH" else "WASPADA" if zone == "ZONA_KUNING" else "NORMAL",
                         "recommended_action": item["recommended_action"]})
    return {
        "metadata": {"generated_at": datetime.now(timezone.utc).isoformat(), "period_days": days,
                     "start_date": source["metadata"]["start_date"], "end_date": source["metadata"]["end_date"],
                     "source_run_id": run_id(),
                     "model_version": regional["model_version"], "source_generated_at": source["metadata"]["generated_at"],
                     "regional_generated_at": regional["generated_at"]},
        "central_warehouse": {"total_stock_units": sum(p["central_stock"] for p in warehouse), "products": warehouse},
        "network_sales": {"total_sold_7d": sold, "total_sold_prev_7d": previous,
                          "sales_growth_percentage": round((sold - previous) * 100 / previous, 1) if previous else None,
                          "restock_fulfillment_rate": percentage(approved, requested) if requested else None,
                          "central_stock_health_days": round(sum(p["central_stock"] for p in warehouse) / (sold / days), 1) if sold else None,
                          "requested_restock_units": requested, "approved_restock_units": approved},
        "top_performers_partners": [{"rank": p["rank"], "partner_name": p["partner_name"],
                                      "region": p["regency_name"], "weekly_units": p["weekly_units"],
                                      "percentage": percentage(p["weekly_units"], sold)} for p in source["partners"][:5]],
        "top_log_partners": [{"rank": i, "partner_name": p["partner_name"], "region": p["regency_name"],
                               "log_count": p["log_count"], "manual_report_count": p["log_count"]}
                              for i, p in enumerate(source["reporting"][:10], 1)],
        "top_selling_products": [{k: p[k] for k in ("rank", "product_name", "category", "weekly_units", "share_pct")}
                                 for p in source["products"]],
        "top_selling_categories": [{"category": name, "weekly_units": units, "share_pct": percentage(units, sold)}
                                   for name, units in sorted(categories.items(), key=lambda item: -item[1])],
        "regional_hotspots": hotspots,
    }


def run() -> dict:
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    regional = json.loads(REGIONAL.read_text(encoding="utf-8"))
    facts = build_facts(source, regional)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix(".json.tmp")
    try:
        temporary.write_text(json.dumps(facts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(temporary, OUTPUT)
    finally:
        temporary.unlink(missing_ok=True)
    print(f"Fakta mingguan tersimpan: {OUTPUT}")
    return facts


if __name__ == "__main__":
    run()
