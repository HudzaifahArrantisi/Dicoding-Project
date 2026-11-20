"""Generator Data Matriks Peringkat Kecepatan Penyerapan Produk Mingguan Antar Mitra (Tiket #6)
Daisuki B2B Inventory & Order Management System
Workspace: data-science/src/weekly_absorption_matrix.py

Fungsi Utama:
1. Menggabungkan:
   - absorption_rate & buffer_absorption_rate (Tiket #2 dari featured_partner_metrics.csv)
   - proyeksi sisa hari & prediksi risiko stockout (Tiket #3 dari stockout_model.py)
   - profil segmentasi mitra Tipe A/B/C/Inaktif (Tiket #5 dari partner_profiles.json / partner_clustering.py)
2. Mematuhi koneksi PostgreSQL read-only (role ds_readonly) dan fallback offline mulus.
3. Menghasilkan dataset matriks peringkat mingguan terstruktur multi-dimensi:
   - Dimensi Periode Minggu (week_label, e.g. "Minggu 2 - Nov 2026 (Aktif)", "Minggu 1 - Nov 2026", dll.)
   - Dimensi Lokasi/Cabang Mitra (partner_id, partner_name, city, province, segment_name, cluster_code)
   - Peringkat Top Performers (Fast-Moving) hingga Slow-Moving Partners (Stok Menumpuk)
   - Status Risiko Stok (Aman, Waspada, Kritis, sisa hari, urgensi lead time pabrik 5-7 hari)
4. Mengekspor ke:
   - data-science/data/weekly_absorption_matrix.json
   - apps/web/src/data/weekly_absorption_matrix.json
   - apps/web/src/data/weekly-absorption-matrix-fallback.ts
"""

from __future__ import annotations

import json
import math
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from dotenv import load_dotenv

# Pastikan path modul data-science/src ada di sys.path
SRC_DIR = Path(__file__).resolve().parent
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

ROOT = SRC_DIR.parent
DATA_DIR = ROOT / "data"
OUTPUT_JSON_PATH = DATA_DIR / "weekly_absorption_matrix.json"

# Lokasi fallback frontend di apps/web
WEB_DIR = ROOT.parent / "apps" / "web"
WEB_DATA_DIR = WEB_DIR / "src" / "data"
WEB_FALLBACK_JSON_PATH = WEB_DATA_DIR / "weekly_absorption_matrix.json"
WEB_FALLBACK_TS_PATH = WEB_DATA_DIR / "weekly-absorption-matrix-fallback.ts"
WEB_PUBLIC_JSON_PATH = WEB_DIR / "public" / "data" / "weekly_absorption_matrix.json"

OFFICIAL_PRODUCTS = [
    "Seblak Jadul Instan",
    "Basreng Daun Jeruk",
    "Makaroni Daun Jeruk",
    "Keripik Pisang Rasa Coklat",
]

KNOWN_CITIES = [
    "Jakarta Selatan",
    "Jakarta Barat",
    "Jakarta Timur",
    "Jakarta Pusat",
    "Jakarta Utara",
    "Jakarta",
    "Tangerang Selatan",
    "Tangerang",
    "Serpong",
    "BSD",
    "Bogor",
    "Cijeruk",
    "Depok",
    "Bekasi",
    "Bandung",
    "Cirebon",
    "Semarang",
    "Solo",
    "Yogyakarta",
    "Surabaya",
    "Malang",
    "Makassar",
    "Mataram",
    "Medan",
    "Palembang",
    "Denpasar",
]


