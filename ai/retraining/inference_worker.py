"""Line-delimited inference worker for the Elysia assistant API."""

from __future__ import annotations

import json
import os
import sys

from filter import DaisukiFilter, MODEL_FILE
from source import build_training_samples


def main() -> None:
    classifier = DaisukiFilter(os.environ.get("DAISUKI_MODEL_PATH") or MODEL_FILE)
    for line in sys.stdin:
        request = None
        try:
            request = json.loads(line)
            records = request["records"]
            if not isinstance(records, list) or len(records) > 20:
                raise ValueError("Jumlah produk tidak valid")
            if not classifier.is_ready:
                result = {"id": request["id"], "available": False, "predictions": []}
            else:
                texts, _ = build_training_samples(records)
                predictions = classifier.predict_with_confidence(texts)
                result = {
                    "id": request["id"],
                    "available": True,
                    "predictions": [
                        {
                            "product_id": record["product_id"],
                            "label": prediction["predicted_label"],
                            "confidence": prediction["confidence"],
                        }
                        for record, prediction in zip(records, predictions, strict=True)
                    ],
                }
        except (KeyError, TypeError, ValueError, RuntimeError) as error:
            result = {"id": request.get("id") if isinstance(request, dict) else None, "error": str(error)}
        sys.stdout.write(json.dumps(result, ensure_ascii=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
