"""Verify weekly vectors never return another partner's excerpts."""

import csv
import json
import tempfile
import unittest
from pathlib import Path

from analysis_index import build_analysis_index, search_partner_analysis


class PartnerAnalysisIndexTests(unittest.TestCase):
    def test_search_is_scoped_to_partner(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            for name in ("products", "partners", "regions", "reporting"):
                items = ([{"partner_id": "a", "partner_name": "A", "weekly_units": 12, "log_count": 3},
                          {"partner_id": "b", "partner_name": "B", "weekly_units": 999, "log_count": 5}]
                         if name in ("partners", "reporting") else [{"weekly_units": 1011}])
                (folder / f"category_{name}.json").write_text(json.dumps({
                    "start_date": "2026-11-01", "end_date": "2026-11-07", "items": items,
                }), encoding="utf-8")
            with (folder / "cleaned_inventory_summary.csv").open("w", newline="", encoding="utf-8") as file:
                writer = csv.DictWriter(file, fieldnames=["partner_id", "product_name", "weekly_consumption"])
                writer.writeheader()
                writer.writerows([{"partner_id": "a", "product_name": "Basreng", "weekly_consumption": 12},
                                  {"partner_id": "b", "product_name": "Seblak", "weekly_consumption": 999}])
            index = build_analysis_index(folder)
            self.assertTrue(index["documents"])
            own = search_partner_analysis(index, "a", "rangkum minggu saya")
            self.assertTrue(own)
            self.assertTrue(all(item["partner_id"] == "a" for item in own))
            self.assertFalse(any("999" in item["excerpt"] or "Seblak" in item["excerpt"] for item in own))
            self.assertEqual(search_partner_analysis(index, "c", "rangkum minggu saya"), [])


if __name__ == "__main__":
    unittest.main()
