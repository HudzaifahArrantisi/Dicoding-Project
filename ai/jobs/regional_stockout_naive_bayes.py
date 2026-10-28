"""
Model Analisis Spasial Kehabisan Stok Daerah Berbasis Naive Bayes
Daisuki B2B Inventory & Order Management System
Workspace: ai/jobs/regional_stockout_naive_bayes.py
"""
from __future__ import annotations

import json
import math
import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[2]
OUTPUT_JSON = ROOT / "ai" / "data" / "regional_stockout_insights.json"
DATA_DIR = ROOT / "ai" / "data"


def get_database_url() -> str:
    """Membaca DATABASE_URL dari file .env di ai/, root, atau apps/api/."""
    candidates = [
        ROOT / "ai" / ".env",
        ROOT / ".env",
        ROOT / "apps" / "api" / ".env",
    ]
    for env_path in candidates:
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8").splitlines():
                key, sep, val = line.partition("=")
                if sep and key.strip() == "DATABASE_URL":
                    return val.strip().strip("'\"")
    return os.getenv("DATABASE_URL", "")


class PureGaussianNaiveBayes:
    """Implementasi Gaussian Naive Bayes bawaan tanpa ketergantungan library eksternal.

    P(C | X) ∝ P(C) * ∏ P(x_i | C)
    di mana P(x_i | C) dihitung dari distribusi normal N(μ, σ²).
    """

    def __init__(self) -> None:
        self.classes: list[str] = []
        self.class_priors: dict[str, float] = {}
        self.stats: dict[str, list[tuple[float, float]]] = {}  # class -> [(mean, var), ...]

    def fit(self, X: list[list[float]], y: list[str]) -> None:
        self.classes = sorted(list(set(y)))
        total_samples = len(y)
        by_class: dict[str, list[list[float]]] = defaultdict(list)

        for features, label in zip(X, y):
            by_class[label].append(features)

        num_features = len(X[0]) if X else 0
        for label in self.classes:
            samples = by_class[label]
            self.class_priors[label] = len(samples) / total_samples
            feature_stats = []
            for j in range(num_features):
                vals = [s[j] for s in samples]
                m = sum(vals) / len(vals)
                variance = sum((v - m) ** 2 for v in vals) / max(1, len(vals) - 1)
                variance = max(variance, 1e-6)  # smoothing agar tidak 0
                feature_stats.append((m, variance))
            self.stats[label] = feature_stats

    def _gaussian_pdf(self, x: float, mean: float, var: float) -> float:
        denom = math.sqrt(2.0 * math.pi * var)
        exponent = math.exp(-((x - mean) ** 2) / (2.0 * var))
        return (1.0 / denom) * exponent

    def predict_proba(self, X: list[list[float]]) -> list[dict[str, float]]:
        probabilities = []
        for features in X:
            posteriors = {}
            for label in self.classes:
                prior = self.class_priors[label]
                log_prob = math.log(max(prior, 1e-9))
                for j, x_val in enumerate(features):
                    mean, var = self.stats[label][j]
                    pdf = max(self._gaussian_pdf(x_val, mean, var), 1e-12)
                    log_prob += math.log(pdf)
                posteriors[label] = log_prob

            # Softmax normalisasi dari log-probabilities
            max_log = max(posteriors.values())
            exp_probs = {c: math.exp(v - max_log) for c, v in posteriors.items()}
            sum_exp = sum(exp_probs.values())
            normalized = {c: exp_probs[c] / sum_exp for c in self.classes}
            probabilities.append(normalized)
        return probabilities

    def predict(self, X: list[list[float]]) -> list[str]:
        prob_list = self.predict_proba(X)
        return [max(p.items(), key=lambda item: item[1])[0] for p in prob_list]


def fetch_database_records(database_url: str) -> list[dict]:
    """Mengambil histori stok per mitra dan wilayah dari PostgreSQL."""
    query = """
    SELECT
        p.id::text AS partner_id,
        p.name AS partner_name,
        p.type::text AS partner_type,
        COALESCE(NULLIF(p.province_name, ''), 'Tidak diketahui') AS province_name,
        COALESCE(NULLIF(p.regency_name, ''), 'Tidak diketahui') AS regency_name,
        COALESCE(NULLIF(p.district_name, ''), 'Tidak diketahui') AS district_name,
        pr.id::text AS product_id,
        pr.name AS product_name,
        pr.sku AS product_sku,
        ps.current_qty,
        ps.par_level,
        COUNT(CASE WHEN sl.qty_after <= (ps.par_level * 0.20) THEN 1 END) AS critical_events,
        COUNT(CASE WHEN sl.qty_after = 0 THEN 1 END) AS zero_stock_events,
        COUNT(sl.id) AS total_logs
    FROM partners p
    JOIN partner_stocks ps ON ps.partner_id = p.id
    JOIN products pr ON pr.id = ps.product_id
    LEFT JOIN stock_logs sl ON sl.partner_id = p.id
         AND sl.product_id = ps.product_id
         AND sl.created_at >= NOW() - INTERVAL '60 days'
    WHERE p.is_active = TRUE
    GROUP BY p.id, p.name, p.type, p.province_name, p.regency_name, p.district_name,
             pr.id, pr.name, pr.sku, ps.current_qty, ps.par_level;
    """
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            columns = [desc[0] for desc in cur.description]
            return [dict(zip(columns, row)) for row in cur.fetchall()]


