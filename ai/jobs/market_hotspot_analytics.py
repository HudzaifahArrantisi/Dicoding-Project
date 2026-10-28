from __future__ import annotations

import json
from pathlib import Path

import psycopg

from company_analytics import get_db_url

OUTPUT = Path(__file__).resolve().parents[1] / "market_hotspot_digest.json"


def run() -> dict:
    with psycopg.connect(get_db_url()) as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT p.name, COALESCE(p.regency_name, 'Tidak diketahui'),
                       SUM(GREATEST(0, sl.qty_before-sl.qty_after))::int AS consumed
                FROM stock_logs sl JOIN partners p ON p.id=sl.partner_id
                WHERE sl.source='manual_update' AND sl.created_at >= now()-interval '7 days'
                GROUP BY p.id ORDER BY consumed DESC LIMIT 5
            """)
            performers = [{"partner": name, "region": region, "weekly_units": units} for name, region, units in cursor.fetchall()]
            cursor.execute("""
                SELECT COALESCE(p.regency_name, 'Tidak diketahui') AS region,
                       SUM(GREATEST(0, rr.suggested_qty))::int AS deficit,
                       COUNT(DISTINCT p.id)::int AS partners
                FROM restock_recommendations rr JOIN partners p ON p.id=rr.partner_id
                GROUP BY region ORDER BY deficit DESC LIMIT 3
            """)
            regions = [{"region": region, "deficit_units": deficit, "partners": partners} for region, deficit, partners in cursor.fetchall()]
            cursor.execute("""
                SELECT pr.name, COALESCE(d.demand, 0), pr.central_stock
                FROM products pr
                LEFT JOIN (SELECT product_id, SUM(GREATEST(0, suggested_qty))::int AS demand
                           FROM restock_recommendations GROUP BY product_id) d ON d.product_id=pr.id
                WHERE pr.is_active ORDER BY pr.name
            """)
            production = [{"product": name, "recommended_batch": max(0, demand - central), "demand_units": demand, "central_stock": central} for name, demand, central in cursor.fetchall()]
    digest = {"top_performers": performers, "hotspot_regions": regions, "production_batches": production}
    OUTPUT.write_text(json.dumps(digest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(digest, ensure_ascii=False))
    return digest


if __name__ == "__main__":
    run()
