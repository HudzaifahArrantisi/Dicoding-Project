"""Line-delimited inference worker for the Elysia assistant API."""

from __future__ import annotations

import json
import os
import sys

from filter import DaisukiFilter, MODEL_FILE
from source import build_training_samples


def main() -> None:
    model_path = os.environ.get("DAISUKI_MODEL_PATH") or MODEL_FILE
    risk_classifier = DaisukiFilter(model_path, model_key="risk")
    intent_classifier = DaisukiFilter(model_path, model_key="intent")
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        request = None
        try:
            request = json.loads(line)
            records = request.get("records", [])
            if not isinstance(records, list) or len(records) > 20:
                raise ValueError("Jumlah produk tidak valid")
            result = {"id": request["id"], "available": risk_classifier.is_ready, "predictions": []}
            if records and risk_classifier.is_ready:
                texts, _ = build_training_samples(records)
                predictions = risk_classifier.predict_with_confidence(texts)
                result["predictions"] = [
                        {
                            "product_id": record["product_id"],
                            "label": prediction["predicted_label"],
                            "confidence": prediction["confidence"],
                        }
                        for record, prediction in zip(records, predictions, strict=True)
                    ]
            message = request.get("message")
            if message is not None:
                if not isinstance(message, str) or not message.strip() or len(message) > 500:
                    raise ValueError("Pesan tidak valid")
                result["intent"] = None
                if intent_classifier.is_ready:
                    prediction = intent_classifier.predict_with_confidence(message)[0]
                    result["intent"] = {"label": prediction["predicted_label"], "confidence": prediction["confidence"]}
        except (KeyError, TypeError, ValueError, RuntimeError) as error:
            result = {"id": request.get("id") if isinstance(request, dict) else None, "error": str(error)}
        sys.stdout.write(json.dumps(result, ensure_ascii=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
