"""
Model Analisis Spasial Kehabisan Stok Daerah Berbasis Multi-Factor Naive Bayes
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
LEAD_TIME_DAYS = 6


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


class MultiFactorNaiveBayes:
    """Hybrid Naive Bayes:

    Menggabungkan Gaussian Naive Bayes (fitur kontinu) dan Categorical Naive Bayes
    (tipe mitra dengan Laplace smoothing) untuk memprediksi risiko kehabisan stok:
    P(C | X, Type) ∝ P(C) * P(Type | C) * ∏ P(x_i | C)
    """

    FEATURE_NAMES = [
        "days_of_cover",
        "daily_velocity",
        "sales_surge_ratio",
        "lead_time_stress",
        "critical_events",
        "zero_events",
    ]

    def __init__(self) -> None:
        self.classes: list[str] = ["RISIKO_TINGGI", "RISIKO_SEDANG", "RISIKO_RENDAH"]
        self.class_priors: dict[str, float] = {}
        self.stats: dict[str, list[tuple[float, float]]] = {}  # class -> [(mean, var), ...]
        self.type_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        self.type_totals: dict[str, int] = defaultdict(int)
        self.all_types: set[str] = set()

    def fit(self, X: list[list[float]], types: list[str], y: list[str]) -> None:
        self.classes = sorted(list(set(y)))
        total_samples = len(y)
        by_class: dict[str, list[list[float]]] = defaultdict(list)
        self.all_types = set(types)

        for features, ptype, label in zip(X, types, y):
            by_class[label].append(features)
            self.type_counts[label][ptype] += 1
            self.type_totals[label] += 1

        num_features = len(X[0]) if X else 0
        for label in self.classes:
            samples = by_class[label]
            self.class_priors[label] = len(samples) / max(1, total_samples)
            feature_stats = []
            for j in range(num_features):
                vals = [s[j] for s in samples] if samples else [0.0]
                m = sum(vals) / len(vals)
                variance = sum((v - m) ** 2 for v in vals) / max(1, len(vals) - 1)
                variance = max(variance, 1e-4)  # variance floor
                feature_stats.append((m, variance))
            self.stats[label] = feature_stats

    def _gaussian_pdf(self, x: float, mean: float, var: float) -> float:
        denom = math.sqrt(2.0 * math.pi * var)
        exponent = math.exp(-((x - mean) ** 2) / (2.0 * var))
        return (1.0 / denom) * exponent

    def predict_item(self, features: list[float], ptype: str) -> tuple[dict[str, float], str, str]:
        """Menghitung probabilitas posterior dan mengidentifikasi pemicu risiko utama."""
        log_posteriors: dict[str, float] = {}
        feature_contributions: dict[str, float] = {}

        for label in self.classes:
            prior = self.class_priors.get(label, 1.0 / len(self.classes))
            log_prob = math.log(max(prior, 1e-6))

            # Categorical likelihood dengan Laplace smoothing
            count = self.type_counts[label].get(ptype, 0)
            total = self.type_totals[label]
            type_prob = (count + 1) / (total + len(self.all_types) + 1)
            log_prob += math.log(type_prob)

            # Gaussian likelihood per fitur
            for j, x_val in enumerate(features):
                mean, var = self.stats[label][j]
                pdf = max(self._gaussian_pdf(x_val, mean, var), 1e-9)
                term = math.log(pdf)
                log_prob += term
                if label == "RISIKO_TINGGI":
                    norm_mean = self.stats.get("RISIKO_RENDAH", self.stats[label])[j][0]
                    feature_contributions[self.FEATURE_NAMES[j]] = abs(x_val - norm_mean)

            log_posteriors[label] = log_prob

        # Softmax normalisasi
        max_log = max(log_posteriors.values())
        exp_probs = {c: math.exp(v - max_log) for c, v in log_posteriors.items()}
        sum_exp = sum(exp_probs.values())
        normalized = {c: round(exp_probs[c] / sum_exp, 4) for c in self.classes}

        predicted_class = max(normalized.items(), key=lambda item: item[1])[0]

        # Tentukan faktor pemicu dominan
        doc = features[0]
        surge = features[2]
        lead_stress = features[3]
        crit_freq = features[4]

        if doc < 2.0:
            dominant_driver = f"Sisa stok menipis (hanya bertahan ~{doc:.1f} hari)"
        elif surge > 1.3:
            dominant_driver = f"Lonjakan konsumsi tajam (+{round((surge - 1.0) * 100)}% dibanding tren biasa)"
        elif lead_stress > 1.2:
            dominant_driver = f"Risiko lead time pengiriman ({LEAD_TIME_DAYS} hari) melebihi cakupan stok"
        elif crit_freq >= 3:
            dominant_driver = f"Frekuensi stok kritis tinggi ({int(crit_freq)}x dalam 30 hari)"
        else:
            dominant_driver = "Keseimbangan stok dan pola konsumsi normal"

        return normalized, predicted_class, dominant_driver


def fetch_comprehensive_records(database_url: str) -> list[dict]:
    """Mengambil riwayat transaksi multi-dimensi per mitra dan produk."""
    query = """
    WITH recent_7d AS (
        SELECT partner_id, product_id,
            COALESCE(SUM(qty_before - qty_after), 0)::float / 7.0 AS adu_7d,
            COALESCE(SUM(qty_before - qty_after), 0)::float AS units_7d
        FROM stock_logs
        WHERE source = 'manual_update'
          AND qty_before > qty_after
          AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY partner_id, product_id
    ),
    historical_30d AS (
        SELECT partner_id, product_id,
            COALESCE(SUM(qty_before - qty_after), 0)::float / 23.0 AS adu_prev,
            COUNT(CASE WHEN qty_after <= 10 THEN 1 END) AS crit_count,
            COUNT(CASE WHEN qty_after = 0 THEN 1 END) AS zero_count
        FROM stock_logs
        WHERE source = 'manual_update'
          AND qty_before > qty_after
          AND created_at >= NOW() - INTERVAL '30 days'
          AND created_at < NOW() - INTERVAL '7 days'
        GROUP BY partner_id, product_id
    ),
    active_orders AS (
        SELECT DISTINCT o.partner_id, oi.product_id
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.status IN ('diproses', 'disetujui', 'dalam_pengiriman')
    )
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
        COALESCE(r7.adu_7d, 0.0) AS daily_velocity,
        COALESCE(r7.units_7d, 0.0) AS units_7d,
        COALESCE(h30.adu_prev, 0.0) AS prev_velocity,
        COALESCE(h30.crit_count, 0) AS critical_events,
        COALESCE(h30.zero_count, 0) AS zero_stock_events,
        CASE WHEN ao.product_id IS NOT NULL THEN 1 ELSE 0 END AS has_active_order
    FROM partners p
    JOIN partner_stocks ps ON ps.partner_id = p.id
    JOIN products pr ON pr.id = ps.product_id
    LEFT JOIN recent_7d r7 ON r7.partner_id = p.id AND r7.product_id = ps.product_id
    LEFT JOIN historical_30d h30 ON h30.partner_id = p.id AND h30.product_id = ps.product_id
    LEFT JOIN active_orders ao ON ao.partner_id = p.id AND ao.product_id = ps.product_id
    WHERE p.is_active = TRUE;
    """
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            columns = [desc[0] for desc in cur.description]
            return [dict(zip(columns, row)) for row in cur.fetchall()]


def train_deep_naive_bayes(records: list[dict]) -> tuple[list[dict], list[dict], dict]:
    """Mengekstraksi fitur multi-faktor, melatih model Naive Bayes, dan menyusun wawasan cerdas."""
    if not records:
        return [], [], {}

    prepared_items: list[dict] = []
    X: list[list[float]] = []
    types: list[str] = []
    labels: list[str] = []

    for r in records:
        cur_qty = max(0, int(r["current_qty"]))
        velocity = max(0.05, float(r["daily_velocity"] or 0.0))
        prev_velocity = max(0.05, float(r["prev_velocity"] or 0.0))
        crit_events = float(r["critical_events"] or 0)
        zero_events = float(r["zero_stock_events"] or 0)
        has_order = int(r["has_active_order"] or 0)

        days_of_cover = round(cur_qty / velocity, 1)
        sales_surge = round(velocity / prev_velocity, 2)
        lead_stress = round(LEAD_TIME_DAYS / max(days_of_cover, 0.5), 2)

        # Baseline label untuk ground truth supervised Bayesian learning
        if (days_of_cover < 2.0 or cur_qty <= 5) and has_order == 0:
            ground_truth = "RISIKO_TINGGI"
        elif days_of_cover < 4.0 or crit_events >= 2 or sales_surge > 1.35:
            ground_truth = "RISIKO_SEDANG"
        else:
            ground_truth = "RISIKO_RENDAH"

        features = [
            days_of_cover,
            velocity,
            sales_surge,
            lead_stress,
            crit_events,
            zero_events,
        ]

        X.append(features)
        types.append(r["partner_type"])
        labels.append(ground_truth)

        prepared_items.append({
            "raw": r,
            "features": features,
            "days_of_cover": days_of_cover,
            "sales_surge": sales_surge,
            "lead_stress": lead_stress,
            "velocity": velocity,
        })

    # Melatih Model Multi-Factor Naive Bayes
    nb = MultiFactorNaiveBayes()
    nb.fit(X, types, labels)

    # Inferensi & Scoring per Item
    item_results: list[dict] = []
    partner_agg: dict[str, dict] = {}

    for item in prepared_items:
        r = item["raw"]
        probs, pred_class, driver = nb.predict_item(item["features"], r["partner_type"])
        stockout_prob = round(probs.get("RISIKO_TINGGI", 0.0) * 100.0, 1)

        # Rekomendasi kuantitas restok preskriptif
        needed_qty = math.ceil(item["velocity"] * (LEAD_TIME_DAYS + 3))  # 9 hari coverage buffer
        suggested_restock = max(0, needed_qty - int(r["current_qty"]))

        result_item = {
            "partner_id": r["partner_id"],
            "partner_name": r["partner_name"],
            "partner_type": r["partner_type"],
            "province_name": r["province_name"],
            "regency_name": r["regency_name"],
            "product_id": r["product_id"],
            "product_name": r["product_name"],
            "product_sku": r["product_sku"],
            "current_qty": int(r["current_qty"]),
            "daily_velocity": round(item["velocity"], 1),
            "days_of_cover": item["days_of_cover"],
            "sales_surge_ratio": item["sales_surge"],
            "stockout_probability": stockout_prob,
            "risk_level": "TINGGI" if stockout_prob >= 65.0 else ("SEDANG" if stockout_prob >= 30.0 else "RENDAH"),
            "dominant_factor": driver,
            "suggested_restock_units": suggested_restock,
        }
        item_results.append(result_item)

        pid = r["partner_id"]
        if pid not in partner_agg:
            partner_agg[pid] = {
                "partner_id": pid,
                "partner_name": r["partner_name"],
                "partner_type": r["partner_type"],
                "province_name": r["province_name"],
                "regency_name": r["regency_name"],
                "items": [],
                "max_prob": 0.0,
                "sum_prob": 0.0,
            }
        partner_agg[pid]["items"].append(result_item)
        partner_agg[pid]["max_prob"] = max(partner_agg[pid]["max_prob"], stockout_prob)
        partner_agg[pid]["sum_prob"] += stockout_prob

    # Agregasi Tingkat Kabupaten/Kota (Regional Hotspots)
    regency_agg: dict[tuple[str, str], dict] = {}
    for pid, pdata in partner_agg.items():
        key = (pdata["province_name"], pdata["regency_name"])
        if key not in regency_agg:
            regency_agg[key] = {
                "province_name": pdata["province_name"],
                "regency_name": pdata["regency_name"],
                "total_partners": 0,
                "critical_partners_count": 0,
                "warning_partners_count": 0,
                "stockout_probabilities": [],
                "partners_list": [],
                "top_drivers": defaultdict(int),
            }
        regency_agg[key]["total_partners"] += 1
        avg_partner_prob = round(pdata["sum_prob"] / len(pdata["items"]), 1)
        regency_agg[key]["stockout_probabilities"].append(avg_partner_prob)

        is_critical = pdata["max_prob"] >= 65.0
        is_warning = 30.0 <= pdata["max_prob"] < 65.0

        if is_critical:
            regency_agg[key]["critical_partners_count"] += 1
        elif is_warning:
            regency_agg[key]["warning_partners_count"] += 1

        # Kumpulkan pemicu risiko
        for itm in pdata["items"]:
            if itm["stockout_probability"] >= 50.0:
                regency_agg[key]["top_drivers"][itm["dominant_factor"]] += 1

        regency_agg[key]["partners_list"].append({
            "partner_id": pid,
            "partner_name": pdata["partner_name"],
            "max_stockout_probability": pdata["max_prob"],
            "average_stockout_probability": avg_partner_prob,
            "zone": "ZONA_MERAH" if is_critical else ("ZONA_KUNING" if is_warning else "ZONA_HIJAU"),
            "urgent_items": [
                {"product_name": i["product_name"], "stockout_probability": i["stockout_probability"]}
                for i in sorted(pdata["items"], key=lambda x: x["stockout_probability"], reverse=True)
                if i["stockout_probability"] >= 50.0
            ][:3],
        })

    regional_rankings = []
    for (prov, reg), data in regency_agg.items():
        probs = data["stockout_probabilities"]
        avg_prob = round(sum(probs) / len(probs), 1) if probs else 0.0
        peak_prob = round(max(probs), 1) if probs else 0.0

        if data["critical_partners_count"] >= 1 or avg_prob >= 50.0:
            zone_status = "ZONA_MERAH"
            action_plan = "Prioritaskan suplai pengiriman darurat ke cabang berisiko tinggi dan amankan buffer stok."
        elif data["warning_partners_count"] >= 1 or avg_prob >= 25.0:
            zone_status = "ZONA_KUNING"
            action_plan = "Tinjau pengajuan restok cabang dan pantau lonjakan penjualan mingguan."
        else:
            zone_status = "ZONA_HIJAU"
            action_plan = "Pasokan wilayah stabil, pertahankan alokasi restok reguler."

        # Driver utama daerah
        primary_driver = max(data["top_drivers"].items(), key=lambda x: x[1])[0] if data["top_drivers"] else "Pola konsumsi stabil"

        regional_rankings.append({
            "province_name": prov,
            "regency_name": reg,
            "total_partners": data["total_partners"],
            "critical_partners_count": data["critical_partners_count"],
            "warning_partners_count": data["warning_partners_count"],
            "average_stockout_probability": avg_prob,
            "peak_stockout_probability": peak_prob,
            "regional_zone": zone_status,
            "primary_risk_driver": primary_driver,
            "recommended_action": action_plan,
            "partners": sorted(data["partners_list"], key=lambda p: p["max_stockout_probability"], reverse=True),
        })

    regional_rankings.sort(
        key=lambda x: (x["critical_partners_count"], x["peak_stockout_probability"], x["average_stockout_probability"]),
        reverse=True,
    )
    item_results.sort(key=lambda x: x["stockout_probability"], reverse=True)

    high_risk_items = [i for i in item_results if i["stockout_probability"] >= 50.0]
    surge_items = [i for i in item_results if i["sales_surge_ratio"] >= 1.25]

    summary = {
        "total_items_analyzed": len(item_results),
        "high_risk_items_count": len(high_risk_items),
        "surge_detected_count": len(surge_items),
        "red_zone_regions_count": sum(1 for r in regional_rankings if r["regional_zone"] == "ZONA_MERAH"),
        "yellow_zone_regions_count": sum(1 for r in regional_rankings if r["regional_zone"] == "ZONA_KUNING"),
        "green_zone_regions_count": sum(1 for r in regional_rankings if r["regional_zone"] == "ZONA_HIJAU"),
    }

    return regional_rankings, item_results, summary


def run_pipeline() -> dict:
    """Fungsi utama mengeksekusi pipeline Naive Bayes."""
    print("=================================================================")
    print("DAISUKI AI: DEEP MULTI-FACTOR NAIVE BAYES STOCKOUT ANALYTICS")
    print("=================================================================")

    db_url = get_database_url()
    if not db_url:
        raise RuntimeError("DATABASE_URL tidak ditemukan di .env")

    print("Mengambil data histori transaksi multi-dimensi dari Neon DB...")
    records = fetch_comprehensive_records(db_url)
    print(f"Berhasil memuat {len(records)} baris data inventaris cabang.")

    print("Melatih model Multi-Factor Naive Bayes dan mengkalkulasi probabilitas...")
    regional_rankings, item_results, summary = train_deep_naive_bayes(records)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "algorithm": "MultiFactorGaussianAndCategoricalNaiveBayes",
        "model_version": "v2.0-deep-naive-bayes",
        "features_evaluated": MultiFactorNaiveBayes.FEATURE_NAMES,
        "summary": summary,
        "regional_rankings": regional_rankings,
        "high_risk_items": item_results[:25],
    }

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"\n[SUKSES] Analisis selesai. Hasil diekspor ke: {OUTPUT_JSON}")
    print(f"Total Item Dianalisis: {summary['total_items_analyzed']}")
    print(f"Item Risiko Tinggi (Probabilitas >= 50%): {summary['high_risk_items_count']}")
    print(f"Item Lonjakan Konsumsi (Surge >= 25%): {summary['surge_detected_count']}")
    print("\nTop 3 Wilayah Paling Rawan Kehabisan Stok:")
    for i, reg in enumerate(regional_rankings[:3], start=1):
        print(f" {i}. {reg['regency_name']}, {reg['province_name']} [{reg['regional_zone']}]")
        print(f"    - Probabilitas Puncak: {reg['peak_stockout_probability']}%")
        print(f"    - Pemicu Dominan: {reg['primary_risk_driver']}")
        print(f"    - Rekomendasi: {reg['recommended_action']}")

    return payload


if __name__ == "__main__":
    run_pipeline()
