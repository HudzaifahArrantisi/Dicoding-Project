"""Check operational-record transformation and model I/O without a live DB."""

from __future__ import annotations

import tempfile
from pathlib import Path

from filter import DaisukiFilter
from source import build_training_samples
from train import save_model_safely, train_pipeline


def record(name: str, quantity: int, sold: int, active_order: bool) -> dict[str, object]:
    return {
        "partner_name": name, "partner_type": "kafe", "product_name": "Basreng Daun Jeruk",
        "current_qty": quantity, "par_level": 40, "central_stock": 850,
        "sold_7d": sold, "sold_prev_7d": 8, "sold_30d": 25,
        "report_count": 7, "critical_count": 0,
        "requested_30d": 40 if active_order else 0,
        "approved_30d": 20 if active_order else 0,
        "has_active_order": active_order,
    }


def main() -> None:
    # Fixtures test the transformation; production training never reads them.
    texts, labels = build_training_samples([
        record("Cabang A", 3, 28, False),
        record("Cabang B", 30, 7, True),
        record("Cabang C", 90, 7, False),
    ])
    assert labels == ["urgent_restock", "regular_order", "normal"]
    assert "Cabang A" in texts[0] and "28 pcs" in texts[0]
    with tempfile.TemporaryDirectory(prefix="daisuki-retraining-") as directory:
        model_path = Path(directory) / "daisuki.pkl"
        temp_path = Path(directory) / "daisuki.pkl.tmp"
        save_model_safely(train_pipeline(texts, labels), model_path, temp_path)
        assert model_path.is_file() and not temp_path.exists()
        classifier = DaisukiFilter(model_path)
        results = classifier.predict_with_confidence(texts)
        assert len(results) == 3
        assert classifier.predict(texts) == labels
        assert classifier.filter_by_label(texts, "urgent_restock") == [texts[0]]
        for result in results:
            print(f"{result['text'][:45]}... -> {result['predicted_label']} ({result['confidence']:.2%})")
    print("Smoke test lulus. Training produksi membaca PostgreSQL secara langsung.")


if __name__ == "__main__":
    main()
