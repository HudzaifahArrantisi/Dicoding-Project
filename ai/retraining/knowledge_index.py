"""Persist searchable public document vectors in the model bundle."""

import hashlib
import json
import re
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from doc_loader import RAW_DIR, extract_text_from_pdf

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def build_knowledge_index(data_dir: Path = DATA_DIR) -> dict:
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
    if not documents:
        return {"documents": [], "policy_version": policy["version"]}
    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=30000)
    vectors = vectorizer.fit_transform([item["excerpt"] for item in documents])
    return {"documents": documents, "vectorizer": vectorizer, "vectors": vectors,
            "policy_version": policy["version"], "max_excerpts": policy["max_excerpts"]}


def search_knowledge(index: dict, query: str) -> list[dict]:
    if not index.get("documents") or "vectorizer" not in index:
        return []
    query_vector = index["vectorizer"].transform([query])
    scores = (index["vectors"] @ query_vector.T).toarray().ravel()
    ranked = sorted(range(len(scores)), key=lambda i: float(scores[i]), reverse=True)
    return [dict(index["documents"][i], score=round(float(scores[i]), 4))
            for i in ranked[:index.get("max_excerpts", 3)] if scores[i] >= 0.08]


def build_raw_pdf_index() -> dict:
    """Store all readable PDFs as private vectors; public access uses the approved index."""
    documents = []
    paths = sorted((RAW_DIR / "pdf").glob("*.pdf"))
    for path in paths:
        content = extract_text_from_pdf(path)
        for paragraph in re.split(r"\n\s*\n", content):
            for offset in range(0, len(paragraph), 1000):
                excerpt = paragraph[offset:offset + 1200].strip()
                if len(excerpt) >= 40:
                    documents.append({"source": path.name, "excerpt": excerpt, "visibility": "private"})
    if paths and not documents:
        raise ValueError("Tidak ada teks PDF yang berhasil diekstrak; pasang pypdf atau lakukan OCR sebelum training")
    if not documents:
        return {"documents": []}
    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=30000)
    vectors = vectorizer.fit_transform([item["excerpt"] for item in documents])
    return {"documents": documents, "vectorizer": vectorizer, "vectors": vectors}
