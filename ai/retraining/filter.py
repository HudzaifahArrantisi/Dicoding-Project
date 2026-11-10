"""Cached inference for the locally trained Daisuki text classifier.

Only load pickle files produced by this application. Pickle is unsafe for untrusted files.
"""

from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import TypedDict

from sklearn.pipeline import Pipeline

LOGGER = logging.getLogger(__name__)
MODEL_FILE = Path(__file__).resolve().parents[2] / "data" / "mainbrain" / "models" / "daisuki.pkl"


class Prediction(TypedDict):
    text: str
    predicted_label: str
    confidence: float
    all_probabilities: dict[str, float]


class DaisukiFilter:
    def __init__(self, model_path: str | Path = MODEL_FILE, model_key: str = "risk") -> None:
        self.model_path = Path(model_path)
        self.model_key = model_key
        self._model: Pipeline | None = None
        self._metadata: dict[str, Any] = {}
        self._last_loaded_mtime: int | None = None
        self.load_model()

    def load_model(self, force_reload: bool = False) -> None:
        """Reload only when the model file's nanosecond modification time changes."""
        try:
            mtime = self.model_path.stat().st_mtime_ns
        except FileNotFoundError:
            self._model = None
            self._metadata = {}
            self._last_loaded_mtime = None
            LOGGER.warning("Model belum tersedia: %s", self.model_path)
            return
        if not force_reload and self._model is not None and self._last_loaded_mtime == mtime:
            return
        try:
            with self.model_path.open("rb") as source:
                raw_payload = pickle.load(source)
            if isinstance(raw_payload, dict):
                meta = raw_payload.get("metadata")
                self._metadata = dict(meta) if isinstance(meta, dict) else {}
                model = raw_payload.get(self.model_key)
            elif self.model_key != "risk":
                model = None
                self._metadata = {}
            else:
                model = raw_payload
                self._metadata = {}
            if model is not None and (not isinstance(model, Pipeline) or not hasattr(model, "predict_proba")):
                raise ValueError("Artefak model bukan pipeline klasifikasi yang valid")
        except (OSError, pickle.UnpicklingError, ValueError, AttributeError, ImportError) as error:
            LOGGER.error("Gagal memuat model %s: %s", self.model_path, error)
            self._model = None
            self._metadata = {}
            self._last_loaded_mtime = None
            return
        self._model = model
        self._last_loaded_mtime = mtime
        LOGGER.info("Model dimuat: %s", self.model_path)

    @property
    def is_ready(self) -> bool:
        self.load_model()
        return self._model is not None

    @property
    def metadata(self) -> dict[str, Any]:
        self.load_model()
        return dict(self._metadata)

    @property
    def model(self) -> Pipeline:
        return self._ready_model()

    @staticmethod
    def _normalize(texts: str | list[str]) -> list[str]:
        values = [texts] if isinstance(texts, str) else list(texts)
        if any(not isinstance(value, str) or not value.strip() for value in values):
            raise ValueError("Semua teks prediksi harus berupa string non-kosong")
        return values

    def _ready_model(self) -> Pipeline:
        self.load_model()
        if self._model is None:
            raise RuntimeError(f"Model belum siap: {self.model_path}")
        return self._model

    def predict(self, texts: str | list[str]) -> list[str]:
        values = self._normalize(texts)
        model = self._ready_model()
        return [str(label) for label in model.predict(values)] if values else []

    def predict_with_confidence(self, texts: str | list[str]) -> list[Prediction]:
        values = self._normalize(texts)
        model = self._ready_model()
        if not values:
            return []
        probabilities = model.predict_proba(values)
        classes = [str(label) for label in model.classes_]
        results: list[Prediction] = []
        for text, row in zip(values, probabilities, strict=True):
            scores = {label: float(score) for label, score in zip(classes, row, strict=True)}
            label = max(scores, key=scores.__getitem__)
            results.append({"text": text, "predicted_label": label, "confidence": round(scores[label], 4), "all_probabilities": scores})
        return results

    def filter_by_label(self, texts: list[str], target_label: str) -> list[str]:
        if not isinstance(target_label, str) or not target_label.strip():
            raise ValueError("target_label harus berupa string non-kosong")
        return [text for text, label in zip(texts, self.predict(texts), strict=True) if label == target_label]
