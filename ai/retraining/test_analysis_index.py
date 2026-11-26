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
            (folder / "weekly_analytics_summary.json").write_text(json.dumps({"partner_daily_log_breakdown": [
                {"day": "2026-11-02", "partner_id": "a", "partner_name": "A", "consumed_units": 12, "log_count": 2},
                {"day": "2026-11-02", "partner_id": "b", "partner_name": "B", "consumed_units": 999, "log_count": 3},
            ]}), encoding="utf-8")
            index = build_analysis_index(folder)
            self.assertTrue(index["documents"])
            own = search_partner_analysis(index, "a", "rangkum minggu saya")
            self.assertTrue(own)
            self.assertTrue(all(item["partner_id"] == "a" for item in own))
            self.assertFalse(any("999" in item["excerpt"] or "Seblak" in item["excerpt"] for item in own))
            self.assertEqual(search_partner_analysis(index, "c", "rangkum minggu saya"), [])
            self.assertEqual(search_partner_analysis(index, "a", "konsumsi 2 november 2026")[0]["consumed_units"], 12)
            self.assertEqual(search_partner_analysis(index, None, "mitra paling tinggi konsumsi 2 november 2026", admin_access=True)[0]["partner_id"], "b")
            old_count = len(index["documents"])
            for name in ("products", "partners", "regions", "reporting"):
                path = folder / f"category_{name}.json"
                payload = json.loads(path.read_text(encoding="utf-8"))
                payload["start_date"] = "2026-11-09"
                payload["end_date"] = "2026-11-11"
                path.write_text(json.dumps(payload), encoding="utf-8")
            updated = build_analysis_index(folder, index)
            self.assertEqual(len(updated["documents"]), old_count * 2)
            self.assertEqual(len(build_analysis_index(folder, updated)["documents"]), old_count * 2)
            self.assertEqual(len({item["period"] for item in updated["documents"]}), 2)
            self.assertTrue(all(item["partner_id"] == "a" for item in search_partner_analysis(updated, "a", "minggu lalu")))
            for name in ("products", "partners", "regions", "reporting"):
                path = folder / f"category_{name}.json"
                payload = json.loads(path.read_text(encoding="utf-8"))
                payload["end_date"] = "2026-11-13"
                path.write_text(json.dumps(payload), encoding="utf-8")
            self.assertEqual(len(build_analysis_index(folder, updated)["documents"]), old_count * 2)
            admin_results = search_partner_analysis(updated, None, "analisis mingguan", admin_access=True)
            self.assertTrue(admin_results)
            self.assertEqual(search_partner_analysis(updated, None, "analisis mingguan"), [])


if __name__ == "__main__":
    unittest.main()
