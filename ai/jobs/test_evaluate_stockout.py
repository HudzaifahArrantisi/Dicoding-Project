import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from evaluate_stockout import evaluate, historical_examples


class HistoricalEvaluationTests(unittest.TestCase):
    def test_future_event_is_label_only(self):
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        logs = [
            {"partner_id": "a", "product_id": "p", "partner_type": "hotel", "source": "manual_update",
             "created_at": start + timedelta(days=day), "qty_before": before, "qty_after": after}
            for day, before, after in [(0, 10, 9), (1, 9, 8), (2, 8, 7), (3, 7, 0)]
        ]
        examples = historical_examples(logs)
        self.assertEqual(examples[0]["label"], 1)
        original = examples[0]["features"]
        logs[-1]["qty_before"] = 9999
        self.assertEqual(historical_examples(logs)[0]["features"], original)

    def test_small_dataset_does_not_claim_calibration(self):
        result = evaluate([], "example")
        self.assertFalse(result["calibrated"])
        self.assertEqual(result["decision"], "insufficient_evidence")


if __name__ == "__main__":
    unittest.main()
