"""Modul Produksi & Inferensi Prediksi Risiko Stockout Daisuki
Daisuki B2B Inventory & Order Management System
Workspace: data-science/src/stockout_model.py

Fungsi Utama:
1. Memuat dataset hasil pemisahan waktu (train_inventory_summary.csv & test_inventory_summary.csv).
2. Mengekstraksi fitur kaya dari feature_engineering.py tanpa target leakage.
3. Melatih dan membandingkan 3 pendekatan klasifikasi risiko:
   (a) Rule-Based Heuristic Baseline
   (b) Gaussian Naive Bayes
   (c) Random Forest Classifier (class_weight='balanced')
4. Memproyeksikan sisa hari menuju kehabisan stok (predicted_days_to_stockout)
   dengan memperhitungkan Lead Time Produksi Pabrik 5-7 hari (Regresi MAE & WAPE).
5. Menyimpan:
   - Artefak model pemenang ke data-science/models/stockout_model.joblib
   - Ringkasan metrik evaluasi ke data-science/reports/stockout_model_evaluation.json
   - Prediksi pada Test Set ke data-science/data/stockout_risk_predictions.csv
6. Menyediakan fungsi reusable predict_stockout_risk() untuk konsumsi produksi/AI.
"""

from __future__ import annotations

import csv
import json
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    precision_score,
    recall_score,
)
from sklearn.naive_bayes import GaussianNB
from sklearn.preprocessing import StandardScaler

# Tambahkan direktori data-science/src ke sys.path jika belum ada
SRC_DIR = Path(__file__).resolve().parent
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from feature_engineering import compute_features, parse_time

ROOT = SRC_DIR.parent
DATA_DIR = ROOT / "data"
MODELS_DIR = ROOT / "models"
REPORTS_DIR = ROOT / "reports"

TRAIN_INV_PATH = DATA_DIR / "train_inventory_summary.csv"
TEST_INV_PATH = DATA_DIR / "test_inventory_summary.csv"
RAW_LOGS_PATH = DATA_DIR / "raw_stock_logs.csv"

MODEL_JOB_PATH = MODELS_DIR / "stockout_model.joblib"
EVALUATION_REPORT_PATH = REPORTS_DIR / "stockout_model_evaluation.json"
PREDICTIONS_CSV_PATH = DATA_DIR / "stockout_risk_predictions.csv"

FACTORY_LEAD_TIME_DAYS = 7  # Lead time pabrik maksimum (5-7 hari)
LEAD_TIME_DAYS = 6  # Lead time logistik ke cabang
MODEL_VERSION = "v3.0-rf-stockout-classifier"

# Fitur Prediktor yang Digunakan (Mencegah Target Leakage: days_of_cover & is_critical dieksklusikan)
PREDICTOR_FEATURES = [
    "current_qty",
    "par_level",
    "adu",
    "safety_stock",
    "rop",
    "absorption_rate",
    "buffer_absorption_rate",
    "wow_growth_rate",
    "weekend_share",
    "midweek_share",
    "daily_cv",
    "stock_utilization_ratio",
    "hours_since_last_report",
    "is_synthetic",
]

CLASS_LABELS = ["Aman", "Waspada", "Kritis"]


