"""Persist searchable public document vectors in the model bundle."""

import hashlib
import json
import re
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from doc_loader import (RAW_DIR, extract_text_from_docx,
                        extract_text_from_json, extract_text_from_pdf, extract_text_from_plain)

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def build_knowledge_index(data_dir: Path = DATA_DIR, shared_summaries: list[dict] | None = None) -> dict:
    policy = json.loads((data_dir / "mainbrain/corporate_knowledge/rag_policy.json").read_text(encoding="utf-8"))
    blocked = [re.compile(pattern, re.I) for pattern in policy["blocked_content_patterns"]]
    documents = []
    for name in policy["approved_sources"][:policy["max_documents"]]:
        if Path(name).name != name or not name.endswith(".public.md"):
            continue
        path = data_dir / "mainbrain/context_embeddings" / name
        if not path.is_file():
            continue
        content = path.read_text(encoding="utf-8")
        if any(pattern.search(content) for pattern in blocked):
            continue
        version = hashlib.sha256(content.encode()).hexdigest()[:12]
        content = content[:policy["max_chars_per_document"]]
        sections = [s.strip() for s in re.split(r"\n---\n|\n(?=#{1,3}\s)", content) if len(s.strip()) >= 40]
        chunks = sections if len(sections) > 1 else re.split(r"\n\s*\n", content)
        for paragraph in chunks:
            for offset in range(0, len(paragraph), 1300):
                excerpt = paragraph[offset:offset + 1500].strip()
                if len(excerpt) >= 40:
                    documents.append({"source": name, "version": version, "excerpt": excerpt})
    for approved in shared_summaries or []:
        raw_source = approved.get("raw_source", "")
        excerpt = approved.get("excerpt", "").strip()
        source_sha256 = approved.get("source_sha256", "")
        raw_path = (data_dir / "raw_references" / raw_source).resolve()
        raw_root = (data_dir / "raw_references").resolve()
        if (not raw_source or not raw_path.is_relative_to(raw_root)
                or not raw_path.is_file() or len(excerpt) < 40
                or source_sha256 != hashlib.sha256(raw_path.read_bytes()).hexdigest()
                or any(pattern.search(excerpt) for pattern in blocked)):
            continue
        version = hashlib.sha256(excerpt.encode()).hexdigest()[:12]
        documents.append({"source": raw_source, "version": version, "excerpt": excerpt,
                          "visibility": "mitra", "kind": "approved_summary",
                          "aliases": approved.get("aliases", [])})
    if not documents:
        return {"documents": [], "policy_version": policy["version"]}
    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=30000)
    vectors = vectorizer.fit_transform([item["excerpt"] for item in documents])
    return {"documents": documents, "vectorizer": vectorizer, "vectors": vectors,
            "policy_version": policy["version"], "max_excerpts": policy["max_excerpts"]}


def search_knowledge(index: dict, query: str) -> list[dict]:
    if not index.get("documents") or "vectorizer" not in index:
        return []
    normalized_query = re.sub(r"[^\w\s]+", " ", query).strip()
    if not normalized_query:
        return []
    query_vector = index["vectorizer"].transform([normalized_query])
    scores = (index["vectors"] @ query_vector.T).toarray().ravel()
    ranked = sorted(range(len(scores)), key=lambda i: float(scores[i]), reverse=True)
    return [dict(index["documents"][i], score=round(float(scores[i]), 4))
            for i in ranked[:index.get("max_excerpts", 3)] if scores[i] >= 0.08]


def search_raw_reference(index: dict, query: str, max_excerpts: int = 4) -> list[dict]:
    """Search private reference vectors for the authenticated admin route only."""
    if not index.get("documents") or "vectorizer" not in index:
        return []
    query_terms = set(re.findall(r"[\w]{3,}", query.casefold())) - {"siapa", "itu", "tentang", "dokumen", "file", "pdf", "dari"}
    scores = (index["vectors"] @ index["vectorizer"].transform([query]).T).toarray().ravel()
    ranked = []
    for i, item in enumerate(index["documents"]):
        source_terms = set(re.findall(r"[\w]{3,}", Path(item["source"]).stem.casefold())) - {"pdf", "doc", "docs", "cv"}
        title_match = bool(query_terms & source_terms)
        score = float(scores[i]) + (0.5 if title_match else 0)
        if score >= (0.08 if title_match else 0.15):
            ranked.append((score, i))
    ranked.sort(reverse=True)
    return [dict(index["documents"][i], score=round(score, 4)) for score, i in ranked[:max_excerpts]]


RAW_FORMATS = {".pdf", ".docx", ".md", ".markdown", ".txt", ".json", ".csv"}


def list_raw_references(raw_dir: Path = RAW_DIR) -> list[Path]:
    return sorted(path for path in raw_dir.rglob("*")
                  if path.is_file() and path.suffix.lower() in RAW_FORMATS
                  and path.name.lower() != "readme.md" and not any(part.startswith(".") for part in path.relative_to(raw_dir).parts))


def build_raw_reference_index(paths: list[Path], raw_dir: Path = RAW_DIR) -> dict:
    """Index only selected raw files as private numeric vectors."""
    documents = []
    unreadable = []
    extractors = {
        ".pdf": extract_text_from_pdf, ".docx": extract_text_from_docx,
        ".json": extract_text_from_json,
        ".csv": lambda path: path.read_text(encoding="utf-8-sig", errors="replace"),
        ".md": extract_text_from_plain, ".markdown": extract_text_from_plain,
        ".txt": extract_text_from_plain,
    }
    for path in paths:
        if path.suffix.lower() not in RAW_FORMATS or not path.is_file() or not path.resolve().is_relative_to(raw_dir.resolve()):
            raise ValueError(f"Referensi tidak valid: {path}")
        content = extractors[path.suffix.lower()](path)
        if not content.strip() or content.startswith(("[Error ", "[Perlu library")):
            unreadable.append(path.name)
            continue
        for paragraph in re.split(r"\n\s*\n", content):
            for offset in range(0, len(paragraph), 1000):
                excerpt = paragraph[offset:offset + 1200].strip()
                if len(excerpt) >= 40:
                    documents.append({"source": path.relative_to(raw_dir).as_posix(), "excerpt": excerpt, "visibility": "private"})
    if unreadable:
        raise ValueError(f"Teks referensi tidak dapat diekstrak: {', '.join(unreadable)}. PDF scan memerlukan OCR.")
    if paths and not documents:
        raise ValueError("Tidak ada teks referensi yang cukup panjang untuk diindeks")
    if not documents:
        return {"documents": []}
    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=30000)
    vectors = vectorizer.fit_transform([item["excerpt"] for item in documents])
    return {"documents": documents, "vectorizer": vectorizer, "vectors": vectors}


def build_raw_pdf_index() -> dict:
    return build_raw_reference_index(sorted((RAW_DIR / "pdf").glob("*.pdf")))
