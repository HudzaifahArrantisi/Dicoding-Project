"""Retrain the Daisuki text classifier from live AI Insights source tables,
and process ai/data/raw_references/ into ai/data/mainbrain/context_embeddings/.
"""

from __future__ import annotations

import logging
import json
import os
import pickle
import sys
from pathlib import Path
from typing import Any
import hashlib

import psycopg
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from source import build_intent_samples
from doc_loader import collect_mainbrain_knowledge_snippets, scan_and_generate_mainbrain
from knowledge_index import build_knowledge_index, build_raw_pdf_index
from analysis_index import build_analysis_index
from csv_handoff import INPUT as CSV_HANDOFF, is_fresh_handoff, prepare_handoff

AI_ROOT = str(Path(__file__).resolve().parents[1])
if AI_ROOT not in sys.path:
    sys.path.insert(0, AI_ROOT)
from jobs.run_context import run_id, source_file, stage_dir, verify_manifest

LOGGER = logging.getLogger(__name__)
BASE_DIR = Path(__file__).resolve().parent
MODEL_OUTPUT_FILE = (stage_dir() / "daisuki.pkl") if run_id() else BASE_DIR.parent / "data" / "mainbrain" / "models" / "daisuki.pkl"
TEMP_MODEL_FILE = MODEL_OUTPUT_FILE.with_name("daisuki.pkl.tmp")
CORPORATE_DIR = BASE_DIR.parent / "data" / "mainbrain" / "corporate_knowledge"
with (CORPORATE_DIR / "assistant_copy.json").open(encoding="utf-8") as source:
    IDENTITY_BIO = json.load(source)["identity_reply"]
with (CORPORATE_DIR / "business_rules.json").open(encoding="utf-8") as source:
    OFFICIAL_PRODUCTS = json.load(source)["official_products"]


def train_pipeline(texts: list[str], labels: list[str], *, fit_prior: bool = True) -> Pipeline:
    model = Pipeline([
        ("vectorizer", CountVectorizer(ngram_range=(1, 2), lowercase=True, strip_accents="unicode")),
        ("classifier", MultinomialNB(alpha=1.0, fit_prior=fit_prior)),
    ])
    model.fit(texts, labels)
    LOGGER.info("Training sudah selesesai ")
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
        csv_texts: list[str] = []
        csv_labels: list[str] = []
        handoff = source_file("cleaned_inventory_summary.csv") if run_id() else CSV_HANDOFF
        if run_id():
            verify_manifest()
        elif not is_fresh_handoff(handoff):
            raise ValueError("CSV laporan Data Science belum ada atau sudah kedaluwarsa; jalankan agregator lebih dulu")
        csv_texts, csv_labels, product_count = prepare_handoff(handoff)
        LOGGER.info("Data Science CSV: %d pasangan mitra-produk, %d produk", len(csv_texts), product_count)
        LOGGER.info("Memulai pemindaian dokumen di ai/data/raw_references/...")
        mainbrain_stats = scan_and_generate_mainbrain()
        LOGGER.info(
            "Hasil Mainbrain Generator: %d berhasil dikonversi ke Markdown, %d gagal dari %d dokumen.",
            mainbrain_stats["success"],
            mainbrain_stats["failed"],
            mainbrain_stats["total"],
        )

        # 2. Pipeline Klasifikasi Operasional Database & Intent
        texts, labels = csv_texts, csv_labels
        training_source = "data_science_csv"
        intent_texts, intent_labels = build_intent_samples()
        bundle: dict[str, Any] = {
            "intent": train_pipeline(intent_texts, intent_labels, fit_prior=False),
            "public_knowledge": collect_mainbrain_knowledge_snippets(),
            "retrieval": build_knowledge_index(),
            "mainbrain_meta": {
                "total_documents": mainbrain_stats["total"],
                "converted_markdowns": mainbrain_stats["success"],
                "training_input_source": training_source,
                "training_input_samples": len(texts),
                "source_run_id": run_id(),
                "training_input_sha256": hashlib.sha256(handoff.read_bytes()).hexdigest(),
            },
            "metadata": {
                "name": "Daisuki AI Assistant",
                "artifact": "daisuki.pkl",
                "role": "Asisten Inventaris & Restock Mitra B2B Daisuki",
                "algorithm": "Multinomial Naive Bayes",
                "specialization": "Klasifikasi Intensi & Prediksi Risiko Stok 4 Produk Resmi",
                "supported_products": OFFICIAL_PRODUCTS,
                "identity_bio": IDENTITY_BIO,
            },
        }
        if run_id():
            bundle["analysis_retrieval"] = build_analysis_index(handoff.parent)
            bundle["raw_pdf_retrieval"] = build_raw_pdf_index()
        if len(set(labels)) >= 2:
            bundle["risk"] = train_pipeline(texts, labels)
            bundle["mainbrain_meta"]["risk_model_source"] = training_source
        elif MODEL_OUTPUT_FILE.exists():
            from filter import DaisukiFilter
            previous = DaisukiFilter(MODEL_OUTPUT_FILE, model_key="risk")
            if previous.is_ready:
                bundle["risk"] = previous.model
                bundle["mainbrain_meta"]["risk_model_source"] = "retained_previous"
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
