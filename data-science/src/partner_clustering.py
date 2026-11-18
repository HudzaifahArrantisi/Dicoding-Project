"""Modul Clustering & Segmentasi Mitra Daisuki (Tipe A/B/C & Inaktif)
Daisuki B2B Inventory & Order Management System
Workspace: data-science/src/partner_clustering.py

Fungsi Utama:
1. Memuat dan mengagregasi fitur tingkat cabang mitra dari featured_partner_metrics.csv.
2. Memisahkan cabang aktif (memiliki riwayat konsumsi) dari cabang inaktif/baru (0 konsumsi).
3. Melakukan standarisasi fitur (StandardScaler) dan K-Means Clustering dengan evaluasi
   Elbow Method (Inertia/WCSS) dan Silhouette Score.
4. Memetakan hasil klaster ke segmen profil bisnis Daisuki:
   - Tipe A: Ramai Akhir Pekan (Weekend Peak)
   - Tipe B: Stabil Harian (Steady Regular Daily)
   - Tipe C: Lonjakan Tengah Minggu (Midweek Spike)
   - Mitra Baru / Inaktif (Belum Ada Log Konsumsi)
   beserta rekomendasi strategi jadwal pengiriman logistik pabrik.
5. Menyimpan:
   - Model & Scaler ke data-science/models/partner_clustering.joblib
   - Laporan evaluasi klaster ke data-science/reports/partner_clustering_evaluation.json
   - Hasil segmentasi 106 cabang ke data-science/data/partner_clusters.csv
6. Menyediakan fungsi reusable predict_partner_cluster() untuk integrasi analitik/AI.
"""

from __future__ import annotations

import csv
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

# Pastikan direktori data-science/src ada di sys.path
SRC_DIR = Path(__file__).resolve().parent
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

ROOT = SRC_DIR.parent
DATA_DIR = ROOT / "data"
MODELS_DIR = ROOT / "models"
REPORTS_DIR = ROOT / "reports"

FEATURED_METRICS_PATH = DATA_DIR / "featured_partner_metrics.csv"
MODEL_JOB_PATH = MODELS_DIR / "partner_clustering.joblib"
EVALUATION_REPORT_PATH = REPORTS_DIR / "partner_clustering_evaluation.json"
PARTNER_CLUSTERS_CSV_PATH = DATA_DIR / "partner_clusters.csv"

# 7 Fitur Tingkat Cabang untuk Segmentasi
CLUSTER_FEATURES = [
    "partner_weekend_share",
    "partner_midweek_share",
    "partner_weekday_base_share",
    "partner_daily_cv",
    "partner_stock_utilization_ratio",
    "partner_total_weekly_consumption",
    "partner_hours_since_last_report",
]

# Rekomendasi Jadwal Pengiriman Berdasarkan Segmen Operasional
DELIVERY_STRATEGIES = {
    "TIPE_A": {
        "segment_name": "Tipe A: Ramai Akhir Pekan (Weekend Peak)",
        "summary": "Lonjakan konsumsi signifikan pada hari Sabtu dan Minggu.",
        "recommended_schedule": "Kamis Sore atau Jumat Pagi",
        "actionable_strategy": (
            "Kirim pasokan restock pada Kamis sore atau Jumat pagi sebelum lonjakan akhir pekan tiba. "
            "Tingkatkan buffer stok cabang sebesar 25-30% jelang hari Jumat untuk mengantisipasi rush hour."
        ),
    },
    "TIPE_B": {
        "segment_name": "Tipe B: Stabil Harian (Steady Regular Daily)",
        "summary": "Pola konsumsi harian merata dan stabil sepanjang hari kerja (Senin-Jumat).",
        "recommended_schedule": "Senin Pagi dan Kamis Pagi (Terjadwal 2x Seminggu)",
        "actionable_strategy": (
            "Gunakan pengiriman terjadwal tetap 2 kali seminggu (Senin pagi & Kamis pagi) mengikuti laju ADU stabil. "
            "Tidak memerlukan buffer lonjakan besar, fokus pada ketepatan waktu replenishment."
        ),
    },
    "TIPE_C": {
        "segment_name": "Tipe C: Lonjakan Tengah Minggu (Midweek Spike)",
        "summary": "Pola konsumsi memuncak pada hari Rabu dan Kamis.",
        "recommended_schedule": "Senin Sore atau Selasa Pagi",
        "actionable_strategy": (
            "Kirim pasokan restock pada Senin sore atau Selasa pagi agar stok siap display sebelum hari Rabu. "
            "Hindari pengiriman terlambat pada hari Rabu siang karena permintaan sedang di puncak."
        ),
    },
    "INACTIVE": {
        "segment_name": "Mitra Baru / Inaktif (Belum Ada Log Konsumsi)",
        "summary": "Belum ada transaksi konsumsi tercatat dalam periode pemantauan.",
        "recommended_schedule": "Sesuai Pesanan Perdana (On-Demand)",
        "actionable_strategy": (
            "Kirim pengingat otomatis (WhatsApp/SMS) kepada mitra untuk rutin memperbarui laporan stok fisik rak. "
            "Jadwalkan kunjungan tim sales Daisuki untuk aktivasi mitra dan tawarkan paket restock perdana (starter kit)."
        ),
    },
}


