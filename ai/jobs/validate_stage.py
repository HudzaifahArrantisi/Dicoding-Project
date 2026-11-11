"""Reject incomplete or mixed-run AI outputs before publication."""
from __future__ import annotations

import json
import pickle
from pathlib import Path

from run_context import run_id, source_file, stage_dir, verify_manifest


def validate() -> None:
    identifier = run_id()
    if not identifier:
        raise RuntimeError("Validasi tahap memerlukan DAISUKI_ANALYSIS_RUN_ID")
    manifest = verify_manifest()
    source = json.loads(source_file("weekly_analytics_summary.json").read_text(encoding="utf-8"))
    stage = stage_dir()
    for name, pointer in (("regional_stockout_insights.json", "source_run_id"),
                          ("regional_item_risks.json", "source_run_id"),
                          ("weekly_operational_facts.json", None),
                          ("allocation_preview.json", "source_run_id"),
                          ("model_evaluation.json", "source_run_id"),
                          ("chart_data.json", "source_run_id")):
        value = json.loads((stage / name).read_text(encoding="utf-8"))
        recorded = value[pointer] if pointer else value["metadata"]["source_run_id"]
        if recorded != identifier:
            raise ValueError(f"Run ID tidak cocok pada {name}")
    with (stage / "daisuki.pkl").open("rb") as handle:
        bundle = pickle.load(handle)
    if bundle.get("mainbrain_meta", {}).get("source_run_id") != identifier:
        raise ValueError("Model tidak berasal dari run yang sama")
    if bundle["mainbrain_meta"]["training_input_sha256"] != manifest["sha256"]["cleaned_inventory_summary.csv"]:
        raise ValueError("CSV training model tidak cocok dengan manifest")
    if source["metadata"]["generated_at"] != json.loads((stage / "weekly_operational_facts.json").read_text(encoding="utf-8"))["metadata"]["source_generated_at"]:
        raise ValueError("Fakta dashboard tidak cocok dengan sumber Data Science")
    if (stage / "daisuki.pkl").stat().st_size < 1000:
        raise ValueError("Artefak model terlalu kecil")
    print(f"Run {identifier} valid: {manifest['partner_product_rows']} pasangan mitra-produk")


if __name__ == "__main__":
    validate()