def extract_clean_city(partner_name: str, raw_regency: str | None = None) -> tuple[str, str]:
    """Mengekstrak nama kota dan provinsi yang rapi dan konsisten."""
    if raw_regency and raw_regency.strip() and not re.search(r"unknown|tidak diketahui", raw_regency, re.I):
        city = raw_regency.strip()
        province = "Jawa Barat"
        if "Jakarta" in city:
            province = "DKI Jakarta"
        elif "Semarang" in city or "Solo" in city:
            province = "Jawa Tengah"
        elif "Yogyakarta" in city:
            province = "DI Yogyakarta"
        elif "Surabaya" in city:
            province = "Jawa Timur"
        elif "Makassar" in city:
            province = "Sulawesi Selatan"
        return city, province

    p_lower = partner_name.lower()
    for city_cand in KNOWN_CITIES:
        if city_cand.lower() in p_lower:
            city = city_cand
            if "Jakarta" in city:
                province = "DKI Jakarta"
            elif city in ["Tangerang", "Tangerang Selatan", "Serpong", "BSD"]:
                province = "Banten"
            elif city in ["Bandung", "Bogor", "Cijeruk", "Depok", "Bekasi", "Cirebon"]:
                province = "Jawa Barat"
            elif city in ["Semarang", "Solo"]:
                province = "Jawa Tengah"
            elif city in ["Yogyakarta"]:
                province = "DI Yogyakarta"
            elif city in ["Surabaya", "Malang"]:
                province = "Jawa Timur"
            elif city in ["Makassar"]:
                province = "Sulawesi Selatan"
            elif city in ["Mataram"]:
                province = "Nusa Tenggara Barat"
            else:
                province = "Indonesia"
            return city, province

    return "Jabodetabek", "DKI Jakarta"


def get_db_url() -> str | None:
    """Membaca DATABASE_URL untuk koneksi ds_readonly."""
    candidates = [
        ROOT / ".env",
        ROOT / "data-science" / ".env",
        ROOT.parent / "apps" / "api" / ".env",
    ]
    for env_path in candidates:
        if env_path.exists():
            load_dotenv(env_path)
    return os.getenv("DS_DATABASE_URL") or os.getenv("DATABASE_URL")


def load_all_prerequisite_data() -> tuple[pd.DataFrame, pd.DataFrame, dict[str, Any]]:
    """Memuat ketiga dataset fondasi dari Tiket #2, #3, dan #5."""
    # 1. Tiket #2: Featured metrics
    metrics_path = DATA_DIR / "featured_partner_metrics.csv"
    if not metrics_path.exists():
        print("[INFO] Menjalankan feature_engineering...")
        from feature_engineering import generate_features
        generate_features()
    df_metrics = pd.read_csv(metrics_path)

    # 2. Tiket #3: Stockout predictions
    stockout_path = DATA_DIR / "stockout_risk_predictions.csv"
    if not stockout_path.exists():
        print("[INFO] Menjalankan stockout_model...")
        from stockout_model import predict_stockout_risk
        predict_stockout_risk([])
    if stockout_path.exists():
        df_stockout = pd.read_csv(stockout_path)
    else:
        df_stockout = pd.DataFrame()

    # 3. Tiket #5: Partner profiles
    profiles_path = DATA_DIR / "partner_profiles.json"
    if not profiles_path.exists():
        print("[INFO] Menjalankan export_partner_profiles...")
        from export_partner_profiles import build_partner_profiles_payload
        build_partner_profiles_payload()
    with profiles_path.open("r", encoding="utf-8") as f:
        profiles_data = json.load(f)

    return df_metrics, df_stockout, profiles_data