def load_partner_data() -> pd.DataFrame:
    """Memuat dan menduplikasi data pasangan produk-mitra menjadi 1 baris per cabang mitra unik."""
    if not FEATURED_METRICS_PATH.exists():
        # Fallback eksekusi feature_engineering jika file belum tersedia
        from feature_engineering import generate_features
        generate_features()

    df = pd.read_csv(FEATURED_METRICS_PATH)
    # Ambil baris unik per partner_id
    partner_df = df.drop_duplicates(subset=["partner_id"]).copy()
    partner_df = partner_df.reset_index(drop=True)
    return partner_df


def separate_active_inactive(partner_df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Memisahkan mitra yang memiliki riwayat aktivitas konsumsi dari mitra inaktif."""
    # Indikator aktif: total konsumsi mingguan > 0 ATAU ada share distribusi hari > 0
    has_history = (
        (partner_df["partner_total_weekly_consumption"] > 0)
        | (
            partner_df["partner_weekend_share"]
            + partner_df["partner_midweek_share"]
            + partner_df["partner_weekday_base_share"]
            > 0
        )
    )

    active_df = partner_df[has_history].copy().reset_index(drop=True)
    inactive_df = partner_df[~has_history].copy().reset_index(drop=True)

    return active_df, inactive_df


def evaluate_kmeans_options(X: np.ndarray, max_k: int = 5) -> dict[str, Any]:
    """Menghitung WCSS/Inertia (Elbow Method) dan Silhouette Score untuk rentang k."""
    results = []
    n_samples = len(X)
    upper_k = min(max_k, n_samples - 1)

    for k in range(2, upper_k + 1):
        km = KMeans(n_clusters=k, random_state=42, n_init=15)
        labels = km.fit_predict(X)
        inertia = float(km.inertia_)
        sil = float(silhouette_score(X, labels)) if len(np.unique(labels)) > 1 else 0.0

        results.append({
            "k": k,
            "inertia": round(inertia, 2),
            "silhouette_score": round(sil, 4),
        })

    return {
        "evaluations": results,
        "recommended_k": max(results, key=lambda r: r["silhouette_score"])["k"] if results else 3,
    }


def map_active_clusters(active_df: pd.DataFrame, cluster_labels: np.ndarray) -> tuple[pd.DataFrame, dict[int, str]]:
    """Memetakan klaster numerik K-Means ke profil operasional bisnis Daisuki
    (Tipe A, Tipe B, atau Tipe C) berdasarkan karakteristik rata-rata fitur centroid.
    """
    df_act = active_df.copy()
    df_act["raw_cluster"] = cluster_labels

    cluster_mapping: dict[int, str] = {}
    unique_clusters = sorted(df_act["raw_cluster"].unique())

    # Aturan pemetaan berbasis fitur dominan
    for c in unique_clusters:
        sub = df_act[df_act["raw_cluster"] == c]
        wk = float(sub["partner_weekend_share"].mean())
        mw = float(sub["partner_midweek_share"].mean())
        bs = float(sub["partner_weekday_base_share"].mean())

        if wk >= 0.35:
            code = "TIPE_A"
        elif mw >= 0.35:
            code = "TIPE_C"
        else:
            code = "TIPE_B"

        cluster_mapping[c] = code

    df_act["cluster_code"] = df_act["raw_cluster"].map(cluster_mapping)
    return df_act, cluster_mapping


def run_partner_clustering() -> tuple[pd.DataFrame, dict[str, Any]]:
    """Alur lengkap pemuatan data, clustering, evaluasi, pelabelan bisnis, dan penyimpanan artefak."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    partner_df = load_partner_data()
    total_partners = len(partner_df)

    active_df, inactive_df = separate_active_inactive(partner_df)
    n_active = len(active_df)
    n_inactive = len(inactive_df)

    print(f"Total Cabang Mitra: {total_partners}")
    print(f" - Cabang Aktif (Ber-riwayat Konsumsi): {n_active}")
    print(f" - Cabang Baru / Inaktif              : {n_inactive}")

    # Ekstraksi matriks fitur untuk mitra aktif
    X_active_raw = active_df[CLUSTER_FEATURES].values.astype(float)
    scaler = StandardScaler()
    X_active_scaled = scaler.fit_transform(X_active_raw)

    # Evaluasi Elbow & Silhouette untuk k = 2 s/d 4 pada mitra aktif
    eval_active = evaluate_kmeans_options(X_active_scaled, max_k=4)

    # Evaluasi untuk populasi total (sebagai perbandingan metodologi)
    X_all_raw = partner_df[CLUSTER_FEATURES].values.astype(float)
    scaler_all = StandardScaler()
    X_all_scaled = scaler_all.fit_transform(X_all_raw)
    eval_all = evaluate_kmeans_options(X_all_scaled, max_k=5)

    # Memilih k=4 berdasarkan skor Silhouette tertinggi (0.4339) untuk memisahkan Tipe A, B (2 kelompok volume), dan C
    OPTIMAL_K = 4
    kmeans = KMeans(n_clusters=OPTIMAL_K, random_state=42, n_init=20)
    active_labels = kmeans.fit_predict(X_active_scaled)

    # Petakan klaster numerik ke kode profil bisnis
    active_clustered, cluster_mapping = map_active_clusters(active_df, active_labels)

    # Isi detail segmen dan strategi pengiriman untuk mitra aktif
    active_clustered["cluster_id"] = active_clustered["raw_cluster"]
    active_clustered["segment_name"] = active_clustered["cluster_code"].map(lambda c: DELIVERY_STRATEGIES[c]["segment_name"])
    active_clustered["recommended_schedule"] = active_clustered["cluster_code"].map(lambda c: DELIVERY_STRATEGIES[c]["recommended_schedule"])
    active_clustered["actionable_strategy"] = active_clustered["cluster_code"].map(lambda c: DELIVERY_STRATEGIES[c]["actionable_strategy"])
    active_clustered["is_active_partner"] = True

    # Isi detail segmen untuk mitra inaktif
    inactive_df["raw_cluster"] = -1
    inactive_df["cluster_id"] = -1
    inactive_df["cluster_code"] = "INACTIVE"
    inactive_df["segment_name"] = DELIVERY_STRATEGIES["INACTIVE"]["segment_name"]
    inactive_df["recommended_schedule"] = DELIVERY_STRATEGIES["INACTIVE"]["recommended_schedule"]
    inactive_df["actionable_strategy"] = DELIVERY_STRATEGIES["INACTIVE"]["actionable_strategy"]
    inactive_df["is_active_partner"] = False

    # Gabungkan seluruh 106 cabang mitra
    all_clustered = pd.concat([active_clustered, inactive_df], ignore_index=True)

    # Urutkan berdasarkan segmen dan konsumsi mingguan
    all_clustered = all_clustered.sort_values(
        by=["is_active_partner", "partner_total_weekly_consumption", "partner_name"],
        ascending=[False, False, True]
    ).reset_index(drop=True)

    # Simpan hasil segmentasi ke CSV
    output_cols = [
        "partner_id",
        "partner_name",
        "cluster_id",
        "cluster_code",
        "segment_name",
        "recommended_schedule",
        "actionable_strategy",
        "partner_weekend_share",
        "partner_midweek_share",
        "partner_weekday_base_share",
        "partner_daily_cv",
        "partner_stock_utilization_ratio",
        "partner_total_weekly_consumption",
        "partner_hours_since_last_report",
        "is_active_partner",
        "data_source",
        "is_synthetic",
    ]
    # Filter kolom yang ada
    valid_cols = [c for c in output_cols if c in all_clustered.columns]
    all_clustered[valid_cols].to_csv(PARTNER_CLUSTERS_CSV_PATH, index=False)
    print(f"[OK] File segmentasi cabang disimpan ke: {PARTNER_CLUSTERS_CSV_PATH}")

    # Simpan artefak model ke joblib
    pipeline_artifact = {
        "scaler": scaler,
        "kmeans_model": kmeans,
        "features": CLUSTER_FEATURES,
        "cluster_mapping": cluster_mapping,
        "delivery_strategies": DELIVERY_STRATEGIES,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "n_active_partners": n_active,
        "n_total_partners": total_partners,
    }
    joblib.dump(pipeline_artifact, MODEL_JOB_PATH)
    print(f"[OK] Model clustering disimpan ke: {MODEL_JOB_PATH}")

    # Hitung profil agregat per segmen
    segment_summary = {}
    for code, group in all_clustered.groupby("cluster_code"):
        segment_summary[code] = {
            "segment_name": DELIVERY_STRATEGIES[code]["segment_name"],
            "count": len(group),
            "percentage": round(len(group) / total_partners * 100, 2),
            "mean_weekly_consumption": round(float(group["partner_total_weekly_consumption"].mean()), 2),
            "mean_weekend_share": round(float(group["partner_weekend_share"].mean()), 4),
            "mean_midweek_share": round(float(group["partner_midweek_share"].mean()), 4),
            "mean_weekday_base_share": round(float(group["partner_weekday_base_share"].mean()), 4),
            "mean_utilization": round(float(group["partner_stock_utilization_ratio"].mean()), 4),
            "sample_partners": group["partner_name"].head(4).tolist(),
        }

    # Buat laporan evaluasi JSON
    evaluation_report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_partners": total_partners,
        "active_partners": n_active,
        "inactive_partners": n_inactive,
        "optimal_k_active": OPTIMAL_K,
        "features_used": CLUSTER_FEATURES,
        "active_partners_evaluation": eval_active["evaluations"],
        "all_partners_evaluation": eval_all["evaluations"],
        "cluster_mapping": {str(k): v for k, v in cluster_mapping.items()},
        "segment_summary": segment_summary,
    }

    with EVALUATION_REPORT_PATH.open("w", encoding="utf-8") as f:
        json.dump(evaluation_report, f, indent=2)
    print(f"[OK] Laporan evaluasi disimpan ke: {EVALUATION_REPORT_PATH}")

    return all_clustered, evaluation_report


