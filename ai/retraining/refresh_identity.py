"""Refresh the intent classifier and Daisuki AI identity without a database connection."""

from __future__ import annotations

import pickle

from source import build_intent_samples
from train import IDENTITY_BIO, MODEL_OUTPUT_FILE, TEMP_MODEL_FILE, save_model_safely, train_pipeline


def main() -> None:
    if not MODEL_OUTPUT_FILE.is_file():
        raise SystemExit("daisuki.pkl belum tersedia; jalankan train.py terlebih dahulu")
    with MODEL_OUTPUT_FILE.open("rb") as source:
        bundle = pickle.load(source)
    if not isinstance(bundle, dict) or "intent" not in bundle:
        raise SystemExit("Format daisuki.pkl tidak mendukung pembaruan intent")

    texts, labels = build_intent_samples()
    bundle["intent"] = train_pipeline(texts, labels, fit_prior=False)
    metadata = dict(bundle.get("metadata") or {})
    metadata.update(name="Daisuki AI Assistant", identity_bio=IDENTITY_BIO)
    bundle["metadata"] = metadata
    save_model_safely(bundle, MODEL_OUTPUT_FILE, TEMP_MODEL_FILE)
    print(f"Identitas Daisuki AI dan {len(texts)} contoh intent diperbarui; model risiko dipertahankan.")


if __name__ == "__main__":
    main()