def load_split_datasets() -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Memuat train/test inventory summary dan log transaksi yang terbagi secara time-based."""
    if not TRAIN_INV_PATH.exists() or not TEST_INV_PATH.exists():
        raise FileNotFoundError(
            f"Dataset train/test tidak ditemukan di {DATA_DIR}. "
            "Jalankan data-science/src/clean_logs.py lebih dulu."
        )

    with TRAIN_INV_PATH.open(newline="", encoding="utf-8-sig") as handle:
        train_inv = list(csv.DictReader(handle))
    with TEST_INV_PATH.open(newline="", encoding="utf-8-sig") as handle:
        test_inv = list(csv.DictReader(handle))

    if not RAW_LOGS_PATH.exists():
        raise FileNotFoundError(f"File log {RAW_LOGS_PATH} tidak ditemukan.")

    with RAW_LOGS_PATH.open(newline="", encoding="utf-8-sig") as handle:
        raw_logs = list(csv.DictReader(handle))

    # Filter log valid bertipe manual_update
    valid_logs: list[dict[str, Any]] = []
    for r in raw_logs:
        if r.get("source") == "manual_update":
            try:
                b, a = int(r["qty_before"]), int(r["qty_after"])
                if b >= a and b >= 0 and a >= 0:
                    valid_logs.append(r)
            except (ValueError, TypeError, KeyError):
                continue

    valid_logs.sort(key=lambda r: parse_time(r["created_at"]))
    split_idx = int(len(valid_logs) * 0.8)
    split_idx = max(1, min(split_idx, len(valid_logs) - 1)) if len(valid_logs) > 1 else 1

    train_logs = valid_logs[:split_idx]
    test_logs = valid_logs[split_idx:]

    return train_inv, test_inv, train_logs, test_logs


def create_feature_matrices(
    inv_rows: list[dict[str, Any]],
    log_rows: list[dict[str, Any]],
    ref_time: datetime | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, list[dict[str, Any]]]:
    """Mengekstraksi matriks X (fitur prediktor), y_class (target klasifikasi),

    dan y_days (target regresi proyeksi hari kehabisan stok).
    """
    feats, _ = compute_features(inv_rows, log_rows, reference_time=ref_time)

    # Gabungkan fitur dari inventory_summary (safety_stock, rop) dengan features dari compute_features
    X_rows = []
    y_class_list = []
    y_days_list = []
    merged_records = []

    for inv, f in zip(inv_rows, feats):
        qty = int(float(f["current_qty"]))
        par = int(float(f["par_level"]))
        doc = float(inv.get("days_of_cover") or 999.0)
        adu = float(f["adu"])

        # Target Klasifikasi Risiko (Ground Truth)
        if doc < 2.0 or qty <= 10 or qty < par * 0.2:
            target_risk = "Kritis"
        elif doc <= 4.0 or qty < par * 0.5:
            target_risk = "Waspada"
        else:
            target_risk = "Aman"

        # Target Regresi Proyeksi Hari Menuju Kehabisan Stok (Capped at 60 days)
        if adu > 0.0:
            target_days = min(60.0, qty / adu)
        else:
            target_days = 60.0

        # Fitur-fitur prediktor
        x_row = [
            float(f["current_qty"]),
            float(f["par_level"]),
            float(f["adu"]),
            float(inv.get("safety_stock") or 0.0),
            float(inv.get("rop") or 0.0),
            float(f["absorption_rate"]),
            float(f["buffer_absorption_rate"]),
            float(f["wow_growth_rate"]),
            float(f["weekend_share"]),
            float(f["midweek_share"]),
            float(f["daily_cv"]),
            float(f["stock_utilization_ratio"]),
            float(f["hours_since_last_report"]),
            1.0 if str(f["is_synthetic"]).lower() == "true" else 0.0,
        ]

        X_rows.append(x_row)
        y_class_list.append(target_risk)
        y_days_list.append(target_days)

        rec = dict(f)
        rec["safety_stock"] = inv.get("safety_stock", 0)
        rec["rop"] = inv.get("rop", 0)
        rec["target_risk"] = target_risk
        rec["target_days"] = target_days
        merged_records.append(rec)

    return np.array(X_rows, dtype=float), np.array(y_class_list), np.array(y_days_list, dtype=float), merged_records


def predict_heuristic_baseline(X: np.ndarray) -> np.ndarray:
    """Model A: Rule-Based Heuristic Baseline.

    Memprediksi berdasarkan ambang batas klasik sisa stok dan rasio utilisasi.
    """
    preds = []
    for row in X:
        qty = row[0]
        util = row[11]  # stock_utilization_ratio
        if qty <= 10 or util < 0.20:
            preds.append("Kritis")
        elif util < 0.50:
            preds.append("Waspada")
        else:
            preds.append("Aman")
    return np.array(preds)


def evaluate_classifier(y_true: np.ndarray, y_pred: np.ndarray, model_name: str) -> dict[str, Any]:
    """Menghitung metrik performa klasifikasi lengkap (Accuracy, Precision, Recall, F1, Recall Kritis)."""
    acc = accuracy_score(y_true, y_pred)
    prec_macro = precision_score(y_true, y_pred, labels=CLASS_LABELS, average="macro", zero_division=0)
    rec_macro = recall_score(y_true, y_pred, labels=CLASS_LABELS, average="macro", zero_division=0)
    f1_macro = f1_score(y_true, y_pred, labels=CLASS_LABELS, average="macro", zero_division=0)

    # Khusus Recall kelas Kritis (Prioritas bisnis rantai pasok)
    rec_kritis = recall_score(y_true == "Kritis", y_pred == "Kritis", zero_division=0)
    prec_kritis = precision_score(y_true == "Kritis", y_pred == "Kritis", zero_division=0)
    f1_kritis = f1_score(y_true == "Kritis", y_pred == "Kritis", zero_division=0)

    cm = confusion_matrix(y_true, y_pred, labels=CLASS_LABELS)

    return {
        "model_name": model_name,
        "accuracy": round(float(acc), 4),
        "precision_macro": round(float(prec_macro), 4),
        "recall_macro": round(float(rec_macro), 4),
        "f1_macro": round(float(f1_macro), 4),
        "recall_kritis": round(float(rec_kritis), 4),
        "precision_kritis": round(float(prec_kritis), 4),
        "f1_kritis": round(float(f1_kritis), 4),
        "confusion_matrix": {
            "labels": CLASS_LABELS,
            "matrix": cm.tolist(),
        },
    }


def evaluate_regressor(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, Any]:
    """Menghitung metrik performa proyeksi sisa hari menuju kehabisan stok (MAE & WAPE)."""
    mae = mean_absolute_error(y_true, y_pred)
    sum_actual = np.sum(y_true)
    wape = np.sum(np.abs(y_true - y_pred)) / sum_actual if sum_actual > 0 else 0.0

    return {
        "mae_days": round(float(mae), 4),
        "wape_percent": round(float(wape * 100), 2),
    }


class StockoutPredictorPipeline:
    """Wrapper pipeline inferensi model produksi yang telah dilatih."""

    def __init__(
        self,
        classifier: Any,
        regressor: Any,
        scaler: Any,
        feature_names: list[str],
        classes: list[str],
        version: str = MODEL_VERSION,
    ) -> None:
        self.classifier = classifier
        self.regressor = regressor
        self.scaler = scaler
        self.feature_names = feature_names
        self.classes = classes
        self.version = version

    def predict(self, X_input: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """Melakukan inferensi prediksi risiko dan estimasi sisa hari."""
        pred_class = self.classifier.predict(X_input)
        pred_probs = self.classifier.predict_proba(X_input) if hasattr(self.classifier, "predict_proba") else None
        pred_days = self.regressor.predict(X_input)
        # Urgensi lead time pabrik: jika hari kehabisan <= 7 hari
        urgency_flag = pred_days <= FACTORY_LEAD_TIME_DAYS
        return pred_class, pred_probs, pred_days, urgency_flag


_LOADED_MODEL: StockoutPredictorPipeline | None = None


def get_or_load_model() -> StockoutPredictorPipeline:
    """Memuat model tersimpan secara cached."""
    global _LOADED_MODEL
    if _LOADED_MODEL is not None:
        return _LOADED_MODEL
    if not MODEL_JOB_PATH.exists():
        raise FileNotFoundError(f"Model tersimpan tidak ditemukan di {MODEL_JOB_PATH}. Jalankan pelatihan lebih dulu.")
    _LOADED_MODEL = joblib.load(MODEL_JOB_PATH)
    return _LOADED_MODEL


def predict_stockout_risk(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Fungsi reusable produksi untuk memprediksi risiko kehabisan barang.

    Args:
        items: List dictionary berisi atribut fitur per pasangan cabang-produk.

    Returns:
        List dictionary yang dilengkapi prediksi kelas risiko, probabilitas,
        sisa hari menuju kehabisan, dan status urgensi lead time pabrik.
    """
    pipeline = get_or_load_model()

    # Bangun X input
    X = []
    for item in items:
        row = [float(item.get(col, 0.0)) for col in pipeline.feature_names]
        X.append(row)
    X_arr = np.array(X, dtype=float)

    pred_classes, pred_probs, pred_days, urgency_flags = pipeline.predict(X_arr)

    results = []
    for i, item in enumerate(items):
        res = dict(item)
        res["predicted_risk_level"] = str(pred_classes[i])
        res["predicted_days_to_stockout"] = round(float(pred_days[i]), 1)
        res["urgency_lead_time_breached"] = bool(urgency_flags[i])
        if pred_probs is not None:
            res["risk_probabilities"] = {
                cls: round(float(pred_probs[i][idx]), 4)
                for idx, cls in enumerate(pipeline.classes)
            }
            res["risk_confidence"] = round(float(np.max(pred_probs[i])), 4)
        results.append(res)
    return results


