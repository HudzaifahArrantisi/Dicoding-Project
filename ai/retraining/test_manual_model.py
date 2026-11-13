"""Smoke check the manual artifact when it exists locally."""

import pickle
import unittest
from pathlib import Path

from analysis_index import search_partner_analysis

MODEL = Path(__file__).resolve().parents[1] / "data" / "private" / "manual" / "daisuki.pkl"


@unittest.skipUnless(MODEL.is_file(), "Model manual belum dilatih")
class ManualModelTests(unittest.TestCase):
    def test_pdf_vectors_and_partner_scope(self):
        with MODEL.open("rb") as source:
            bundle = pickle.load(source)
        self.assertGreater(len(bundle["raw_pdf_retrieval"]["documents"]), 0)
        self.assertEqual(len({item["source"] for item in bundle["raw_pdf_retrieval"]["documents"]}), 7)
        index = bundle["analysis_retrieval"]
        partner_id = next(item["partner_id"] for item in index["documents"] if item["partner_id"])
        results = search_partner_analysis(index, partner_id, "rangkum kegiatan saya seminggu")
        self.assertTrue(results)
        self.assertTrue(all(item["partner_id"] == partner_id for item in results))
        self.assertEqual(search_partner_analysis(index, "00000000-0000-4000-8000-000000000000", "rangkum minggu"), [])


if __name__ == "__main__":
    unittest.main()
