"""Retrain the Daisuki text classifier from live AI Insights source tables."""

from __future__ import annotations

import logging
import os
import pickle
import sys
from pathlib import Path

import psycopg
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from source import build_training_samples, fetch_training_records

LOGGER = logging.getLogger(__name__)
BASE_DIR = Path(__file__).resolve().parent
MODEL_OUTPUT_FILE = BASE_DIR / "daisuki.pkl"
TEMP_MODEL_FILE = BASE_DIR / "daisuki.pkl.tmp"


def train_pipeline(texts: list[str], labels: list[str]) -> Pipeline:
    model = Pipeline([
        ("vectorizer", CountVectorizer(ngram_range=(1, 2), lowercase=True, strip_accents="unicode")),
        ("classifier", MultinomialNB(alpha=1.0)),
    ])
    model.fit(texts, labels)
    LOGGER.info("Training selesai")
    return model


def save_model_safely(model: Pipeline, dest_path: Path, temp_path: Path) -> None:
    """Write beside the destination, then atomically replace the old model."""
    try:
        with temp_path.open("wb") as output:
            pickle.dump(model, output, protocol=pickle.HIGHEST_PROTOCOL)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temp_path, dest_path)
        LOGGER.info("Model tersimpan: %s", dest_path)
    finally:
        if temp_path.exists():
            try:
                os.remove(temp_path)
            except OSError as error:
                LOGGER.warning("Gagal membersihkan file sementara %s: %s", temp_path, error)


def run_retraining_loop() -> bool:
    try:
        records = fetch_training_records()
        texts, labels = build_training_samples(records)
        if not texts:
            LOGGER.warning("Belum ada data stok mitra untuk training; model lama dipertahankan")
            return False
        if len(set(labels)) < 2:
            LOGGER.warning("Hanya ada satu kelas label dari data nyata; model lama dipertahankan")
            return False
        LOGGER.info("Training dari %d pasangan mitra-produk dan %d kelas", len(texts), len(set(labels)))
        model = train_pipeline(texts, labels)
        save_model_safely(model, MODEL_OUTPUT_FILE, TEMP_MODEL_FILE)
        return True
    except (OSError, ValueError, RuntimeError, psycopg.Error) as error:
        LOGGER.exception("Retraining gagal; model lama dipertahankan: %s", error)
        return False


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", stream=sys.stdout)
    raise SystemExit(0 if run_retraining_loop() else 1)
