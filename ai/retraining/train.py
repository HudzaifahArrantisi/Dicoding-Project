"""Retrain the Daisuki text classifier from live AI Insights source tables,
and automatically process all documents in ai/data/ into ai/data/mainbrain/*.md.
"""

from __future__ import annotations

import logging
import os
import pickle
import sys
from pathlib import Path
from typing import Any

import psycopg
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from source import build_intent_samples, build_training_samples, fetch_training_records
from doc_loader import scan_and_generate_mainbrain

LOGGER = logging.getLogger(__name__)
BASE_DIR = Path(__file__).resolve().parent
MODEL_OUTPUT_FILE = BASE_DIR / "daisuki.pkl"
TEMP_MODEL_FILE = BASE_DIR / "daisuki.pkl.tmp"


def train_pipeline(texts: list[str], labels: list[str], *, fit_prior: bool = True) -> Pipeline:
    model = Pipeline([
        ("vectorizer", CountVectorizer(ngram_range=(1, 2), lowercase=True, strip_accents="unicode")),
        ("classifier", MultinomialNB(alpha=1.0, fit_prior=fit_prior)),
    ])
    model.fit(texts, labels)
    LOGGER.info("Training selesai")
    return model


def save_model_safely(model: Pipeline | dict[str, Any], dest_path: Path, temp_path: Path) -> None:
    """Write beside the destination, then atomically replace the old model."""
    try:
        with temp_path.open("wb") as output:
            pickle.dump(model, output, protocol=pickle.HIGHEST_PROTOCOL)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temp_path, dest_path)
        LOGGER.info("Model udh  di simpan: %s", dest_path)
    finally:
        if temp_path.exists():
            try:
                os.remove(temp_path)
            except OSError as error:
                LOGGER.warning("Gagal membersihkan file sementara %s: %s", temp_path, error)


def run_retraining_loop() -> bool:
    try:
        # 1. Pipeline Universal Document Ingestion: Scan ai/data/ -> generate ai/data/mainbrain/*.md
        LOGGER.info("Memulai pemindaian dan pembuatan Mainbrain dari dokumen di ai/data/...")
        mainbrain_stats = scan_and_generate_mainbrain()
        LOGGER.info(
            "Hasil Mainbrain Generator: %d berhasil dikonversi ke Markdown, %d gagal dari %d dokumen.",
            mainbrain_stats["success"],
            mainbrain_stats["failed"],
            mainbrain_stats["total"],
        )

        # 2. Pipeline Klasifikasi Operasional Database & Intent
        records = fetch_training_records()
        texts, labels = build_training_samples(records)
        intent_texts, intent_labels = build_intent_samples()
        bundle: dict[str, Any] = {
            "intent": train_pipeline(intent_texts, intent_labels, fit_prior=False),
            "mainbrain_meta": {
                "total_documents": mainbrain_stats["total"],
                "converted_markdowns": mainbrain_stats["success"],
            },
            "metadata": {
                "name": "Daisuki AI Assistant",
                "artifact": "daisuki.pkl",
                "role": "Asisten Inventaris & Restock Mitra B2B Daisuki",
                "algorithm": "Multinomial Naive Bayes",
                "specialization": "Klasifikasi Intensi & Prediksi Risiko Stok 4 Produk Resmi",
                "supported_products": [
                    "Seblak Jadul Instan",
                    "Basreng Daun Jeruk",
                    "Makaroni Daun Jeruk",
                    "Keripik Pisang Rasa Coklat",
                ],
                "identity_bio": (
                    "Halo! Saya adalah Daisuki AI Assistant, sistem cerdas yang ditenagai langsung "
                    "oleh artefak model klasifikasi daisuki.pkl, kumpulan dokumen ai/data/mainbrain/, "
                    "dan basis data operasional Daisuki. Saya bertugas mendampingi mitra cabang dalam memantau "
                    "sisa stok fisik 4 produk resmi, memahami SOP operasional, menganalisis laju konsumsi mingguan, "
                    "mendeteksi risiko stok sebelum kritis, serta membantu perhitungan rekomendasi pengajuan restock ke gudang pusat."
                ),
            },
        }
        if len(set(labels)) >= 2:
            bundle["risk"] = train_pipeline(texts, labels)
        elif MODEL_OUTPUT_FILE.exists():
            from filter import DaisukiFilter
            previous = DaisukiFilter(MODEL_OUTPUT_FILE, model_key="risk")
            if previous.is_ready:
                bundle["risk"] = previous.model
        if "risk" not in bundle:
            LOGGER.warning("Data stok hanya satu kelas; model intent tetap dilatih, prediksi risiko belum tersedia")
        LOGGER.info("Training intent dari %d frasa dan risiko dari %d pasangan mitra-produk", len(intent_texts), len(texts))
        save_model_safely(bundle, MODEL_OUTPUT_FILE, TEMP_MODEL_FILE)
        return True
    except (OSError, ValueError, RuntimeError, psycopg.Error) as error:
        LOGGER.exception("Retraining gagal; model lama dipertahankan: %s", error)
        return False


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", stream=sys.stdout)
    raise SystemExit(0 if run_retraining_loop() else 1)
