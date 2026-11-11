"""Exercise the CSV handoff without touching production files or PostgreSQL."""

from __future__ import annotations

import csv
import os
import pickle
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import train
from csv_handoff import MAX_AGE_SECONDS, is_fresh_handoff, load_samples, prepare_handoff


class CsvHandoffTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.source = Path(self.directory.name) / "cleaned_inventory_summary.csv"
        self.output = Path(self.directory.name) / "ai_analysis_summary.csv"

    def write_rows(self, rows: list[dict[str, str]]) -> None:
        with self.source.open("w", newline="", encoding="utf-8") as target:
            writer = csv.DictWriter(target, fieldnames=["partner_id", "product_id", "product_name", "current_qty", "par_level", "weekly_consumption", "days_of_cover"])
            writer.writeheader()
            writer.writerows(rows)

    def test_training_samples_and_private_aggregate(self) -> None:
        self.write_rows([
            {"partner_id": "mitra-1", "product_id": "p-1", "product_name": "Seblak Jadul Instan", "current_qty": "2", "par_level": "20", "weekly_consumption": "28", "days_of_cover": "0.5"},
            {"partner_id": "mitra-2", "product_id": "p-1", "product_name": "Seblak Jadul Instan", "current_qty": "80", "par_level": "20", "weekly_consumption": "7", "days_of_cover": "80"},
        ])
        texts, labels, products = prepare_handoff(self.source, self.output)
        self.assertEqual(labels, ["urgent_restock", "normal"])
        self.assertEqual(products, 1)
        self.assertEqual(len(texts), 2)
        content = self.output.read_text(encoding="utf-8")
        self.assertIn("Seblak Jadul Instan,2,35.00", content)
        self.assertNotIn("mitra-1", content)

    def test_invalid_catalog_rejected(self) -> None:
        self.write_rows([
            {"partner_id": "mitra-1", "product_id": "p-9", "product_name": "Produk Lain", "current_qty": "2", "par_level": "20", "weekly_consumption": "28", "days_of_cover": "0.5"},
        ])
        with self.assertRaisesRegex(ValueError, "Produk atau identitas"):
            load_samples(self.source)
        self.assertFalse(self.output.exists())

    def test_old_handoff_is_rejected(self) -> None:
        self.write_rows([])
        old = self.source.stat().st_mtime - MAX_AGE_SECONDS - 60
        os.utime(self.source, (old, old))
        self.assertFalse(is_fresh_handoff(self.source))

    def test_retraining_uses_csv_without_database(self) -> None:
        self.write_rows([
            {"partner_id": "mitra-1", "product_id": "p-1", "product_name": "Seblak Jadul Instan", "current_qty": "2", "par_level": "20", "weekly_consumption": "28", "days_of_cover": "0.5"},
            {"partner_id": "mitra-2", "product_id": "p-1", "product_name": "Seblak Jadul Instan", "current_qty": "80", "par_level": "20", "weekly_consumption": "7", "days_of_cover": "80"},
        ])
        model = Path(self.directory.name) / "daisuki.pkl"
        with (patch.object(train, "CSV_HANDOFF", self.source),
              patch.object(train, "prepare_handoff", side_effect=lambda path: prepare_handoff(path, self.output)),
              patch.object(train, "scan_and_generate_mainbrain", return_value={"total": 2, "success": 2, "failed": 0}),
              patch.object(train, "MODEL_OUTPUT_FILE", model),
              patch.object(train, "TEMP_MODEL_FILE", model.with_suffix(".pkl.tmp"))):
            self.assertTrue(train.run_retraining_loop())
        with model.open("rb") as source:
            bundle = pickle.load(source)
        self.assertEqual(bundle["mainbrain_meta"]["risk_model_source"], "data_science_csv")
        self.assertEqual(bundle["mainbrain_meta"]["training_input_samples"], 2)
        self.assertIn("risk", bundle)


if __name__ == "__main__":
    unittest.main()
