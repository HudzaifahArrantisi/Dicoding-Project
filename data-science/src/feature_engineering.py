"""Modul Feature Engineering Kecepatan Penyerapan & Pola Transaksi Mitra
Daisuki B2B Inventory & Order Management System
Workspace: data-science/src/feature_engineering.py

Menghasilkan fitur-fitur analisis tingkat lanjut untuk setiap pasangan mitra-produk
serta agregat per mitra:
1. Kecepatan Penyerapan & Tren:
   - absorption_rate: weekly_consumption / (current_qty + weekly_consumption)
   - buffer_absorption_rate: weekly_consumption / par_level
   - wow_growth_rate: pertumbuhan konsumsi minggu ini vs minggu sebelumnya
2. Pola Waktu Konsumsi Harian (Bahan Clustering Profil Tipe A/B/C):
   - weekend_share: proporsi konsumsi hari Sabtu & Minggu (Indikator Tipe A: Ramai Akhir Pekan)
   - midweek_share: proporsi konsumsi hari Rabu & Kamis (Indikator Tipe C: Lonjakan Tengah Minggu)
   - weekday_base_share: proporsi konsumsi Senin, Selasa, Jumat
   - daily_cv: koefisien variasi konsumsi harian (Indikator Tipe B: Stabil Harian)
3. Utilisasi & Kepatuhan:
   - stock_utilization_ratio: current_qty / par_level
   - hours_since_last_report: jeda waktu (jam) sejak laporan stok fisik terakhir

File output disimpan di:
  data-science/data/featured_partner_metrics.csv

ATURAN KEAMANAN & ARSITEKTUR:
- Koneksi ke database wajib menggunakan role 'ds_readonly' (read-only mode).
- File output CSV di data-science/data/ ter-ignore oleh Git (.gitignore).
- Bebas dari nilai NaN atau inf pada seluruh kalkulasi numerik.
"""

from __future__ import annotations

import csv
import math
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

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

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
CLEANED_SUMMARY_PATH = DATA_DIR / "cleaned_inventory_summary.csv"
RAW_LOGS_PATH = DATA_DIR / "raw_stock_logs.csv"
FEATURED_METRICS_PATH = DATA_DIR / "featured_partner_metrics.csv"
SENTINEL_HOURS = 999.0

FEATURE_COLUMNS = [
    # Identitas & Referensi Produk
    "partner_id",
    "partner_name",
    "product_id",
    "product_name",
    "current_qty",
    "par_level",
    "data_source",
    "is_synthetic",
    # 1. Kecepatan Penyerapan & Tren
    "weekly_consumption",
    "prev_weekly_consumption",
    "adu",
    "absorption_rate",
    "buffer_absorption_rate",
    "wow_growth_rate",
    # 2. Pola Waktu Konsumsi Harian (Bahan Clustering)
    "weekend_share",
    "midweek_share",
    "weekday_base_share",
    "daily_cv",
    # 3. Utilisasi & Kepatuhan
    "stock_utilization_ratio",
    "hours_since_last_report",
    "item_profile_type",
    # Agregat per Mitra (Store-Level Attributes)
    "partner_total_stock",
    "partner_total_weekly_consumption",
    "partner_stock_utilization_ratio",
    "partner_weekend_share",
    "partner_midweek_share",
    "partner_weekday_base_share",
    "partner_daily_cv",
    "partner_hours_since_last_report",
    "partner_profile_type",
]


def parse_time(value: str) -> datetime:
    """Mengubah format ISO waktu UTC menjadi datetime timezone-aware."""
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


def get_db_url() -> str | None:
    """Membaca DATABASE_URL untuk koneksi ds_readonly."""
    candidates = [
        ROOT / ".env",
        ROOT / "data-science" / ".env",
        ROOT / "apps" / "api" / ".env",
    ]
    for env_path in candidates:
        if env_path.exists():
            load_dotenv(env_path)
    return os.getenv("DS_DATABASE_URL") or os.getenv("DATABASE_URL")


