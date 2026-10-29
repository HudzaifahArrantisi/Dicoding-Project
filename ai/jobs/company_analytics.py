"""
Daisuki AI Analytics Engine: Analisis Perkembangan Mitra & Perusahaan
Menganalisis 3 Pilar:
1. Penjualan & Produk Laku (Kritis = Laris) + Saran Par Level Dinamis
2. Mitra Sering Kekurangan Stok (Defisit & Diagnosa Akar Masalah)
3. Pembelian & Kesiapan Gudang Pusat (Proyeksi Produksi Pabrik Lead Time 5-7 Hari)
"""

from __future__ import annotations

import math
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import psycopg

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(path: Path | None = None) -> None:
        env_path = path or Path(".env")
        if not env_path.exists():
            return
        for line in env_path.read_text(encoding="utf-8").splitlines():
            key, separator, value = line.partition("=")
            if separator and key.strip() and not key.lstrip().startswith("#"):
                os.environ.setdefault(key.strip(), value.strip().strip("'\""))

ROOT = Path(__file__).resolve().parents[2]
MODEL_VERSION = "v2.0-ai-company-analytics"
LEAD_TIME_DAYS = 6  # Lead time pengiriman ke mitra
FACTORY_LEAD_TIME_DAYS = 7  # Lead time produksi pabrik pusat


def get_db_url() -> str:
    load_dotenv(ROOT / "ai" / ".env")
    load_dotenv(ROOT / "apps" / "api" / ".env")
    load_dotenv(ROOT / ".env")
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL tidak ditemukan di environment.")
    return url