def train_naive_bayes_model(records: list[dict]) -> tuple[list[dict], list[dict]]:
    """Mengekstraksi fitur, melatih Gaussian Naive Bayes, dan mengklasifikasikan wilayah."""
    if not records:
        return [], []

    # 1. Agregasi data per (Wilayah + Mitra)
    partner_map: dict[str, dict] = {}
    for r in records:
        pid = r["partner_id"]
        if pid not in partner_map:
            partner_map[pid] = {
                "partner_id": pid,
                "partner_name": r["partner_name"],
                "partner_type": r["partner_type"],
                "province_name": r["province_name"],
                "regency_name": r["regency_name"],
                "district_name": r["district_name"],
                "total_items": 0,
                "total_critical_events": 0,
                "total_zero_events": 0,
                "sum_stock_ratio": 0.0,
                "fast_moving_products": [],
            }

        par = max(1, int(r["par_level"]))
        cur = int(r["current_qty"])
        crit = int(r["critical_events"] or 0)
        zeros = int(r["zero_stock_events"] or 0)

        partner_map[pid]["total_items"] += 1
        partner_map[pid]["total_critical_events"] += crit
        partner_map[pid]["total_zero_events"] += zeros
        partner_map[pid]["sum_stock_ratio"] += (cur / par)

        if crit > 0 or cur < (par * 0.2):
            partner_map[pid]["fast_moving_products"].append({
                "product_name": r["product_name"],
                "sku": r["product_sku"],
                "current_qty": cur,
                "par_level": par,
                "critical_frequency": crit,
                "suggested_par_level": int(round(par * 1.5)) if crit >= 3 else par + 10,
            })

    partner_rows = list(partner_map.values())
    for p in partner_rows:
        count = max(1, p["total_items"])
        p["avg_stock_ratio"] = round(p["sum_stock_ratio"] / count, 3)

    # 2. Bootstrapping Baseline Ground-Truth untuk melatih Naive Bayes
    def rule_label(row: dict) -> str:
        crit = row["total_critical_events"]
        zeros = row["total_zero_events"]
        ratio = row["avg_stock_ratio"]
        if crit >= 5 or zeros >= 2 or ratio < 0.25:
            return "ZONA_MERAH"
        if crit >= 2 or zeros >= 1 or ratio < 0.50:
            return "ZONA_KUNING"
        return "ZONA_HIJAU"

    labels = [rule_label(p) for p in partner_rows]

    # Fitur: [total_critical_events, total_zero_events, avg_stock_ratio, total_items]
    X = [
        [
            float(p["total_critical_events"]),
            float(p["total_zero_events"]),
            float(p["avg_stock_ratio"]),
            float(p["total_items"]),
        ]
        for p in partner_rows
    ]

    # 3. Latih Model Gaussian Naive Bayes
    nb = PureGaussianNaiveBayes()
    nb.fit(X, labels)

    predictions = nb.predict(X)
    probabilities = nb.predict_proba(X)

    for p, pred, proba in zip(partner_rows, predictions, probabilities):
        p["predicted_zone"] = pred
        # Probabilitas risiko zona merah
        red_prob = proba.get("ZONA_MERAH", 0.0)
        p["vulnerability_score"] = round(red_prob * 100.0, 1)

    # 4. Agregasi Ranking Tingkat Wilayah (Kabupaten/Kota)
    regency_agg: dict[tuple[str, str], dict] = {}
    for p in partner_rows:
        key = (p["province_name"], p["regency_name"])
        if key not in regency_agg:
            regency_agg[key] = {
                "province_name": p["province_name"],
                "regency_name": p["regency_name"],
                "total_partners": 0,
                "critical_partners_count": 0,
                "warning_partners_count": 0,
                "total_critical_events": 0,
                "vulnerability_scores": [],
                "partners_list": [],
            }
        regency_agg[key]["total_partners"] += 1
        regency_agg[key]["total_critical_events"] += p["total_critical_events"]
        if p["predicted_zone"] == "ZONA_MERAH":
            regency_agg[key]["critical_partners_count"] += 1
        elif p["predicted_zone"] == "ZONA_KUNING":
            regency_agg[key]["warning_partners_count"] += 1
        regency_agg[key]["vulnerability_scores"].append(p["vulnerability_score"])
        regency_agg[key]["partners_list"].append({
            "partner_id": p["partner_id"],
            "partner_name": p["partner_name"],
            "zone": p["predicted_zone"],
            "vulnerability_score": p["vulnerability_score"],
            "fast_moving_products": p["fast_moving_products"][:3],
        })

    regional_rankings = []
    for (prov, reg), data in regency_agg.items():
        scores = data["vulnerability_scores"]
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
        max_score = round(max(scores), 1) if scores else 0.0

        # Status zona daerah
        if data["critical_partners_count"] >= 2 or avg_score >= 60.0:
            zone_status = "ZONA_MERAH"
            action_plan = "Tingkatkan alokasi pengiriman regional dan naikkan Par Level rak mitra."
        elif data["warning_partners_count"] >= 1 or avg_score >= 30.0:
            zone_status = "ZONA_KUNING"
            action_plan = "Kirim reminder pengajuan restok lebih awal untuk mencegah stockout."
        else:
            zone_status = "ZONA_HIJAU"
            action_plan = "Pasokan wilayah stabil, pertahankan jadwal restok reguler."

        regional_rankings.append({
            "province_name": prov,
            "regency_name": reg,
            "total_partners": data["total_partners"],
            "critical_partners_count": data["critical_partners_count"],
            "warning_partners_count": data["warning_partners_count"],
            "total_critical_events": data["total_critical_events"],
            "average_vulnerability_score": avg_score,
            "peak_vulnerability_score": max_score,
            "regional_zone": zone_status,
            "recommended_action": action_plan,
            "partners": data["partners_list"],
        })

    # Urutkan berdasarkan kasus kritis dan skor kerentanan tertinggi
    regional_rankings.sort(
        key=lambda x: (x["critical_partners_count"], x["total_critical_events"], x["average_vulnerability_score"]),
        reverse=True,
    )
    partner_rows.sort(key=lambda x: x["vulnerability_score"], reverse=True)

    return regional_rankings, partner_rows


