"""Keep the admin snapshot contract tied to one Data Science run."""
from __future__ import annotations

import unittest

from weekly_facts_aggregator import build_facts


class WeeklyFactsTests(unittest.TestCase):
    def test_contract_and_source_identity(self) -> None:
        source = {
            "metadata": {"generated_at": "2026-11-11T00:00:00+00:00", "period_days": 7},
            "network_sales": {"total_sold_7d": 14, "total_sold_prev_7d": 7,
                              "requested_restock_units": 20, "approved_restock_units": 10},
            "warehouse": [{"product_id": "p1", "product_name": "Seblak Jadul Instan", "sku": "S", "central_stock": 28}],
            "products": [{"rank": 1, "product_id": "p1", "product_name": "Seblak Jadul Instan",
                          "category": "Makanan Instan", "weekly_units": 14, "share_pct": 100}],
            "partners": [{"rank": 1, "partner_name": "Mitra Satu", "regency_name": "Kota Depok", "weekly_units": 14}],
            "reporting": [{"partner_name": "Mitra Satu", "regency_name": "Kota Depok", "log_count": 2}],
            "regions": [{"province_name": "Jawa Barat", "regency_name": "Kota Depok", "active_partners": 1, "weekly_units": 14}],
        }
        regional = {"source_generated_at": "2026-11-11T00:00:00+00:00", "model_version": "nb",
                    "generated_at": "2026-11-11T00:01:00+00:00",
                    "regional_rankings": [{"province_name": "Jawa Barat", "regency_name": "Kota Depok",
                                           "regional_zone": "ZONA_MERAH", "peak_stockout_probability": 75,
                                           "recommended_action": "Pantau stok"}]}
        facts = build_facts(source, regional)
        self.assertEqual(facts["network_sales"]["sales_growth_percentage"], 100)
        self.assertEqual(facts["network_sales"]["central_stock_health_days"], 14)
        self.assertEqual(facts["regional_hotspots"][0]["status"], "ZONA_MERAH")
        self.assertEqual(facts["top_selling_products"][0]["product_name"], "Seblak Jadul Instan")
        regional["source_generated_at"] = "old"
        with self.assertRaisesRegex(ValueError, "tidak cocok"):
            build_facts(source, regional)


if __name__ == "__main__":
    unittest.main()