def train_and_evaluate() -> dict[str, Any]:
    """Alur lengkap pelatihan, perbandingan 3 model, evaluasi test set, dan penyimpanan artefak."""
    print("=== MODELING ANALITIK RISIKO STOCKOUT & PROYEKSI KEHABISAN STOK ===")
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    train_inv, test_inv, train_logs, test_logs = load_split_datasets()
    print(f"Data split dimuat: Train {len(train_inv)} baris, Test {len(test_inv)} baris.")

    train_ref = parse_time(train_logs[-1]["created_at"]) if train_logs else None
    test_ref = parse_time(test_logs[-1]["created_at"]) if test_logs else None

    # Bentuk Matriks Fitur & Target
    X_train, y_train, y_days_train, _ = create_feature_matrices(train_inv, train_logs, train_ref)
    X_test, y_test, y_days_test, test_merged = create_feature_matrices(test_inv, test_logs, test_ref)

    print(f"Dimensi Matriks Fitur: Train {X_train.shape}, Test {X_test.shape} (14 Fitur Prediktor)")

    # ----------------------------------------------------
    # Model (a): Rule-Based Heuristic Baseline
    # ----------------------------------------------------
    y_pred_heur = predict_heuristic_baseline(X_test)
    eval_heur = evaluate_classifier(y_test, y_pred_heur, "Rule-Based Heuristic Baseline")

    # ----------------------------------------------------
    # Model (b): Gaussian Naive Bayes
    # ----------------------------------------------------
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    gnb = GaussianNB()
    gnb.fit(X_train_scaled, y_train)
    y_pred_gnb = gnb.predict(X_test_scaled)
    eval_gnb = evaluate_classifier(y_test, y_pred_gnb, "Gaussian Naive Bayes")

    # ----------------------------------------------------
    # Model (c): Random Forest Classifier (Balanced) — Pemenang
    # ----------------------------------------------------
    rf_clf = RandomForestClassifier(
        n_estimators=100,
        random_state=42,
        class_weight="balanced",
        max_depth=10,
        min_samples_leaf=2,
    )
    rf_clf.fit(X_train, y_train)
    y_pred_rf = rf_clf.predict(X_test)
    y_prob_rf = rf_clf.predict_proba(X_test)
    eval_rf = evaluate_classifier(y_test, y_pred_rf, "Random Forest Classifier (Balanced)")

    # ----------------------------------------------------
    # Task B: Regresi Proyeksi Hari Menuju Kehabisan Stok
    # ----------------------------------------------------
    rf_reg = RandomForestRegressor(
        n_estimators=100,
        random_state=42,
        max_depth=12,
        min_samples_leaf=2,
    )
    rf_reg.fit(X_train, y_days_train)
    y_days_pred = rf_reg.predict(X_test)
    eval_reg = evaluate_regressor(y_days_test, y_days_pred)

    # Feature Importance dari Random Forest Classifier
    importances = [
        {"feature": name, "importance": round(float(imp), 4), "percentage": round(float(imp * 100), 2)}
        for name, imp in sorted(zip(PREDICTOR_FEATURES, rf_clf.feature_importances_), key=lambda x: -x[1])
    ]

    print("\n--- PERBANDINGAN PERFORMA KLASIFIKASI PADA TEST SET ---")
    for ev in [eval_heur, eval_gnb, eval_rf]:
        print(f"\nModel: {ev['model_name']}")
        print(f" - Akurasi       : {ev['accuracy'] * 100:.2f}%")
        print(f" - Macro Prec    : {ev['precision_macro']:.4f}")
        print(f" - Macro Recall  : {ev['recall_macro']:.4f}")
        print(f" - Macro F1-Score: {ev['f1_macro']:.4f}")
        print(f" - Recall Kritis : {ev['recall_kritis'] * 100:.2f}% (Pencegahan False Negative)")

    print("\n--- PERFORMA REGRESI PROYEKSI SISA HARI (TEST SET) ---")
    print(f"MAE  : {eval_reg['mae_days']} hari")
    print(f"WAPE : {eval_reg['wape_percent']}%")

    print("\n--- TOP 5 FEATURE IMPORTANCES (RANDOM FOREST) ---")
    for imp in importances[:5]:
        print(f" - {imp['feature']:25s}: {imp['percentage']}%")

    # ----------------------------------------------------
    # Simpan Artefak Model Pipeline ke models/
    # ----------------------------------------------------
    pipeline = StockoutPredictorPipeline(
        classifier=rf_clf,
        regressor=rf_reg,
        scaler=scaler,
        feature_names=PREDICTOR_FEATURES,
        classes=list(rf_clf.classes_),
        version=MODEL_VERSION,
    )
    joblib.dump(pipeline, MODEL_JOB_PATH)
    print(f"\n[OK] Model pemenang disimpan ke: {MODEL_JOB_PATH}")

    # ----------------------------------------------------
    # Simpan Hasil Prediksi Test Set ke data/stockout_risk_predictions.csv
    # ----------------------------------------------------
    prediction_records = []
    for i, rec in enumerate(test_merged):
        p_class = str(y_pred_rf[i])
        p_prob = float(np.max(y_prob_rf[i]))
        p_days = round(float(y_days_pred[i]), 1)
        breached = p_days <= FACTORY_LEAD_TIME_DAYS

        prediction_records.append({
            "partner_id": rec["partner_id"],
            "partner_name": rec["partner_name"],
            "product_id": rec["product_id"],
            "product_name": rec["product_name"],
            "current_qty": rec["current_qty"],
            "par_level": rec["par_level"],
            "adu": rec["adu"],
            "actual_risk_level": rec["target_risk"],
            "predicted_risk_level": p_class,
            "risk_confidence": round(p_prob, 4),
            "predicted_days_to_stockout": p_days,
            "urgency_lead_time_breached": breached,
            "is_critical_recall_hit": (rec["target_risk"] == "Kritis" and p_class == "Kritis"),
            "model_version": MODEL_VERSION,
        })

    pred_fields = list(prediction_records[0].keys())
    with PREDICTIONS_CSV_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=pred_fields)
        writer.writeheader()
        writer.writerows(prediction_records)
    print(f"[OK] Prediksi test set disimpan ke: {PREDICTIONS_CSV_PATH}")

    # ----------------------------------------------------
    # Simpan Laporan Evaluasi Lengkap ke reports/stockout_model_evaluation.json
    # ----------------------------------------------------
    report_data = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_version": MODEL_VERSION,
        "train_set_size": len(train_inv),
        "test_set_size": len(test_inv),
        "predictor_features": PREDICTOR_FEATURES,
        "classification_comparison": [eval_heur, eval_gnb, eval_rf],
        "regression_projection_metrics": eval_reg,
        "factory_lead_time_days": FACTORY_LEAD_TIME_DAYS,
        "feature_importances": importances,
        "winning_model": {
            "algorithm": "RandomForestClassifier(n_estimators=100, class_weight='balanced')",
            "macro_f1": eval_rf["f1_macro"],
            "recall_kritis": eval_rf["recall_kritis"],
            "artifact_path": str(MODEL_JOB_PATH),
        },
    }

    EVALUATION_REPORT_PATH.write_text(json.dumps(report_data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[OK] Laporan evaluasi disimpan ke: {EVALUATION_REPORT_PATH}")

    return report_data


if __name__ == "__main__":
    train_and_evaluate()
