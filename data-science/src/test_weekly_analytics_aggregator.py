"""Check period boundaries, consumption, reporting, and warehouse projections."""
from __future__ import annotations

import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path

from weekly_analytics_aggregator import JAKARTA, analyze, write_report


class WeeklyAnalyticsTests(unittest.TestCase):
    def test_complete_snapshot(self) -> None:
        start = datetime(2026, 11, 2, tzinfo=JAKARTA)
        end = start + timedelta(days=7)
        products = [{"id": "seblak", "name": "Seblak Jadul Instan", "sku": "S", "central_stock": 30},
                    {"id": "other", "name": "Produk Bukan Katalog", "sku": "X", "central_stock": 100}]
        stocks = [{"partner_id": "m1", "partner_name": "Mitra Satu", "partner_type": "hotel",
                   "province_name": "Jawa Barat", "regency_name": "Kota Depok", "product_id": "seblak",
                   "product_name": "Seblak Jadul Instan", "product_sku": "S", "current_qty": 5, "par_level": 20},
                  {"partner_id": "m2", "partner_name": "Mitra Dua", "partner_type": "cafe",
                   "province_name": "Jawa Barat", "regency_name": "Kota Depok", "product_id": "seblak",
                   "product_name": "Seblak Jadul Instan", "product_sku": "S", "current_qty": 40, "par_level": 20}]
        logs = [{"partner_id": "m1", "product_id": "seblak", "qty_before": 40, "qty_after": 26,
                 "created_at": start + timedelta(days=1)},
                {"partner_id": "m1", "product_id": "seblak", "qty_before": 26, "qty_after": 5,
                 "created_at": start + timedelta(days=2)},
                {"partner_id": "m2", "product_id": "seblak", "qty_before": 40, "qty_after": 33,
                 "created_at": start - timedelta(days=1)},
                {"partner_id": "m1", "product_id": "seblak", "qty_before": 5, "qty_after": 0,
                 "created_at": end}]
        orders = [{"order_id": "o1", "partner_id": "m1", "product_id": "seblak", "status": "diproses",
                   "qty_requested": 10, "qty_approved": None, "created_at": start + timedelta(days=2)}]
        report, cleaned = analyze(start, end, products, stocks, logs, orders)
        self.assertEqual(report["network_sales"]["total_sold_7d"], 35)
        self.assertEqual(report["network_sales"]["total_sold_prev_7d"], 7)
        self.assertEqual(report["products"][0]["share_pct"], 100)
        self.assertEqual(report["regions"][0]["restock_frequency"], 1)
        self.assertEqual(report["partners"][0]["active_days"], 2)
        self.assertEqual({item["partner_id"] for item in report["partners"]}, {"m1", "m2"})
        self.assertEqual(next(item for item in report["partners"] if item["partner_id"] == "m2")["log_count"], 0)
        self.assertEqual(len(report["daily_reporting"]), 7)
        self.assertEqual(report["daily_reporting"][1]["log_count"], 1)
        self.assertEqual(report["warehouse"][0]["central_stock"], 30)
        self.assertEqual(len(cleaned), 2)
        self.assertEqual(cleaned[0]["weekly_consumption"], 35)
        with tempfile.TemporaryDirectory() as directory:
            write_report(report, cleaned, Path(directory))
            self.assertTrue((Path(directory) / "weekly_analytics_summary.json").is_file())
            self.assertTrue((Path(directory) / "cleaned_inventory_summary.csv").is_file())
            self.assertTrue((Path(directory) / "weekly_analytics_report.md").is_file())
            for name in ("category_products.json", "category_partners.json", "category_regions.json", "category_reporting.json"):
                self.assertTrue((Path(directory) / name).is_file())


if __name__ == "__main__":
    unittest.main()
