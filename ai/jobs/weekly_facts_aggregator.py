"""Build one weekly operational snapshot from PostgreSQL and regional analysis."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

import psycopg

from company_analytics import get_db_url

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "data" / "mainbrain" / "context_embeddings" / "weekly_operational_facts.json"
REGIONAL = ROOT / "data" / "mainbrain" / "context_embeddings" / "regional_stockout_insights.json"
MODEL_VERSION = "daisuki-nb-3.0"


def category_for(name: str) -> str:
    lower = name.casefold()
    if "seblak" in lower:
        return "Makanan Instan"
    if any(word in lower for word in ("basreng", "makaroni", "keripik pisang")):
        return "Camilan"
    return "Belum dikategorikan"


def percentage(numerator: int, denominator: int) -> float:
    return round(numerator * 100 / denominator, 1) if denominator else 0.0


def build_facts(connection: psycopg.Connection, regional: dict) -> dict:
    with connection.cursor() as cursor:
        cursor.execute("select id::text, name, sku, central_stock from products where is_active order by name")
        products = [
            {"id": product_id, "name": name, "sku": sku, "central_stock": stock, "category": category_for(name)}
            for product_id, name, sku, stock in cursor.fetchall()
        ]
        cursor.execute("""
            select
              coalesce(sum(greatest(qty_before - qty_after, 0)) filter (where created_at >= now() - interval '7 days'), 0)::int,
              coalesce(sum(greatest(qty_before - qty_after, 0)) filter (where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days'), 0)::int
            from stock_logs where source = 'manual_update' and created_at >= now() - interval '14 days'
        """)
        sold, previous = cursor.fetchone()
        cursor.execute("""
            select coalesce(sum(oi.qty_requested), 0)::int,
              coalesce(sum(oi.qty_approved) filter (where o.status in ('disetujui', 'dalam_pengiriman', 'selesai')), 0)::int
            from order_items oi join orders o on o.id = oi.order_id
            where o.created_at >= now() - interval '7 days' and o.status not in ('ditolak', 'dibatalkan')
        """)
        requested, approved = cursor.fetchone()
        cursor.execute("""
            select p.name, coalesce(nullif(p.regency_name, ''), 'Wilayah belum diisi'),
              sum(greatest(sl.qty_before - sl.qty_after, 0))::int
            from stock_logs sl join partners p on p.id = sl.partner_id
            where sl.source = 'manual_update' and sl.created_at >= now() - interval '7 days'
            group by p.id order by 3 desc, p.name limit 5
        """)
        partners = [
            {"rank": rank, "partner_name": name, "region": region, "weekly_units": units,
             "percentage": percentage(units, sold)}
            for rank, (name, region, units) in enumerate(cursor.fetchall(), 1)
        ]
        cursor.execute("""
            select p.name, coalesce(nullif(p.regency_name, ''), 'Wilayah belum diisi'),
              count(*)::int,
              count(*) filter (where sl.source = 'manual_update')::int
            from stock_logs sl join partners p on p.id = sl.partner_id
            where sl.created_at >= now() - interval '7 days'
            group by p.id order by 3 desc, p.name limit 10
        """)
        top_log_partners = [
            {"rank": rank, "partner_name": name, "region": region,
             "log_count": log_count, "manual_report_count": manual_count}
            for rank, (name, region, log_count, manual_count) in enumerate(cursor.fetchall(), 1)
        ]
        cursor.execute("""
            select pr.name, sum(greatest(sl.qty_before - sl.qty_after, 0))::int
            from stock_logs sl join products pr on pr.id = sl.product_id
            where sl.source = 'manual_update' and sl.created_at >= now() - interval '7 days'
            group by pr.id order by 2 desc, pr.name
        """)
        top_products = [
            {"rank": rank, "product_name": name, "category": category_for(name),
             "weekly_units": units, "share_pct": percentage(units, sold)}
            for rank, (name, units) in enumerate(cursor.fetchall(), 1)
        ]
        cursor.execute("""
            select coalesce(nullif(p.province_name, ''), 'Tidak diketahui'),
              coalesce(nullif(p.regency_name, ''), 'Tidak diketahui'),
              count(distinct p.id)::int,
              sum(greatest(sl.qty_before - sl.qty_after, 0))::int
            from stock_logs sl join partners p on p.id = sl.partner_id
            where sl.source = 'manual_update' and sl.created_at >= now() - interval '7 days'
              and sl.qty_before > sl.qty_after
            group by 1, 2
        """)
        regional_sales = {
            (province, region): {"active_partners": partners_count, "weekly_units": units}
            for province, region, partners_count, units in cursor.fetchall()
        }

    categories: dict[str, int] = {}
    for product in top_products:
        categories[product["category"]] = categories.get(product["category"], 0) + product["weekly_units"]
    top_categories = [
        {"category": category, "weekly_units": units, "share_pct": percentage(units, sold)}
        for category, units in sorted(categories.items(), key=lambda item: (-item[1], item[0]))
    ]
    hotspots = [
        {"region": item.get("regency_name", "Wilayah belum diisi"),
         "province": item.get("province_name", ""),
         "status": item.get("regional_zone", "ZONA_HIJAU"),
         "active_partners": regional_sales.get((item.get("province_name"), item.get("regency_name")), {}).get("active_partners", 0),
         "weekly_units": regional_sales.get((item.get("province_name"), item.get("regency_name")), {}).get("weekly_units", 0),
         "stockout_probability": item.get("peak_stockout_probability", 0),
         "urgency": "DARURAT" if item.get("regional_zone") == "ZONA_MERAH" else "WASPADA" if item.get("regional_zone") == "ZONA_KUNING" else "NORMAL",
         "recommended_action": item.get("recommended_action", "")}
        for item in regional.get("regional_rankings", [])
    ]
    total_stock = sum(item["central_stock"] for item in products)
    return {
        "metadata": {"generated_at": datetime.now(timezone.utc).isoformat(), "period_days": 7,
                     "model_version": MODEL_VERSION, "regional_generated_at": regional.get("generated_at")},
        "central_warehouse": {"total_stock_units": total_stock, "products": products},
        "network_sales": {"total_sold_7d": sold, "total_sold_prev_7d": previous,
                          "sales_growth_percentage": round((sold - previous) * 100 / previous, 1) if previous else None,
                          "restock_fulfillment_rate": percentage(approved, requested) if requested else None,
                          "central_stock_health_days": round(total_stock / (sold / 7), 1) if sold else None,
                          "requested_restock_units": requested, "approved_restock_units": approved},
        "top_performers_partners": partners,
        "top_log_partners": top_log_partners,
        "top_selling_products": top_products,
        "top_selling_categories": top_categories,
        "regional_hotspots": hotspots,
    }


def run() -> dict:
    if not REGIONAL.is_file():
        raise RuntimeError("Hasil naive bayes wilayah belum tersedia; jalankan job regional terlebih dahulu")
    regional = json.loads(REGIONAL.read_text(encoding="utf-8"))
    if not isinstance(regional.get("regional_rankings"), list) or not regional.get("generated_at"):
        raise ValueError("Hasil naive bayes wilayah tidak valid")
    with psycopg.connect(get_db_url(), connect_timeout=10) as connection:
        facts = build_facts(connection, regional)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix(".json.tmp")
    try:
        with temporary.open("w", encoding="utf-8") as target:
            json.dump(facts, target, ensure_ascii=False, indent=2)
            target.flush()
            os.fsync(target.fileno())
        os.replace(temporary, OUTPUT)
    finally:
        temporary.unlink(missing_ok=True)
    print(f"Fakta mingguan tersimpan: {OUTPUT}")
    return facts


if __name__ == "__main__":
    run()