def run_pipeline() -> dict:
    """Fungsi utama menjalankan pipeline analisis Naive Bayes daerah."""
    print("=================================================================")
    print("DAISUKI AI: REGIONAL STOCKOUT ANALYSIS (NAIVE BAYES CLASSIFIER)")
    print("=================================================================")

    db_url = get_database_url()
    if not db_url:
        raise RuntimeError("DATABASE_URL tidak ditemukan di .env")

    print("Mengambil data histori transaksi stok mitra dari Neon DB...")
    records = fetch_database_records(db_url)
    print(f"Berhasil memuat {len(records)} baris data inventaris cabang.")

    print("Melatih model Naive Bayes dan mengklasifikasikan wilayah...")
    regional_rankings, partner_details = train_naive_bayes_model(records)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "algorithm": "GaussianNaiveBayes",
        "model_version": "v1.0-regional-naive-bayes",
        "summary": {
            "total_regions_analyzed": len(regional_rankings),
            "red_zone_regions_count": sum(1 for r in regional_rankings if r["regional_zone"] == "ZONA_MERAH"),
            "yellow_zone_regions_count": sum(1 for r in regional_rankings if r["regional_zone"] == "ZONA_KUNING"),
            "green_zone_regions_count": sum(1 for r in regional_rankings if r["regional_zone"] == "ZONA_HIJAU"),
        },
        "regional_rankings": regional_rankings,
        "vulnerable_partners": partner_details[:15],
    }

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"\n[SUKSES] Analisis selesai. Hasil diekspor ke:")
    print(f" -> {OUTPUT_JSON}")
    print("\nTop 3 Wilayah Paling Rawan Kehabisan Stok:")
    for i, reg in enumerate(regional_rankings[:3], start=1):
        print(f" {i}. {reg['regency_name']}, {reg['province_name']} [{reg['regional_zone']}]")
        print(f"    - Mitra Kritis: {reg['critical_partners_count']}/{reg['total_partners']}")
        print(f"    - Total Kejadian Kritis: {reg['total_critical_events']}")
        print(f"    - Rekomendasi: {reg['recommended_action']}")

    return payload


if __name__ == "__main__":
    run_pipeline()