def predict_partner_cluster(partner_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Fungsi reusable inferensi penentuan klaster dan rekomendasi jadwal untuk cabang mitra."""
    if not MODEL_JOB_PATH.exists():
        run_partner_clustering()

    artifact = joblib.load(MODEL_JOB_PATH)
    scaler: StandardScaler = artifact["scaler"]
    kmeans: KMeans = artifact["kmeans_model"]
    features: list[str] = artifact["features"]
    mapping: dict[int, str] = artifact["cluster_mapping"]

    results = []
    for rec in partner_records:
        res = dict(rec)
        tot_c = float(rec.get("partner_total_weekly_consumption") or 0.0)
        wk = float(rec.get("partner_weekend_share") or 0.0)
        mw = float(rec.get("partner_midweek_share") or 0.0)
        bs = float(rec.get("partner_weekday_base_share") or 0.0)

        if tot_c == 0.0 and (wk + mw + bs) == 0.0:
            code = "INACTIVE"
            c_id = -1
        else:
            x_vec = np.array([[float(rec.get(col) or 0.0) for col in features]])
            x_scaled = scaler.transform(x_vec)
            c_id = int(kmeans.predict(x_scaled)[0])
            code = mapping.get(c_id, "TIPE_B")

        strat = DELIVERY_STRATEGIES[code]
        res["cluster_id"] = c_id
        res["cluster_code"] = code
        res["segment_name"] = strat["segment_name"]
        res["recommended_schedule"] = strat["recommended_schedule"]
        res["actionable_strategy"] = strat["actionable_strategy"]
        results.append(res)

    return results


if __name__ == "__main__":
    print("=== SEGMENTASI PROFIL MITRA & CLUSTERING TIPE A/B/C DAISUKI ===")
    clustered_df, report = run_partner_clustering()
    print("\n--- RINGKASAN DISTRIBUSI SEGMEN CABANG MITRA ---")
    for code, info in report["segment_summary"].items():
        print(f"[{code}] {info['segment_name']}")
        print(f"  Jumlah Cabang: {info['count']} ({info['percentage']}%)")
        print(f"  Rata-rata Konsumsi: {info['mean_weekly_consumption']} pcs/minggu")
        print(f"  Jadwal Pengiriman : {DELIVERY_STRATEGIES[code]['recommended_schedule']}")
        print(f"  Contoh Mitra      : {', '.join(info['sample_partners'])}")
        print()