def load_data(
    use_db_if_available: bool = True,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Memuat data inventaris dan log transaksi.

    Mencoba koneksi PostgreSQL dengan role ds_readonly jika tersedia,
    lalu secara mulus beralih ke file lokal CSV jika koneksi offline.
    """
    inventory_rows: list[dict[str, Any]] | None = None
    log_rows: list[dict[str, Any]] | None = None

    if use_db_if_available:
        db_url = get_db_url()
        if db_url:
            try:
                import psycopg
                # Menegakkan mode read-only transaksi PostgreSQL
                with psycopg.connect(db_url, connect_timeout=4) as conn:
                    conn.read_only = True
                    with conn.cursor() as cur:
                        try:
                            cur.execute("SET ROLE ds_readonly;")
                        except Exception:
                            pass

                        cur.execute("""
                            SELECT sl.id AS log_id, sl.partner_id::text, pa.name AS partner_name,
                                   sl.product_id::text, pr.name AS product_name, sl.qty_before,
                                   sl.qty_after, sl.source::text, sl.created_at
                            FROM stock_logs sl
                            JOIN partners pa ON pa.id = sl.partner_id
                            JOIN products pr ON pr.id = sl.product_id
                            WHERE pa.is_active AND pr.is_active
                            ORDER BY sl.created_at ASC
                        """)
                        names = [col.name for col in cur.description]
                        log_rows = [dict(zip(names, [str(v) if not isinstance(v, datetime) else v.isoformat() for v in r])) for r in cur.fetchall()]
            except Exception:
                log_rows = None

    # Fallback ke file lokal raw_stock_logs.csv
    if log_rows is None:
        if RAW_LOGS_PATH.exists():
            with RAW_LOGS_PATH.open(newline="", encoding="utf-8-sig") as handle:
                log_rows = list(csv.DictReader(handle))
        else:
            log_rows = []

    # Memuat ringkasan stok inventaris
    if CLEANED_SUMMARY_PATH.exists():
        with CLEANED_SUMMARY_PATH.open(newline="", encoding="utf-8-sig") as handle:
            inventory_rows = list(csv.DictReader(handle))
    else:
        raise FileNotFoundError(
            f"Dataset inventaris {CLEANED_SUMMARY_PATH} tidak ditemukan. "
            "Jalankan data-science/src/clean_logs.py lebih dulu."
        )

    return inventory_rows, log_rows


def classify_profile(
    weekend_share: float,
    midweek_share: float,
    daily_cv: float,
    total_volume: float,
) -> str:
    """Mengklasifikasikan pola transaksi cabang ke dalam profil Tipe A, B, atau C.

    - Tipe A (Ramai Akhir Pekan): weekend_share >= 0.40
    - Tipe C (Lonjakan Tengah Minggu): midweek_share >= 0.35
    - Tipe B (Stabil Harian): daily_cv <= 0.60 dan volume konsumsi > 0
    - Inaktif: total_volume == 0
    - Tipe Campuran: Pola terdistribusi merata tanpa lonjakan tajam
    """
    if total_volume <= 0.0:
        return "Inaktif (Belum Ada Penjualan)"
    if weekend_share >= 0.40:
        return "Tipe A (Ramai Akhir Pekan)"
    if midweek_share >= 0.35:
        return "Tipe C (Lonjakan Tengah Minggu)"
    if daily_cv <= 0.60:
        return "Tipe B (Stabil Harian)"
    return "Tipe Campuran (Regular)"


def compute_features(
    inventory_rows: list[dict[str, Any]] | None = None,
    log_rows: list[dict[str, Any]] | None = None,
    reference_time: datetime | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Fungsi utama feature engineering.

    Menghitung fitur Kecepatan Penyerapan, Pola Waktu Konsumsi,
    serta Utilisasi & Kepatuhan per pasangan mitra-produk dan agregat per mitra.
    """
    if inventory_rows is None or log_rows is None:
        inv, logs = load_data()
        inventory_rows = inventory_rows if inventory_rows is not None else inv
        log_rows = log_rows if log_rows is not None else logs

    # Filter dan parsing log valid (hanya manual_update dengan penurunan stok positif)
    valid_logs: list[dict[str, Any]] = []
    for r in log_rows:
        if r.get("source") != "manual_update":
            continue
        try:
            before, after = int(r["qty_before"]), int(r["qty_after"])
            if before >= after and before >= 0 and after >= 0:
                moment = parse_time(r["created_at"])
                valid_logs.append({
                    "log_id": r.get("log_id"),
                    "partner_id": str(r["partner_id"]),
                    "partner_name": r.get("partner_name", ""),
                    "product_id": str(r["product_id"]),
                    "product_name": r.get("product_name", ""),
                    "qty_before": before,
                    "qty_after": after,
                    "consumption": before - after,
                    "moment": moment,
                    "weekday": moment.weekday(),  # 0: Mon, 1: Tue, ..., 6: Sun
                })
        except (ValueError, TypeError, KeyError):
            continue

    # Tentukan waktu referensi evaluasi (T)
    if reference_time is not None:
        t_ref = reference_time.astimezone(timezone.utc)
    elif valid_logs:
        max_log = max(r["moment"] for r in valid_logs)
        now_utc = datetime.now(timezone.utc)
        t_ref = max_log if (now_utc - max_log).days > 30 else now_utc
    else:
        t_ref = datetime.now(timezone.utc)

    # Jendela Waktu Mingguan
    # Minggu ini: [t_ref - 7 hari, t_ref]
    # Minggu sebelumnya: [t_ref - 14 hari, t_ref - 7 hari)
    w_curr_start = t_ref - timedelta(days=7)
    w_prev_start = t_ref - timedelta(days=14)

    # Pengelompokan log per (partner_id, product_id) dan per partner_id
    pair_logs: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    partner_logs: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for log in valid_logs:
        key = (log["partner_id"], log["product_id"])
        pair_logs[key].append(log)
        partner_logs[log["partner_id"]].append(log)

    # Hitung Agregat di Tingkat Mitra (Store-Level Attributes)
    partner_aggregates: dict[str, dict[str, Any]] = {}
    for partner_id, p_logs in partner_logs.items():
        total_hist_consumed = sum(r["consumption"] for r in p_logs)

        # Distribusi Hari
        p_weekend = sum(r["consumption"] for r in p_logs if r["weekday"] in (5, 6))
        p_midweek = sum(r["consumption"] for r in p_logs if r["weekday"] in (2, 3))
        p_base = sum(r["consumption"] for r in p_logs if r["weekday"] in (0, 1, 4))

        p_weekend_share = round(p_weekend / total_hist_consumed, 4) if total_hist_consumed > 0 else 0.0
        p_midweek_share = round(p_midweek / total_hist_consumed, 4) if total_hist_consumed > 0 else 0.0
        p_base_share = round(p_base / total_hist_consumed, 4) if total_hist_consumed > 0 else 0.0

        # Konsumsi 7 hari terakhir per hari
        curr_p_logs = [r for r in p_logs if r["moment"] >= w_curr_start]
        daily_buckets: dict[str, int] = defaultdict(int)
        for r in curr_p_logs:
            day_str = r["moment"].date().isoformat()
            daily_buckets[day_str] += r["consumption"]

        mean_val = sum(daily_buckets.values()) / 7.0
        daily_series = [daily_buckets.get((t_ref.date() - timedelta(days=i)).isoformat(), 0) for i in range(7)]
        variance = sum((v - mean_val) ** 2 for v in daily_series) / 7.0
        std_val = math.sqrt(variance)
        p_daily_cv = round(std_val / mean_val, 4) if mean_val > 0 else 0.0

        latest_moment = max(r["moment"] for r in p_logs)
        hours_since = max(0.0, (t_ref - latest_moment).total_seconds() / 3600.0)

        p_profile = classify_profile(p_weekend_share, p_midweek_share, p_daily_cv, total_hist_consumed)

        partner_aggregates[partner_id] = {
            "partner_weekend_share": p_weekend_share,
            "partner_midweek_share": p_midweek_share,
            "partner_weekday_base_share": p_base_share,
            "partner_daily_cv": p_daily_cv,
            "partner_hours_since_last_report": round(hours_since, 1),
            "partner_profile_type": p_profile,
        }

    # Hitung Metrik per Pasangan Mitra-Produk
    featured_rows: list[dict[str, Any]] = []

    # Akumulator untuk metadata statistik
    stats = {
        "total_records": len(inventory_rows),
        "total_active_consumption_items": 0,
        "profile_distribution": defaultdict(int),
        "data_source_counts": defaultdict(int),
    }

    # Hitung total stok dan total par level per mitra dari inventory_rows
    partner_total_stocks: dict[str, int] = defaultdict(int)
    partner_total_pars: dict[str, int] = defaultdict(int)
    partner_total_weekly: dict[str, float] = defaultdict(float)

    for item in inventory_rows:
        pid = str(item["partner_id"])
        c_qty = int(float(item.get("current_qty") or 0))
        p_lvl = int(float(item.get("par_level") or 0))
        w_cons = float(item.get("weekly_consumption") or 0)
        partner_total_stocks[pid] += c_qty
        partner_total_pars[pid] += p_lvl
        partner_total_weekly[pid] += w_cons

    for item in inventory_rows:
        pid = str(item["partner_id"])
        prid = str(item["product_id"])
        p_name = item.get("partner_name", "")
        pr_name = item.get("product_name", "")
        c_qty = int(float(item.get("current_qty") or 0))
        p_lvl = int(float(item.get("par_level") or 0))
        data_source = item.get("data_source", "synthetic_seed")
        is_synth = str(item.get("is_synthetic")).lower() == "true"

        key = (pid, prid)
        logs_pair = pair_logs.get(key, [])

        # Konsumsi minggu ini vs minggu sebelumnya
        c_curr_logs = [r for r in logs_pair if w_curr_start <= r["moment"] <= t_ref]
        c_prev_logs = [r for r in logs_pair if w_prev_start <= r["moment"] < w_curr_start]

        weekly_cons = float(item.get("weekly_consumption") or sum(r["consumption"] for r in c_curr_logs))
        prev_weekly_cons = float(sum(r["consumption"] for r in c_prev_logs))
        adu = float(item.get("adu") or round(weekly_cons / 7.0, 4))

        # 1. Kecepatan Penyerapan & Tren
        # absorption_rate = weekly_consumption / (current_qty + weekly_consumption)
        denom_stock = c_qty + weekly_cons
        absorption_rate = round(weekly_cons / denom_stock, 4) if denom_stock > 0 else 0.0

        # buffer_absorption_rate = weekly_consumption / par_level
        buffer_absorption_rate = round(weekly_cons / p_lvl, 4) if p_lvl > 0 else 0.0

        # wow_growth_rate: pertumbuhan dibanding minggu lalu
        if prev_weekly_cons > 0:
            wow_growth_rate = round((weekly_cons - prev_weekly_cons) / prev_weekly_cons, 4)
        else:
            wow_growth_rate = 1.0 if weekly_cons > 0 else 0.0

        # 2. Pola Waktu Konsumsi Harian (Distribution Shares)
        hist_total_consumed = sum(r["consumption"] for r in logs_pair)
        weekend_cons = sum(r["consumption"] for r in logs_pair if r["weekday"] in (5, 6))
        midweek_cons = sum(r["consumption"] for r in logs_pair if r["weekday"] in (2, 3))
        base_cons = sum(r["consumption"] for r in logs_pair if r["weekday"] in (0, 1, 4))

        weekend_share = round(weekend_cons / hist_total_consumed, 4) if hist_total_consumed > 0 else 0.0
        midweek_share = round(midweek_cons / hist_total_consumed, 4) if hist_total_consumed > 0 else 0.0
        weekday_base_share = round(base_cons / hist_total_consumed, 4) if hist_total_consumed > 0 else 0.0

        # Koefisien Variasi Harian (daily_cv)
        daily_map: dict[str, int] = defaultdict(int)
        for r in c_curr_logs:
            daily_map[r["moment"].date().isoformat()] += r["consumption"]

        item_daily_series = [daily_map.get((t_ref.date() - timedelta(days=i)).isoformat(), 0) for i in range(7)]
        item_mean = sum(item_daily_series) / 7.0
        item_variance = sum((v - item_mean) ** 2 for v in item_daily_series) / 7.0
        item_std = math.sqrt(item_variance)
        daily_cv = round(item_std / item_mean, 4) if item_mean > 0 else 0.0

        # 3. Utilisasi & Kepatuhan
        stock_utilization_ratio = round(c_qty / p_lvl, 4) if p_lvl > 0 else 0.0

        if logs_pair:
            latest_pair_moment = max(r["moment"] for r in logs_pair)
            hours_since = max(0.0, (t_ref - latest_pair_moment).total_seconds() / 3600.0)
            hours_since_last_report = round(hours_since, 1)
        else:
            hours_since_last_report = SENTINEL_HOURS

        item_profile_type = classify_profile(weekend_share, midweek_share, daily_cv, hist_total_consumed)

        # Ambil Agregat Toko (Partner-Level)
        p_agg = partner_aggregates.get(pid, {
            "partner_weekend_share": 0.0,
            "partner_midweek_share": 0.0,
            "partner_weekday_base_share": 0.0,
            "partner_daily_cv": 0.0,
            "partner_hours_since_last_report": SENTINEL_HOURS,
            "partner_profile_type": "Inaktif (Belum Ada Penjualan)",
        })

        p_tot_stock = partner_total_stocks[pid]
        p_tot_par = partner_total_pars[pid]
        p_tot_weekly = partner_total_weekly[pid]
        p_stock_util = round(p_tot_stock / p_tot_par, 4) if p_tot_par > 0 else 0.0

        row_dict = {
            "partner_id": pid,
            "partner_name": p_name,
            "product_id": prid,
            "product_name": pr_name,
            "current_qty": c_qty,
            "par_level": p_lvl,
            "data_source": data_source,
            "is_synthetic": is_synth,
            # Fitur Kecepatan & Tren
            "weekly_consumption": round(weekly_cons, 2),
            "prev_weekly_consumption": round(prev_weekly_cons, 2),
            "adu": round(adu, 3),
            "absorption_rate": absorption_rate,
            "buffer_absorption_rate": buffer_absorption_rate,
            "wow_growth_rate": wow_growth_rate,
            # Fitur Pola Waktu
            "weekend_share": weekend_share,
            "midweek_share": midweek_share,
            "weekday_base_share": weekday_base_share,
            "daily_cv": daily_cv,
            # Fitur Utilisasi & Kepatuhan
            "stock_utilization_ratio": stock_utilization_ratio,
            "hours_since_last_report": hours_since_last_report,
            "item_profile_type": item_profile_type,
            # Agregat Toko Cabang
            "partner_total_stock": p_tot_stock,
            "partner_total_weekly_consumption": round(p_tot_weekly, 2),
            "partner_stock_utilization_ratio": p_stock_util,
            "partner_weekend_share": p_agg["partner_weekend_share"],
            "partner_midweek_share": p_agg["partner_midweek_share"],
            "partner_weekday_base_share": p_agg["partner_weekday_base_share"],
            "partner_daily_cv": p_agg["partner_daily_cv"],
            "partner_hours_since_last_report": p_agg["partner_hours_since_last_report"],
            "partner_profile_type": p_agg["partner_profile_type"],
        }

        # Verifikasi anti-NaN & anti-inf
        for key, val in row_dict.items():
            if isinstance(val, float):
                if math.isnan(val) or math.isinf(val):
                    raise ValueError(f"Deteksi nilai numerik tidak valid ({val}) pada kolom {key}")

        featured_rows.append(row_dict)

        if weekly_cons > 0:
            stats["total_active_consumption_items"] += 1
        stats["profile_distribution"][p_agg["partner_profile_type"]] += 1
        stats["data_source_counts"][data_source] += 1

    return featured_rows, stats


def write_featured_csv(
    records: list[dict[str, Any]],
    output_path: Path = FEATURED_METRICS_PATH,
) -> Path:
    """Menyimpan hasil feature engineering ke file CSV standar."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FEATURE_COLUMNS)
        writer.writeheader()
        writer.writerows(records)
    return output_path


def main() -> Path:
    """Fungsi eksekusi mandiri CLI."""
    print("=== FEATURE ENGINEERING: KECEPATAN PENYERAPAN & POLA TRANSAKSI MITRA ===")
    inv_rows, l_rows = load_data()
    print(f"Data dimuat: {len(inv_rows)} pasangan inventaris, {len(l_rows)} baris log.")

    records, stats = compute_features(inv_rows, l_rows)
    output_file = write_featured_csv(records)

    print(f"\n[SUKSES] Dataset fitur berhasil disimpan ke: {output_file}")
    print(f"Total Baris Output : {len(records)} baris (30 kolom fitur)")
    print(f"Item dengan Konsumsi Aktif : {stats['total_active_consumption_items']} pasang")

    print("\nBreakdown Sumber Data:")
    for src, count in sorted(stats["data_source_counts"].items()):
        print(f" - {src}: {count} baris")

    # Distribusi profil per mitra unik
    partner_profiles = {r["partner_id"]: r["partner_profile_type"] for r in records}
    partner_dist: dict[str, int] = defaultdict(int)
    for p in partner_profiles.values():
        partner_dist[p] += 1

    print(f"\nDistribusi Profil Transaksi Mitra ({len(partner_profiles)} Cabang Mitra):")
    for profile, count in sorted(partner_dist.items(), key=lambda x: -x[1]):
        print(f" - {profile}: {count} cabang")

    return output_file


if __name__ == "__main__":
    main()
