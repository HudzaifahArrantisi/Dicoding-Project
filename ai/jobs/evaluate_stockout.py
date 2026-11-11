"""Evaluate historical stockout labels without using future logs as features."""
from __future__ import annotations

import json
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row
from sklearn.metrics import average_precision_score, brier_score_loss, precision_score, recall_score

from regional_stockout_naive_bayes import MultiFactorNaiveBayes
from run_context import run_id, stage_dir, verify_manifest

ROOT = Path(__file__).resolve().parents[2]
LOOKAHEAD = timedelta(days=7)


def historical_examples(rows: list[dict]) -> list[dict]:
    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in rows:
        grouped[(str(row["partner_id"]), str(row["product_id"]))].append(row)
    examples = []
    for logs in grouped.values():
        logs.sort(key=lambda row: row["created_at"])
        for index, current in enumerate(logs):
            if current["source"] != "manual_update" or index < 2:
                continue
            timestamp = current["created_at"]
            past = [row for row in logs[:index] if row["source"] == "manual_update" and timestamp - timedelta(days=14) <= row["created_at"] < timestamp]
            if len(past) < 2:
                continue
            future = [row for row in logs[index + 1:] if row["created_at"] <= timestamp + LOOKAHEAD]
            observed = [row for row in future if row["source"] == "manual_update"]
            if not observed:
                continue
            prior = [row for row in past if row["created_at"] >= timestamp - timedelta(days=7)]
            older = [row for row in past if row["created_at"] < timestamp - timedelta(days=7)]
            velocity = max(0.05, sum(max(0, row["qty_before"] - row["qty_after"]) for row in prior) / 7)
            old_velocity = max(0.05, sum(max(0, row["qty_before"] - row["qty_after"]) for row in older) / 7)
            cover = max(0, current["qty_after"]) / velocity
            first_receipt = next((row["created_at"] for row in future if row["source"] == "order_received"), None)
            label = int(any(row["qty_after"] == 0 and (first_receipt is None or row["created_at"] < first_receipt) for row in observed))
            features = [cover, velocity, velocity / old_velocity, 7 / max(cover, 0.5),
                        sum(row["qty_after"] <= max(1, row["qty_before"] * 0.2) for row in past),
                        sum(row["qty_after"] == 0 for row in past)]
            examples.append({"time": timestamp, "type": current["partner_type"], "features": features,
                             "label": label, "baseline": int(cover <= 7)})
    return sorted(examples, key=lambda item: item["time"])


def score(y_true: list[int], probabilities: list[float], threshold: float = 0.5) -> dict:
    predicted = [int(value >= threshold) for value in probabilities]
    return {"precision": round(float(precision_score(y_true, predicted, zero_division=0)), 4),
            "recall": round(float(recall_score(y_true, predicted, zero_division=0)), 4),
            "pr_auc": round(float(average_precision_score(y_true, probabilities)), 4),
            "brier": round(float(brier_score_loss(y_true, probabilities)), 4),
            "false_alerts": sum(not actual and predicted for actual, predicted in zip(y_true, predicted))}


def evaluate(rows: list[dict], source_run_id: str) -> dict:
    examples = historical_examples(rows)
    split = int(len(examples) * 0.7)
    train, test = examples[:split], examples[split:]
    report = {"source_run_id": source_run_id, "generated_at": datetime.now(timezone.utc).isoformat(),
              "label": "stok fisik mencapai nol dalam tujuh hari sebelum penerimaan barang",
              "training_samples": len(train), "evaluation_samples": len(test),
              "evaluation_events": sum(item["label"] for item in test), "calibrated": False,
              "decision": "insufficient_evidence", "model": None, "baseline": None}
    if len(train) < 80 or len(test) < 30 or sum(item["label"] for item in train) < 10 or sum(item["label"] for item in test) < 5 or sum(item["label"] for item in test) == len(test):
        return report
    model = MultiFactorNaiveBayes()
    model.fit([item["features"] for item in train], [item["type"] for item in train],
              ["RISIKO_TINGGI" if item["label"] else "RISIKO_RENDAH" for item in train])
    y = [item["label"] for item in test]
    predicted = [model.predict_item(item["features"], item["type"])[0].get("RISIKO_TINGGI", 0.0) for item in test]
    baseline = [float(item["baseline"]) for item in test]
    report["model"] = score(y, predicted)
    report["baseline"] = score(y, baseline)
    report["decision"] = "candidate_beats_baseline" if report["model"]["pr_auc"] > report["baseline"]["pr_auc"] and report["model"]["brier"] <= report["baseline"]["brier"] else "keep_rule_baseline"
    return report


def main() -> None:
    identifier = run_id()
    if not identifier:
        raise RuntimeError("Evaluasi memerlukan DAISUKI_ANALYSIS_RUN_ID")
    verify_manifest()
    load_dotenv(ROOT / "ai" / ".env")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL belum tersedia")
    with psycopg.connect(database_url, row_factory=dict_row, connect_timeout=10) as connection:
        rows = connection.execute("""SELECT sl.partner_id, sl.product_id, sl.qty_before, sl.qty_after,
            sl.source::text AS source, sl.created_at, p.type::text AS partner_type
            FROM stock_logs sl JOIN partners p ON p.id = sl.partner_id
            WHERE sl.created_at >= now() - interval '180 days'
              AND sl.source IN ('manual_update', 'order_received')
            ORDER BY sl.partner_id, sl.product_id, sl.created_at""").fetchall()
    report = evaluate(rows, identifier)
    (stage_dir() / "model_evaluation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Evaluasi: {report['evaluation_samples']} sampel, {report['evaluation_events']} kejadian; keputusan {report['decision']}")


if __name__ == "__main__":
    main()
