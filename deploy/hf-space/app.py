"""Bridge HTTP untuk model Daisuki.

Menjalankan inferensi yang sama seperti ai/retraining/inference_worker.py, tetapi
lewat HTTP agar backend Elysia (kontainer atau Cloudflare Workers) tidak perlu
menjalankan Python.

Endpoint:
  GET  /health     kesiapan model dan indeks retrieval
  POST /predict    label risiko stok untuk daftar produk mitra
  POST /understand intent pesan + cuplikan RAG + analisis mitra
  POST /reload     unduh ulang daisuki.pkl terbaru dari Hugging Face Hub
"""

from __future__ import annotations

import hmac
import os
import sys
from pathlib import Path
from typing import Any

# filter.py, source.py, knowledge_index.py, dan analysis_index.py memakai impor
# datar antar modul, jadi folder retraining harus ada di sys.path.
sys.path.insert(0, str(Path(__file__).resolve().parent / "retraining"))

from fastapi import FastAPI, Header, HTTPException  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from analysis_index import search_partner_analysis  # noqa: E402
from filter import DaisukiFilter  # noqa: E402
from knowledge_index import search_knowledge, search_raw_reference  # noqa: E402
from source import build_training_samples  # noqa: E402

MODEL_PATH = os.environ.get("DAISUKI_MODEL_PATH", "/app/data/mainbrain/models/daisuki.pkl")
BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "").strip()
MODEL_REPO = os.environ.get("HF_MODEL_REPO", "").strip()
HF_TOKEN = os.environ.get("HF_TOKEN", "").strip()

# Model memuat indeks privat: analisis 644 pasangan mitra-produk dan 387
# cuplikan PDF (CV, karya ilmiah, jurnal). Space ini tidak boleh melayani satu
# permintaan pun tanpa token, jadi lebih baik gagal saat start daripada hidup
# tanpa autentikasi.
if not BRIDGE_TOKEN:
    raise RuntimeError(
        "BRIDGE_TOKEN belum diisi. Set secret Space sebelum menjalankan bridge: "
        "hf spaces secrets add <username>/daisuki-rag --secrets BRIDGE_TOKEN=<string-acak>"
    )
if len(BRIDGE_TOKEN) < 16:
    raise RuntimeError("BRIDGE_TOKEN terlalu pendek. Pakai minimal 16 karakter acak.")

MAX_RECORDS = 20
MAX_MESSAGE_LENGTH = 500

app = FastAPI(title="Daisuki RAG Bridge", docs_url=None, redoc_url=None)

risk_classifier = DaisukiFilter(MODEL_PATH, model_key="risk")
intent_classifier = DaisukiFilter(MODEL_PATH, model_key="intent")


def authorize(authorization: str | None) -> None:
    """Tolak permintaan tanpa token yang cocok.

    Perbandingan memakai compare_digest agar waktu respons tidak membocorkan
    berapa karakter awal token yang benar.
    """
    presented = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not presented or not hmac.compare_digest(presented, BRIDGE_TOKEN):
        raise HTTPException(status_code=401, detail="Unauthorized")


def reload_classifiers() -> None:
    """Paksa muat ulang berkas model tanpa memulai proses baru."""
    risk_classifier.load_model(force_reload=True)
    intent_classifier.load_model(force_reload=True)


class PredictBody(BaseModel):
    records: list[dict[str, Any]] = Field(default_factory=list)


class UnderstandBody(BaseModel):
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)
    partner_id: str | None = None
    admin_access: bool = False


@app.get("/health")
def health() -> dict[str, Any]:
    """Kesiapan model. Dipakai warmup API dan pemeriksaan manual."""
    return {
        "available": intent_classifier.is_ready,
        "risk_available": risk_classifier.is_ready,
        "retrieval_ready": bool(intent_classifier.retrieval.get("documents")),
        "raw_retrieval_ready": bool(intent_classifier.raw_retrieval.get("documents")),
        "analysis_ready": bool(intent_classifier.analysis_retrieval.get("documents")),
    }


@app.post("/predict")
def predict(body: PredictBody, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    """Label risiko stok per produk mitra."""
    authorize(authorization)
    if len(body.records) > MAX_RECORDS:
        raise HTTPException(status_code=422, detail="Jumlah produk tidak valid")
    result: dict[str, Any] = {
        "available": intent_classifier.is_ready,
        "risk_available": risk_classifier.is_ready,
        "predictions": [],
    }
    if body.records and risk_classifier.is_ready:
        texts, _ = build_training_samples(body.records)
        predictions = risk_classifier.predict_with_confidence(texts)
        result["predictions"] = [
            {
                "product_id": record["product_id"],
                "label": prediction["predicted_label"],
                "confidence": prediction["confidence"],
            }
            for record, prediction in zip(body.records, predictions, strict=True)
        ]
    return result


@app.post("/understand")
def understand(body: UnderstandBody, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    """Intent pesan, cuplikan RAG, dan analisis mitra dalam satu panggilan."""
    authorize(authorization)
    result: dict[str, Any] = {
        "available": intent_classifier.is_ready,
        "risk_available": risk_classifier.is_ready,
        "retrieval_ready": bool(intent_classifier.retrieval.get("documents")),
        "intent": None,
        "predictions": [],
        "documents": [],
    }
    if body.admin_access:
        result["raw_retrieval_ready"] = bool(intent_classifier.raw_retrieval.get("documents"))

    if intent_classifier.is_ready:
        prediction = intent_classifier.predict_with_confidence(body.message)[0]
        result["intent"] = {
            "label": prediction["predicted_label"],
            "confidence": prediction["confidence"],
        }

    result["documents"] = search_knowledge(intent_classifier.retrieval, body.message)
    if body.admin_access:
        result["raw_documents"] = search_raw_reference(intent_classifier.raw_retrieval, body.message)
    if isinstance(body.partner_id, str) and body.partner_id:
        result["analysis_documents"] = search_partner_analysis(
            intent_classifier.analysis_retrieval, body.partner_id, body.message
        )

    identity = intent_classifier.metadata or risk_classifier.metadata
    if identity:
        result["identity"] = identity
    return result


@app.post("/reload")
def reload_model(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    """Unduh daisuki.pkl terbaru dari Hub lalu muat ulang.

    Dipanggil API setelah pipeline training selesai. Bila HF_MODEL_REPO kosong,
    endpoint hanya memuat ulang berkas yang sudah ada di disk.
    """
    authorize(authorization)
    downloaded = False
    if MODEL_REPO:
        try:
            from huggingface_hub import hf_hub_download

            path = hf_hub_download(
                repo_id=MODEL_REPO,
                filename="daisuki.pkl",
                token=HF_TOKEN or None,
                force_download=True,
            )
            Path(MODEL_PATH).parent.mkdir(parents=True, exist_ok=True)
            Path(MODEL_PATH).write_bytes(Path(path).read_bytes())
            downloaded = True
        except Exception as error:  # noqa: BLE001 - laporkan ke pemanggil, jangan matikan Space
            raise HTTPException(status_code=502, detail=f"Gagal mengunduh model: {error}") from error

    reload_classifiers()
    return {
        "reloaded": True,
        "downloaded": downloaded,
        "available": intent_classifier.is_ready,
        "retrieval_ready": bool(intent_classifier.retrieval.get("documents")),
    }
