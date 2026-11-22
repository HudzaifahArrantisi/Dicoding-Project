"""Export the trusted Daisuki classifiers to a JSON format readable by Workers."""

from __future__ import annotations

import argparse
import json
import pickle
from pathlib import Path

from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline


def export_pipeline(pipeline: Pipeline) -> dict:
    vectorizer = pipeline.named_steps["vectorizer"]
    classifier = pipeline.named_steps["classifier"]
    if not isinstance(vectorizer, CountVectorizer) or not isinstance(classifier, MultinomialNB):
        raise TypeError("Only CountVectorizer + MultinomialNB pipelines are supported")
    if vectorizer.ngram_range != (1, 2) or vectorizer.binary or vectorizer.analyzer != "word":
        raise ValueError("Unsupported vectorizer configuration")
    return {
        "classes": classifier.classes_.tolist(),
        "class_log_prior": classifier.class_log_prior_.tolist(),
        "feature_log_prob": classifier.feature_log_prob_.tolist(),
        "vocabulary": {key: int(value) for key, value in vectorizer.vocabulary_.items()},
    }


def export_retrieval(index: dict) -> dict | None:
    if not index.get("documents"):
        return None
    vectorizer = index["vectorizer"]
    if vectorizer.analyzer != "char_wb" or vectorizer.ngram_range != (3, 5) or vectorizer.norm != "l2":
        raise ValueError("Unsupported retrieval vectorizer configuration")
    matrix = index["vectors"].tocsr()
    rows = []
    for row in range(matrix.shape[0]):
        start, end = matrix.indptr[row], matrix.indptr[row + 1]
        rows.append([[int(column), float(weight)] for column, weight in zip(
            matrix.indices[start:end], matrix.data[start:end], strict=True)])
    return {
        "documents": index["documents"],
        "vocabulary": {key: int(value) for key, value in vectorizer.vocabulary_.items()},
        "idf": vectorizer.idf_.tolist(),
        "vectors": rows,
        "max_excerpts": index.get("max_excerpts", 3),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    with args.source.open("rb") as source:
        bundle = pickle.load(source)
    if not isinstance(bundle, dict) or "intent" not in bundle:
        raise ValueError("Invalid Daisuki model bundle")
    exported = {
        "format_version": 1,
        "metadata": bundle.get("metadata") or {},
        "intent": export_pipeline(bundle["intent"]),
        "risk": export_pipeline(bundle["risk"]) if "risk" in bundle else None,
        "retrieval": export_retrieval(bundle.get("retrieval") or {}),
        "raw_retrieval": export_retrieval(bundle.get("raw_pdf_retrieval") or {}),
        "analysis_retrieval": export_retrieval(bundle.get("analysis_retrieval") or {}),
    }
    args.destination.parent.mkdir(parents=True, exist_ok=True)
    args.destination.write_text(json.dumps(exported, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    main()
