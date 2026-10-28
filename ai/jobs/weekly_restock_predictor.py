from __future__ import annotations

import json
import math
from collections import defaultdict
from statistics import pstdev

import psycopg

from company_analytics import get_db_url

MODEL_VERSION = "weekly-demand-v1"
LEAD_DAYS = 6


def predict(weekly_units: list[int], current_qty: int, par_level: int) -> dict:
    recent = weekly_units[-8:]
    if recent:
        weighted = sum(value * (index + 1) for index, value in enumerate(recent)) / sum(range(1, len(recent) + 1))
        volatility = pstdev(recent) if len(recent) > 1 else 0
        forecast = math.ceil(weighted)
    else:
        volatility = 0
        forecast = 0
    safety = math.ceil(1.65 * volatility / 7 * math.sqrt(LEAD_DAYS))
    rop = math.ceil(forecast / 7 * LEAD_DAYS + safety)
    recommended = max(0, forecast + safety - current_qty)
    cover = round(current_qty / (forecast / 7), 1) if forecast else 99.0
    urgency = "CRITICAL" if current_qty <= 10 or cover < 2 else "WARNING" if current_qty < rop or cover < LEAD_DAYS else "NORMAL"
    fast_moving = forecast >= 10 and (current_qty < par_level * .2 or current_qty <= 10)
    return {"predicted_demand_units": forecast, "recommended_qty": recommended, "urgency": urgency,
            "reasoning": f"Konsumsi diproyeksikan {forecast} pcs per minggu; stok {current_qty} pcs, cadangan {safety} pcs. " + ("Stok kritis sejalan dengan perputaran cepat." if fast_moving else "Prioritas mengikuti estimasi hari cakupan."),
            "safety_stock": safety, "reorder_point": rop, "days_of_cover": min(999.0, cover), "critical_fast_moving": fast_moving}


def run() -> int:
    with psycopg.connect(get_db_url()) as connection:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT ps.partner_id::text, ps.product_id::text, ps.current_qty, ps.par_level,
                       p.name, pr.name, pr.central_stock
                FROM partner_stocks ps
                JOIN partners p ON p.id = ps.partner_id AND p.is_active
                JOIN products pr ON pr.id = ps.product_id AND pr.is_active
            """)
            stocks = cursor.fetchall()
            cursor.execute("""
                SELECT partner_id::text, product_id::text,
                       date_trunc('week', created_at AT TIME ZONE 'Asia/Jakarta')::date,
                       SUM(qty_before - qty_after)::int
                FROM stock_logs
                WHERE source = 'manual_update' AND qty_before >= qty_after
                  AND created_at >= now() - interval '56 days'
                GROUP BY 1, 2, 3 ORDER BY 3
            """)
            history = defaultdict(list)
            for partner_id, product_id, _, units in cursor.fetchall():
                history[(partner_id, product_id)].append(units)
            cursor.execute("SELECT product_id::text, SUM(qty_approved)::int FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status IN ('disetujui','dalam_pengiriman') GROUP BY product_id")
            pending = {product_id: qty for product_id, qty in cursor.fetchall()}
            generated = 0
            for partner_id, product_id, qty, par, partner_name, product_name, central in stocks:
                result = predict(history[(partner_id, product_id)], qty, par)
                result["reasoning"] = f"{product_name} di {partner_name}: {result['reasoning']}"
                result["pending_units"] = pending.get(product_id, 0)
                cursor.execute("""
                    INSERT INTO restock_recommendations
                        (partner_id, product_id, forecast_qty, suggested_qty, days_of_cover, model_version, metadata, generated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, now())
                    ON CONFLICT (partner_id, product_id) DO UPDATE SET
                        forecast_qty=EXCLUDED.forecast_qty, suggested_qty=EXCLUDED.suggested_qty,
                        days_of_cover=EXCLUDED.days_of_cover, model_version=EXCLUDED.model_version,
                        metadata=EXCLUDED.metadata, generated_at=now()
                """, (partner_id, product_id, result["predicted_demand_units"], result["recommended_qty"], result["days_of_cover"], MODEL_VERSION, json.dumps(result)))
                generated += 1
        connection.commit()
    print(f"Rekomendasi mingguan diperbarui: {generated}")
    return generated


if __name__ == "__main__":
    run()