def run_company_analytics() -> dict[str, Any]:
    db_url = get_db_url()

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            # 1. Ambil data master produk & stok pusat
            cur.execute("""
                SELECT id::text, sku, name, unit, b2b_price, central_stock, is_active
                FROM products
                WHERE is_active = true
                ORDER BY name ASC
            """)
            product_rows = cur.fetchall()
            products_map: dict[str, dict[str, Any]] = {
                row[0]: {
                    "id": row[0],
                    "sku": row[1],
                    "name": row[2],
                    "unit": row[3],
                    "b2b_price": float(row[4]),
                    "central_stock": int(row[5]),
                }
                for row in product_rows
            }

            # 2. Ambil data master mitra
            cur.execute("""
                SELECT id::text, name, type, is_active
                FROM partners
                WHERE is_active = true
                ORDER BY name ASC
            """)
            partner_rows = cur.fetchall()
            partners_map: dict[str, dict[str, Any]] = {
                row[0]: {
                    "id": row[0],
                    "name": row[1],
                    "type": row[2],
                }
                for row in partner_rows
            }

            # 3. Ambil data partner_stocks aktual
            cur.execute("""
                SELECT ps.partner_id::text, ps.product_id::text, ps.current_qty, ps.par_level, ps.updated_at
                FROM partner_stocks ps
                JOIN partners p ON p.id = ps.partner_id AND p.is_active = true
                JOIN products pr ON pr.id = ps.product_id AND pr.is_active = true
            """)
            partner_stocks_list = [
                {
                    "partner_id": row[0],
                    "product_id": row[1],
                    "current_qty": int(row[2]),
                    "par_level": int(row[3]),
                    "updated_at": row[4],
                }
                for row in cur.fetchall()
            ]

            # 4. Ambil log konsumsi (penjualan) 30 hari terakhir (source = 'manual_update')
            cur.execute("""
                SELECT partner_id::text, product_id::text, qty_before, qty_after, created_at
                FROM stock_logs
                WHERE source = 'manual_update'
                  AND created_at >= NOW() - INTERVAL '30 days'
                  AND qty_before > qty_after
                ORDER BY created_at ASC
            """)
            consumption_logs = cur.fetchall()

            # 5. Ambil data pesanan restok 30 hari terakhir
            cur.execute("""
                SELECT o.id::text, o.order_no, o.partner_id::text, o.status,
                       o.created_at, o.completed_at,
                       oi.product_id::text, oi.qty_requested, COALESCE(oi.qty_approved, 0)
                FROM orders o
                JOIN order_items oi ON oi.order_id = o.id
                WHERE o.created_at >= NOW() - INTERVAL '30 days'
            """)
            order_rows = cur.fetchall()

            # 6. Hitung frekuensi kritis per pasangan (partner_id, product_id) dalam 30 hari
            cur.execute("""
                SELECT ps.partner_id::text, ps.product_id::text,
                       COUNT(sl.id) as critical_count
                FROM partner_stocks ps
                LEFT JOIN stock_logs sl ON sl.partner_id = ps.partner_id
                     AND sl.product_id = ps.product_id
                     AND sl.created_at >= NOW() - INTERVAL '30 days'
                     AND sl.qty_after <= GREATEST(10, ps.par_level * 0.2)
                GROUP BY ps.partner_id, ps.product_id
            """)
            critical_counts: dict[tuple[str, str], int] = {
                (row[0], row[1]): int(row[2]) for row in cur.fetchall()
            }

    # =========================================================================
    # A. HITUNG METRIK KONSUMSI & PENJUALAN (SALES VELOCITY)
    # =========================================================================
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    fourteen_days_ago = now - timedelta(days=14)

    # Agregasi konsumsi per (partner_id, product_id)
    consumption_7d: dict[tuple[str, str], int] = defaultdict(int)
    consumption_prev_7d: dict[tuple[str, str], int] = defaultdict(int)
    consumption_30d: dict[tuple[str, str], int] = defaultdict(int)
    daily_consumption_history: dict[tuple[str, str], dict[str, int]] = defaultdict(lambda: defaultdict(int))

    total_sales_7d = 0
    total_sales_prev_7d = 0
    total_sales_30d = 0

    for partner_id, product_id, qty_before, qty_after, created_at in consumption_logs:
        sold = qty_before - qty_after
        if sold <= 0:
            continue
        key = (partner_id, product_id)
        total_sales_30d += sold
        consumption_30d[key] += sold

        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        day_str = created_at.strftime("%Y-%m-%d")
        daily_consumption_history[key][day_str] += sold

        if created_at >= seven_days_ago:
            consumption_7d[key] += sold
            total_sales_7d += sold
        elif created_at >= fourteen_days_ago:
            consumption_prev_7d[key] += sold
            total_sales_prev_7d += sold

    sales_growth_pct = 0.0
    if total_sales_prev_7d > 0:
        sales_growth_pct = round(((total_sales_7d - total_sales_prev_7d) / total_sales_prev_7d) * 100, 1)

    # =========================================================================
    # B. ANALISIS PRODUK LAKU KERAS (KRITIS = LAKU) & REKOMENDASI PAR LEVEL
    # =========================================================================
    fast_moving_products = []
    stockout_deficit_analysis = []
    upsert_recommendations = []

    for item in partner_stocks_list:
        partner_id = item["partner_id"]
        product_id = item["product_id"]
        key = (partner_id, product_id)

        partner = partners_map.get(partner_id)
        product = products_map.get(product_id)
        if not partner or not product:
            continue

        current_qty = item["current_qty"]
        par_level = item["par_level"]
        sold_7d = consumption_7d.get(key, 0)
        adu = round(sold_7d / 7.0, 2)
        crit_count = critical_counts.get(key, 0)

        # Hitung Days of Cover
        days_of_cover = round(current_qty / adu, 1) if adu > 0 else (99.0 if current_qty > 0 else 0.0)

        # Standar Deviasi & Safety Stock
        daily_vals = [daily_consumption_history[key].get((now - timedelta(days=i)).strftime("%Y-%m-%d"), 0) for i in range(7)]
        variance = sum((v - adu) ** 2 for v in daily_vals) / 7.0
        std_dev = math.sqrt(variance)
        safety_stock = max(5, round(1.65 * std_dev * math.sqrt(LEAD_TIME_DAYS)))
        rop = round(adu * LEAD_TIME_DAYS + safety_stock)

        # Status Kritis = Laris:
        # Jika barang terjual banyak relatif terhadap par level (>60% par per minggu) ATAU
        # sering kritis (>=2 kali dalam 30 hari) dengan ADU aktif (>1.5 pcs/hari)
        turnover_rate = round((sold_7d / par_level) * 100, 1) if par_level > 0 else 0
        is_fast_moving = (turnover_rate >= 60.0 or crit_count >= 2) and adu >= 1.0

        # Rekomendasi Par Level Dinamis:
        # Par level mengikuti kebutuhan selama lead time dan stok pengaman.
        recommended_par_level = max(1, math.ceil(adu * LEAD_TIME_DAYS + safety_stock))

        par_expansion_needed = recommended_par_level > par_level

        if is_fast_moving or (par_expansion_needed and adu > 0):
            fast_moving_products.append({
                "partner_id": partner_id,
                "partner_name": partner["name"],
                "partner_type": partner["type"],
                "product_id": product_id,
                "product_name": product["name"],
                "product_sku": product["sku"],
                "current_qty": current_qty,
                "par_level": par_level,
                "weekly_consumption": sold_7d,
                "daily_velocity": adu,
                "critical_frequency": crit_count,
                "turnover_rate": turnover_rate,
                "suggested_par_level": recommended_par_level,
                "par_delta": recommended_par_level - par_level,
                "reason": (
                    f"Barang sangat laku (terjual {sold_7d} pcs/minggu). Tingkatkan pasokan restok "
                    f"karena {crit_count}x berstatus kritis. Saran pasokan: {recommended_par_level} pcs."
                    if par_expansion_needed else
                    f"Perputaran barang cepat (terjual {sold_7d} pcs/minggu)."
                ),
            })

        # =====================================================================
        # C. ANALISIS MITRA YANG SERING KEKURANGAN STOK (DEFISIT & ROOT CAUSE)
        # =====================================================================
        is_critically_low = current_qty <= max(10, par_level * 0.2) or days_of_cover < 2.0 or crit_count >= 3
        if is_critically_low:
            # Diagnosa Akar Masalah:
            # 1. UNDER_CAPACITY: Par level tidak memadai untuk menampung konsumsi selama lead time pengiriman
            # 2. LATE_REORDER: Stok sudah di bawah ROP tapi belum ada pesanan aktif
            # 3. SUPPLY_DEFICIT: Stok pusat minim atau pengiriman terakhir terlambat/kurang
            if par_level < round(adu * LEAD_TIME_DAYS):
                root_cause = "UNDER_CAPACITY"
                root_cause_label = "Laju Penjualan Cepat (Tingkat Konsumsi Tinggi)"
                action_rec = f"Laju penjualan sangat cepat (~{adu:.1f} pcs/hari). Tambahkan suplai pesanan restok hingga minimal {recommended_par_level} pcs."
            elif current_qty <= rop and days_of_cover < 2.0:
                root_cause = "LATE_REORDER"
                root_cause_label = "Keterlambatan Pesan Restok"
                action_rec = "Ingatkan mitra untuk segera memesan saat stok menyentuh titik pesan ulang (ROP)."
            else:
                root_cause = "SUPPLY_DEFICIT"
                root_cause_label = "Fluktuasi Pasokan & Kebutuhan Darurat"
                action_rec = f"Kirim suplai prioritas darurat dari stok pusat untuk mencegah kekosongan rak."

            risk_level = "DARURAT" if days_of_cover < 2.0 or current_qty <= 5 else "WASPADA"

            stockout_deficit_analysis.append({
                "partner_id": partner_id,
                "partner_name": partner["name"],
                "partner_type": partner["type"],
                "product_id": product_id,
                "product_name": product["name"],
                "current_qty": current_qty,
                "par_level": par_level,
                "days_of_cover": days_of_cover,
                "critical_frequency": crit_count,
                "root_cause": root_cause,
                "root_cause_label": root_cause_label,
                "risk_level": risk_level,
                "action_recommendation": action_rec,
            })

        # Siapkan saran kuantitas restok untuk restock_recommendations
        ideal_demand = max(0, recommended_par_level - current_qty)
        upsert_recommendations.append({
            "partner_id": partner_id,
            "product_id": product_id,
            "partner_name": partner["name"],
            "product_name": product["name"],
            "forecast_qty": round(adu * LEAD_TIME_DAYS),
            "suggested_qty": ideal_demand,
            "days_of_cover": days_of_cover,
            "is_emergency": days_of_cover < 2.0 or current_qty <= max(10, par_level * 0.2),
        })

    # Urutkan fast moving berdasarkan turnover & critical frequency
    fast_moving_products.sort(key=lambda x: (x["par_delta"], x["critical_frequency"], x["weekly_consumption"]), reverse=True)
    stockout_deficit_analysis.sort(key=lambda x: (0 if x["risk_level"] == "DARURAT" else 1, x["days_of_cover"]))

    # =========================================================================
    # D. ANALISIS RESTOK & EFISIENSI PEMENUHAN (FULFILLMENT RATE)
    # =========================================================================
    total_requested_units = 0
    total_approved_units = 0
    completed_orders_lead_time_hours = []

    for order_id, order_no, partner_id, status, created_at, completed_at, product_id, qty_req, qty_app in order_rows:
        total_requested_units += qty_req
        if status in ("disetujui", "dalam_pengiriman", "selesai"):
            total_approved_units += qty_app

        if status == "selesai" and completed_at and created_at:
            duration_h = (completed_at - created_at).total_seconds() / 3600.0
            if 0 < duration_h < 720:  # Validasi batas 30 hari
                completed_orders_lead_time_hours.append(duration_h)

    restock_fulfillment_rate = round((total_approved_units / total_requested_units) * 100, 1) if total_requested_units > 0 else 0.0
    avg_delivery_hours = round(sum(completed_orders_lead_time_hours) / len(completed_orders_lead_time_hours), 1) if completed_orders_lead_time_hours else None

    # =========================================================================
    # E. ANALISIS PEMBELIAN & KESIAPAN GUDANG PUSAT (PROYEKSI PRODUKSI PABRIK)
    # =========================================================================
    # Hitung total konsumsi mingguan seluruh mitra per produk
    total_demand_per_product: dict[str, int] = defaultdict(int)
    for (partner_id, product_id), sold in consumption_7d.items():
        total_demand_per_product[product_id] += sold

    factory_procurement_forecast = []
    total_central_stock_all = sum(p["central_stock"] for p in products_map.values())
    total_weekly_consumption_all = sum(total_demand_per_product.values())
    central_stock_health_days = round((total_central_stock_all / (total_weekly_consumption_all / 7.0)), 1) if total_weekly_consumption_all > 0 else None

    for prod_id, prod in products_map.items():
        c_stock = prod["central_stock"]
        weekly_dem = total_demand_per_product.get(prod_id, 0)
        daily_dem = weekly_dem / 7.0 if weekly_dem > 0 else 0.0
        runout_days = round(c_stock / daily_dem, 1) if daily_dem > 0 else None

        # Kebutuhan pesanan pabrik (memperhitungkan Factory Lead Time 7 hari + 14 hari buffer persediaan)
        target_buffer = round(daily_dem * (FACTORY_LEAD_TIME_DAYS + 14))
        suggested_batch = max(0, target_buffer - c_stock)
        # Pembulatan kelipatan karton pabrik (misal 50 atau 100 pcs)
        if suggested_batch > 0:
            suggested_batch = math.ceil(suggested_batch / 50.0) * 50

        urgency = "CRITICAL" if runout_days is not None and runout_days <= 7.0 else ("WARNING" if runout_days is not None and runout_days <= 14.0 else "HEALTHY")

        factory_procurement_forecast.append({
            "product_id": prod_id,
            "product_name": prod["name"],
            "product_sku": prod["sku"],
            "central_stock": c_stock,
            "total_partner_demand_weekly": weekly_dem,
            "estimated_runout_days": runout_days,
            "suggested_factory_batch_order": suggested_batch,
            "urgency": urgency,
        })

    factory_procurement_forecast.sort(key=lambda x: (0 if x["urgency"] == "CRITICAL" else (1 if x["urgency"] == "WARNING" else 2), x["estimated_runout_days"] if x["estimated_runout_days"] is not None else float("inf")))

    # =========================================================================
    # F. SIMPAN REKOMENDASI PINTAR KE DATABASE (RESTOCK_RECOMMENDATIONS)
    # =========================================================================
    # Alokasi prioritas berdasarkan ketersediaan stok pusat
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id::text, central_stock FROM products WHERE is_active = true")
            central_stocks = {row[0]: int(row[1]) for row in cur.fetchall()}

            # Urutkan berdasarkan kegawatan
            ranked_alloc = sorted(
                upsert_recommendations,
                key=lambda x: (0 if x["is_emergency"] else 1, float(x["days_of_cover"]))
            )

            upserted_count = 0
            for item in ranked_alloc:
                pid = item["product_id"]
                avail = central_stocks.get(pid, 0)
                allocated = min(item["suggested_qty"], avail)
                central_stocks[pid] = max(0, avail - allocated)

                cur.execute("""
                    INSERT INTO restock_recommendations
                        (partner_id, product_id, forecast_qty, suggested_qty, days_of_cover, model_version, generated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (partner_id, product_id) DO UPDATE SET
                        forecast_qty = EXCLUDED.forecast_qty,
                        suggested_qty = EXCLUDED.suggested_qty,
                        days_of_cover = EXCLUDED.days_of_cover,
                        model_version = EXCLUDED.model_version,
                        generated_at = NOW()
                """, (
                    item["partner_id"],
                    pid,
                    item["forecast_qty"],
                    allocated,
                    item["days_of_cover"],
                    MODEL_VERSION
                ))
                upserted_count += 1

            # Buat notifikasi jika ada produk darurat
            emergency_items = [i for i in ranked_alloc if i["is_emergency"] and i["suggested_qty"] > 0][:5]
            for emg in emergency_items:
                cur.execute("""
                    INSERT INTO notifications (audience, type, partner_id, title, body)
                    SELECT 'admin', 'low_stock', %s, %s, %s
                    WHERE NOT EXISTS (
                        SELECT 1 FROM notifications existing
                        WHERE existing.audience = 'admin'
                          AND existing.type = 'low_stock'
                          AND existing.partner_id = %s
                          AND existing.title = %s
                          AND existing.created_at >= NOW() - INTERVAL '12 hours'
                    )
                """, (
                    emg["partner_id"],
                    f"Prioritas Suplai: {emg['partner_name']}",
                    f"Produk {emg['product_name']} di {emg['partner_name']} berisiko kehabisan (sisa {emg['days_of_cover']} hari). Disarankan kirim {emg['suggested_qty']} pcs.",
                    emg["partner_id"],
                    f"Prioritas Suplai: {emg['partner_name']}"
                ))

            conn.commit()

    # =========================================================================
    # G. GENERATE AI EXECUTIVE DIGEST
    # =========================================================================
    top_fast = fast_moving_products[0] if fast_moving_products else None

    critical_procurement = [f for f in factory_procurement_forecast if f["urgency"] == "CRITICAL"]
    procurement_text = (
        f"Gudang pusat perlu memesan produksi pabrik segera untuk {len(critical_procurement)} produk "
        f"({', '.join(p['product_name'] for p in critical_procurement[:2])}) karena stok bertahan ≤ 7 hari."
        if critical_procurement else
        (f"Estimasi daya tahan stok gudang pusat {central_stock_health_days} hari berdasarkan konsumsi 7 hari terakhir." if central_stock_health_days is not None else "Belum ada konsumsi 7 hari terakhir untuk menghitung daya tahan stok pusat.")
    )

    ai_digest = {
        "headline": f"Perkembangan Bisnis: {total_sales_7d} pcs Terjual Minggu Ini ({'+' if sales_growth_pct >= 0 else ''}{sales_growth_pct}%)",
        "sales_insight": (f"{top_fast['product_name']} di {top_fast['partner_name']} mencatat {top_fast['weekly_consumption']} pcs konsumsi dalam 7 hari." if top_fast else "Belum ada produk dengan perputaran cepat yang teridentifikasi."),
        "restock_insight": (f"Tingkat pemenuhan restok jaringan mencapai {restock_fulfillment_rate}%. " + (f"Rata-rata waktu dari pemesanan hingga selesai {avg_delivery_hours} jam." if avg_delivery_hours is not None else "Belum ada pesanan selesai untuk menghitung waktu pemenuhan.")),
        "procurement_insight": procurement_text,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    result = {
        "engine_status": {
            "is_active": True,
            "last_run_at": datetime.now(timezone.utc).isoformat(),
            "version": MODEL_VERSION,
        },
        "kpi_summary": {
            "weekly_sales_units": total_sales_7d,
            "sales_growth_percentage": sales_growth_pct,
            "restock_fulfillment_rate": restock_fulfillment_rate,
            "central_stock_health_days": central_stock_health_days,
            "critical_high_turnover_count": len(fast_moving_products),
            "stockout_risk_count": len(stockout_deficit_analysis),
        },
        "fast_moving_products": fast_moving_products[:25],
        "stockout_deficit_analysis": stockout_deficit_analysis[:25],
        "factory_procurement_forecast": factory_procurement_forecast,
        "ai_digest": ai_digest,
        "upserted_recommendations": upserted_count,
    }

    print(
        f"[AI ENGINE] Analisis selesai: {total_sales_7d} pcs penjualan 7d, "
        f"{len(fast_moving_products)} produk laku keras teridentifikasi, "
        f"{len(stockout_deficit_analysis)} cabang rawan defisit, "
        f"{upserted_count} rekomendasi di-upsert."
    )
    return result


if __name__ == "__main__":
    run_company_analytics()