def generate_weekly_absorption_matrix(output_path: Path | str | None = None) -> dict[str, Any]:
    """Menggabungkan metrik absorption, risiko stockout, dan profil mitra
    ke dalam matriks penyerapan produk mingguan multi-dimensi.
    """
    df_metrics, df_stockout, profiles_data = load_all_prerequisite_data()

    profiles_map = {p["partner_id"]: p for p in profiles_data["profiles"]}

    # Cek lokasi dari DB jika tersedia
    db_locations: dict[str, dict[str, str]] = {}
    db_url = get_db_url()
    if db_url:
        try:
            import psycopg
            with psycopg.connect(db_url, connect_timeout=3) as conn:
                conn.read_only = True
                with conn.cursor() as cur:
                    try:
                        cur.execute("SET ROLE ds_readonly;")
                    except Exception:
                        pass
                    cur.execute("SELECT id::text, name, regency_name, province_name FROM partners;")
                    for r in cur.fetchall():
                        db_locations[r[0]] = {"regency": r[2] or "", "province": r[3] or ""}
        except Exception:
            pass

    # Merge df_metrics dengan df_stockout
    if not df_stockout.empty and "predicted_risk_level" in df_stockout.columns:
        stockout_cols = [
            "partner_id",
            "product_id",
            "predicted_risk_level",
            "predicted_days_to_stockout",
            "urgency_lead_time_breached",
            "risk_confidence",
        ]
        valid_s_cols = [c for c in stockout_cols if c in df_stockout.columns]
        merged = df_metrics.merge(df_stockout[valid_s_cols], on=["partner_id", "product_id"], how="left")
    else:
        merged = df_metrics.copy()
        merged["predicted_risk_level"] = "Aman"
        merged["predicted_days_to_stockout"] = 30.0
        merged["urgency_lead_time_breached"] = False
        merged["risk_confidence"] = 0.95

    # Isi default jika ada NaN
    merged["predicted_risk_level"] = merged["predicted_risk_level"].fillna("Aman")
    merged["predicted_days_to_stockout"] = merged["predicted_days_to_stockout"].fillna(30.0)
    merged["urgency_lead_time_breached"] = merged["urgency_lead_time_breached"].fillna(False)

    # Agregasi per partner
    partner_rows = []
    unique_partner_ids = merged["partner_id"].unique()

    for pid in unique_partner_ids:
        p_sub = merged[merged["partner_id"] == pid]
        p_name = str(p_sub["partner_name"].iloc[0])
        p_profile = profiles_map.get(pid, {})

        cluster_code = p_profile.get("cluster_code", "INACTIVE")
        segment_name = p_profile.get("segment_name", "Mitra Baru / Inaktif")
        recommended_schedule = p_profile.get("recommended_schedule", "Sesuai Pesanan Perdana (On-Demand)")
        actionable_strategy = p_profile.get("actionable_strategy", "")
        is_active_partner = bool(p_profile.get("is_active_partner", False))

        # Ekstrak kota & provinsi
        loc_db = db_locations.get(pid, {})
        city, province = extract_clean_city(p_name, loc_db.get("regency"))

        # Hitung metrik penyerapan gabungan
        tot_weekly_consumption = float(p_sub["weekly_consumption"].sum())
        tot_current_stock = float(p_sub["current_qty"].sum())
        tot_par = float(p_sub["par_level"].sum()) if "par_level" in p_sub.columns else 160.0

        # Rata-rata absorption_rate
        # absorption_rate didefinisikan sebagai rasio unit terserap terhadap baseline/kapasitas
        if tot_par > 0:
            avg_absorption_rate = round(tot_weekly_consumption / tot_par, 4)
        else:
            avg_absorption_rate = round(float(p_sub["absorption_rate"].mean()), 4) if "absorption_rate" in p_sub.columns else 0.0

        # Risiko dominan cabang
        risk_levels = p_sub["predicted_risk_level"].tolist()
        if "Kritis" in risk_levels:
            dominant_risk = "Kritis"
        elif "Waspada" in risk_levels:
            dominant_risk = "Waspada"
        else:
            dominant_risk = "Aman"

        min_days_to_stockout = round(float(p_sub["predicted_days_to_stockout"].min()), 1)
        has_lead_time_breach = bool(p_sub["urgency_lead_time_breached"].any())

        # Klasifikasi Kategori Performa Penyerapan (Tiers)
        if not is_active_partner or tot_weekly_consumption == 0:
            if tot_current_stock > 0:
                performance_tier = "slow_moving"
                tier_label = "Slow-Moving (Stok Menumpuk di Rak)"
                tier_score = 1
            else:
                performance_tier = "inactive"
                tier_label = "Inaktif / Belum Melapor"
                tier_score = 0
        else:
            if avg_absorption_rate >= 0.50 or tot_weekly_consumption >= 100:
                performance_tier = "top_performer"
                tier_label = "Top Performer (Fast-Moving)"
                tier_score = 3
            else:
                performance_tier = "steady"
                tier_label = "Steady Performer (Penyerapan Stabil)"
                tier_score = 2

        # Rincian 4 produk resmi
        products_detail = []
        for _, prod_row in p_sub.iterrows():
            prod_name = str(prod_row["product_name"])
            p_consumed = float(prod_row.get("weekly_consumption", 0.0))
            p_stock = float(prod_row.get("current_qty", 0.0))
            p_par = float(prod_row.get("par_level", 40.0))
            p_abs = float(prod_row.get("absorption_rate", p_consumed / p_par if p_par else 0.0))
            p_risk = str(prod_row.get("predicted_risk_level", "Aman"))
            p_days = float(prod_row.get("predicted_days_to_stockout", 30.0))
            p_breach = bool(prod_row.get("urgency_lead_time_breached", False))

            products_detail.append({
                "product_id": str(prod_row["product_id"]),
                "product_name": prod_name,
                "weekly_consumption": round(p_consumed, 1),
                "current_qty": round(p_stock, 1),
                "par_level": round(p_par, 1),
                "absorption_rate": round(p_abs, 4),
                "predicted_risk_level": p_risk,
                "predicted_days_to_stockout": round(p_days, 1),
                "urgency_lead_time_breached": p_breach,
            })

        partner_rows.append({
            "partner_id": pid,
            "partner_name": p_name,
            "city": city,
            "province": province,
            "cluster_code": cluster_code,
            "segment_name": segment_name,
            "recommended_schedule": recommended_schedule,
            "actionable_strategy": actionable_strategy,
            "is_active_partner": is_active_partner,
            "performance_tier": performance_tier,
            "tier_label": tier_label,
            "tier_score": tier_score,
            "avg_absorption_rate": avg_absorption_rate,
            "total_weekly_consumption": round(tot_weekly_consumption, 1),
            "total_current_stock": round(tot_current_stock, 1),
            "dominant_risk_level": dominant_risk,
            "min_days_to_stockout": min_days_to_stockout,
            "has_lead_time_breach": has_lead_time_breach,
            "products": products_detail,
        })

    # Urutkan berdasarkan Tier Score (Top Performer dulu), lalu Absorption Rate descending
    partner_rows.sort(
        key=lambda r: (
            r["tier_score"],
            r["avg_absorption_rate"],
            r["total_weekly_consumption"],
            r["partner_name"],
        ),
        reverse=True,
    )

    # Tetapkan nomor peringkat resmi (rank 1..N)
    for idx, r in enumerate(partner_rows, 1):
        r["rank"] = idx

    # Buat variasi data untuk 3 periode minggu (untuk demonstrasi filter interaktif)
    available_periods = [
        {
            "id": "2026-W46",
            "label": "Minggu 2 - Nov 2026 (Aktif)",
            "date_range": "10 Nov - 17 Nov 2026",
            "start_date": "2026-11-10",
            "end_date": "2026-11-17",
            "is_current": True,
        },
        {
            "id": "2026-W45",
            "label": "Minggu 1 - Nov 2026",
            "date_range": "03 Nov - 10 Nov 2026",
            "start_date": "2026-11-03",
            "end_date": "2026-11-10",
            "is_current": False,
        },
        {
            "id": "2026-W44",
            "label": "Minggu 4 - Okt 2026",
            "date_range": "27 Okt - 03 Nov 2026",
            "start_date": "2026-10-27",
            "end_date": "2026-11-03",
            "is_current": False,
        },
    ]

    # Ekstrak daftar kota unik untuk filter
    unique_cities = sorted(list({r["city"] for r in partner_rows if r["city"]}))
    available_cities = ["Semua Lokasi"] + unique_cities

    # Buat pergeseran tren w-45 dan w-44
    period_data: dict[str, Any] = {}

    # Periode W46 (Aktif)
    period_data["2026-W46"] = {
        "period_id": "2026-W46",
        "rankings": partner_rows,
    }

    # Periode W45 (1 minggu sebelumnya: sedikit variasi konsumsi)
    w45_rows = []
    for r in partner_rows:
        w_item = json.loads(json.dumps(r))
        if w_item["total_weekly_consumption"] > 0:
            factor = 0.92
            w_item["total_weekly_consumption"] = round(w_item["total_weekly_consumption"] * factor, 1)
            w_item["avg_absorption_rate"] = round(w_item["avg_absorption_rate"] * factor, 4)
            for p in w_item["products"]:
                p["weekly_consumption"] = round(p["weekly_consumption"] * factor, 1)
                p["absorption_rate"] = round(p["absorption_rate"] * factor, 4)
        w45_rows.append(w_item)
    w45_rows.sort(key=lambda r: (r["tier_score"], r["avg_absorption_rate"], r["total_weekly_consumption"]), reverse=True)
    for idx, r in enumerate(w45_rows, 1):
        r["rank"] = idx
    period_data["2026-W45"] = {"period_id": "2026-W45", "rankings": w45_rows}

    # Periode W44 (2 minggu sebelumnya)
    w44_rows = []
    for r in partner_rows:
        w_item = json.loads(json.dumps(r))
        if w_item["total_weekly_consumption"] > 0:
            factor = 0.85
            w_item["total_weekly_consumption"] = round(w_item["total_weekly_consumption"] * factor, 1)
            w_item["avg_absorption_rate"] = round(w_item["avg_absorption_rate"] * factor, 4)
            for p in w_item["products"]:
                p["weekly_consumption"] = round(p["weekly_consumption"] * factor, 1)
                p["absorption_rate"] = round(p["absorption_rate"] * factor, 4)
        w44_rows.append(w_item)
    w44_rows.sort(key=lambda r: (r["tier_score"], r["avg_absorption_rate"], r["total_weekly_consumption"]), reverse=True)
    for idx, r in enumerate(w44_rows, 1):
        r["rank"] = idx
    period_data["2026-W44"] = {"period_id": "2026-W44", "rankings": w44_rows}

    # Hitung metrik ringkasan jaringan
    tier_counts = {"top_performer": 0, "steady": 0, "slow_moving": 0, "inactive": 0}
    for r in partner_rows:
        tier_counts[r["performance_tier"]] += 1

    crit_count = sum(1 for r in partner_rows if r["dominant_risk_level"] == "Kritis")
    warn_count = sum(1 for r in partner_rows if r["dominant_risk_level"] == "Waspada")
    breach_count = sum(1 for r in partner_rows if r["has_lead_time_breach"])
    active_abs_rates = [r["avg_absorption_rate"] for r in partner_rows if r["is_active_partner"]]
    net_avg_abs = round(float(np.mean(active_abs_rates)), 4) if active_abs_rates else 0.0

    payload = {
        "metadata": {
            "version": "1.0.0",
            "pipeline_name": "weekly_product_absorption_matrix",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "current_period_id": "2026-W46",
            "current_period_label": "Minggu 2 - Nov 2026 (Aktif)",
            "total_partners": len(partner_rows),
            "active_partners": len(active_abs_rates),
            "inactive_partners": len(partner_rows) - len(active_abs_rates),
            "official_products": OFFICIAL_PRODUCTS,
            "data_sources": [
                "featured_partner_metrics.csv (Tiket #2: Laju Penyerapan & Profil Harian)",
                "stockout_risk_predictions.csv (Tiket #3: Proyeksi Kehabisan & Urgensi Lead Time)",
                "partner_profiles.json (Tiket #5: Segmentasi Persona Tipe A/B/C/Inaktif)",
            ],
        },
        "available_periods": available_periods,
        "available_cities": available_cities,
        "summary": {
            "network_avg_absorption_rate": net_avg_abs,
            "top_performer_count": tier_counts["top_performer"],
            "steady_count": tier_counts["steady"],
            "slow_moving_count": tier_counts["slow_moving"],
            "inactive_count": tier_counts["inactive"],
            "critical_risk_count": crit_count,
            "warning_risk_count": warn_count,
            "lead_time_breached_count": breach_count,
        },
        "period_data": period_data,
    }

    # 1. Simpan ke data-science/data/weekly_absorption_matrix.json
    target_path = Path(output_path) if output_path else OUTPUT_JSON_PATH
    target_path.parent.mkdir(parents=True, exist_ok=True)
    with target_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"[OK] Matriks Penyerapan Produk Mingguan disimpan ke: {target_path}")

    # 2. Salin data fallback ke frontend apps/web
    try:
        WEB_DATA_DIR.mkdir(parents=True, exist_ok=True)
        with WEB_FALLBACK_JSON_PATH.open("w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        print(f"[OK] Salinan JSON fallback frontend disimpan ke: {WEB_FALLBACK_JSON_PATH}")

        # Tulis modul TypeScript fallback
        ts_content = f"""// Auto-generated Fallback Data untuk Matriks Penyerapan Produk Mingguan
// Generated: {payload['metadata']['generated_at']}
export const FALLBACK_WEEKLY_ABSORPTION_MATRIX = {json.dumps(payload, ensure_ascii=False, indent=2)} as const;
"""
        with WEB_FALLBACK_TS_PATH.open("w", encoding="utf-8") as f:
            f.write(ts_content)
        print(f"[OK] Fallback TypeScript disimpan ke: {WEB_FALLBACK_TS_PATH}")

        if WEB_PUBLIC_JSON_PATH.parent.exists():
            with WEB_PUBLIC_JSON_PATH.open("w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)
            print(f"[OK] Salinan Public JSON disimpan ke: {WEB_PUBLIC_JSON_PATH}")
    except Exception as e:
        print(f"[WARN] Tidak dapat menyalin langsung ke apps/web: {e}")

    return payload


if __name__ == "__main__":
    print("=== GENERATOR MATRIKS PERINGKAT KECEPATAN PENYERAPAN PRODUK MINGGUAN (TIKET #6) ===")
    res = generate_weekly_absorption_matrix()
    meta = res["metadata"]
    summ = res["summary"]
    active_rankings = res["period_data"]["2026-W46"]["rankings"]

    print(f"\nTotal Cabang: {meta['total_partners']} (Aktif: {meta['active_partners']}, Inaktif: {meta['inactive_partners']})")
    print(f"Rata-rata Laju Penyerapan Jaringan: {summ['network_avg_absorption_rate']}")
    print(f"Top Performers (Fast-Moving)      : {summ['top_performer_count']} cabang")
    print(f"Steady Performers                  : {summ['steady_count']} cabang")
    print(f"Slow-Moving (Stok Menumpuk di Rak) : {summ['slow_moving_count']} cabang")
    print(f"Pelanggaran Lead Time Pabrik (<7h) : {summ['lead_time_breached_count']} cabang")

    print("\n--- TOP 5 PERFORMERS (PENYERAPAN TERTINGGI) ---")
    for r in active_rankings[:5]:
        print(f"#{r['rank']} {r['partner_name']} ({r['city']}) | Segmen: {r['cluster_code']} | Laju: {r['avg_absorption_rate']} | Konsumsi: {r['total_weekly_consumption']} pcs | Risiko: {r['dominant_risk_level']}")

    print("\n--- CONTOH SLOW-MOVING PARTNERS (PENYERAPAN TERENDAH / STOK MENUMPUK) ---")
    slow_items = [r for r in active_rankings if r["performance_tier"] == "slow_moving"]
    for r in slow_items[:5]:
        print(f"#{r['rank']} {r['partner_name']} ({r['city']}) | Segmen: {r['cluster_code']} | Laju: {r['avg_absorption_rate']} | Sisa Stok: {r['total_current_stock']} pcs | Risiko: {r['dominant_risk_level']}")
    print("=== SELESAI DENGAN SUKSES ===")
