"""
Universal Document Ingestion & Mainbrain Generator.
Membaca dokumen mentah (PDF, DOCX, JSON, MD, TXT, CSV) di ai/data/raw_references/,
membersihkan teks, mengekstrak ringkasan/fakta penting, dan menghasilkan
output file Markdown (.md) di ai/data/mainbrain/context_embeddings/.
"""

from __future__ import annotations

import csv
import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple

LOGGER = logging.getLogger(__name__)

# Direktori target
DATA_DIR = Path(__file__).resolve().parents[1] / "data"
RAW_DIR = DATA_DIR / "raw_references"
MAINBRAIN_DIR = DATA_DIR / "mainbrain" / "context_embeddings"


def ensure_mainbrain_dir() -> Path:
    """Memastikan folder konteks mainbrain tersedia."""
    MAINBRAIN_DIR.mkdir(parents=True, exist_ok=True)
    return MAINBRAIN_DIR


def sanitize_filename(name: str) -> str:
    """Membersihkan nama file agar aman digunakan di sistem operasi."""
    clean = re.sub(r"[^\w\-_.]", "_", name)
    return clean.strip("._")


def extract_text_from_pdf(file_path: Path) -> str:
    """Ekstraksi teks PDF hanya bila parser tersedia."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(file_path))
        pages_text: List[str] = []
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            if page_text.strip():
                pages_text.append(f"### Bagian Halaman {i + 1}\n{page_text.strip()}")
        return "\n\n".join(pages_text)
    except ImportError:
        LOGGER.warning("Library 'pypdf' belum terpasang; PDF %s dilewati", file_path.name)
        return ""
    except Exception as err:
        LOGGER.error("Gagal membaca file PDF %s: %s", file_path.name, err)
        return ""


def extract_text_from_docx(file_path: Path) -> str:
    """Ekstraksi teks dari file Word DOCX."""
    try:
        import docx
        doc = docx.Document(str(file_path))
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        return "\n\n".join(paragraphs)
    except ImportError:
        LOGGER.warning("Library 'python-docx' belum terpasang untuk membaca %s", file_path.name)
        return f"[Perlu library python-docx untuk membaca {file_path.name}]"
    except Exception as err:
        LOGGER.error("Gagal membaca file DOCX %s: %s", file_path.name, err)
        return f"[Error mengekstrak DOCX {file_path.name}: {err}]"


def extract_text_from_json(file_path: Path) -> str:
    """Ekstraksi teks dari file JSON menjadi format Markdown terstruktur."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return json_to_markdown(data)
    except Exception as err:
        LOGGER.error("Gagal membaca file JSON %s: %s", file_path.name, err)
        return f"[Error parsing JSON {file_path.name}: {err}]"


def json_to_markdown(data: Any, depth: int = 2) -> str:
    """Konversi rekursif JSON ke Markdown heading & bullet list."""
    prefix = "#" * min(depth, 5)
    lines: List[str] = []
    if isinstance(data, dict):
        for key, val in data.items():
            readable_key = str(key).replace("_", " ").title()
            if isinstance(val, (dict, list)):
                lines.append(f"{prefix} {readable_key}\n")
                lines.append(json_to_markdown(val, depth + 1))
            else:
                lines.append(f"- **{readable_key}**: {val}")
    elif isinstance(data, list):
        for i, item in enumerate(data):
            if isinstance(item, (dict, list)):
                lines.append(f"{prefix} Item #{i + 1}\n")
                lines.append(json_to_markdown(item, depth + 1))
            else:
                lines.append(f"- {item}")
    else:
        lines.append(str(data))
    return "\n".join(lines)


def extract_text_from_csv(file_path: Path) -> str:
    """Ekstraksi teks dari file tabel CSV menjadi tabel Markdown."""
    try:
        lines: List[str] = []
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.reader(f)
            rows = list(reader)
        if not rows:
            return "_File CSV kosong_"
        headers = rows[0]
        lines.append("| " + " | ".join(headers) + " |")
        lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
        for row in rows[1:101]:  # Batasi 100 baris pertama untuk efisiensi knowledge
            # Pad or truncate row to header length
            padded = (row + [""] * len(headers))[:len(headers)]
            cleaned = [c.replace("|", "/").strip() for c in padded]
            lines.append("| " + " | ".join(cleaned) + " |")
        if len(rows) > 101:
            lines.append(f"\n_... dan {len(rows) - 101} baris data lainnya terdaftar di sistem._")
        return "\n".join(lines)
    except Exception as err:
        LOGGER.error("Gagal membaca file CSV %s: %s", file_path.name, err)
        return f"[Error parsing CSV {file_path.name}: {err}]"


def extract_text_from_plain(file_path: Path) -> str:
    """Membaca file Markdown (.md) atau Text (.txt)."""
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read().strip()
    except Exception as err:
        LOGGER.error("Gagal membaca teks %s: %s", file_path.name, err)
        return f"[Error membaca teks {file_path.name}: {err}]"


def process_single_file(file_path: Path) -> Tuple[bool, Path | None, str]:
    """
    Memproses 1 file referensi dan mengekspor Markdown ke context_embeddings/.
    """
    ext = file_path.suffix.lower()
    content = ""
    doc_type = "Dokumen Umum"

    if ext == ".pdf":
        doc_type = "Dokumen PDF"
        content = extract_text_from_pdf(file_path)
    elif ext in [".docx", ".doc"]:
        doc_type = "Dokumen Word (DOCX)"
        content = extract_text_from_docx(file_path)
    elif ext == ".json":
        doc_type = "Dataset JSON / Knowledge Base"
        content = extract_text_from_json(file_path)
    elif ext == ".csv":
        doc_type = "Tabel Data CSV / Laporan Analitik"
        content = extract_text_from_csv(file_path)
    elif ext in [".md", ".markdown"]:
        doc_type = "Dokumen Markdown"
        content = extract_text_from_plain(file_path)
    elif ext == ".txt":
        doc_type = "Catatan Teks (TXT)"
        content = extract_text_from_plain(file_path)
    else:
        return False, None, f"Format tidak didukung: {ext}"

    if not content or not content.strip():
        return False, None, "Teks dokumen tidak dapat diekstraksi"

    # Buat header metadata standar Mainbrain
    stem_clean = sanitize_filename(file_path.stem)
    output_filename = f"{stem_clean}.md"
    output_path = MAINBRAIN_DIR / output_filename

    md_document = f"""# Brain Knowledge: {file_path.stem.replace('_', ' ').title()}
> **Sumber Dokumen**: `{file_path.name}`
> **Tipe Dokumen**: {doc_type}
> **Ukuran Asli**: {file_path.stat().st_size:,} bytes
> **Status Ingestion**: Terverifikasi dan siap digunakan oleh Daisuki AI RAG

---

## Isi & Fakta Pengetahuan Terstruktur

{content}

---
*Catatan Sistem: File ini digenerate secara otomatis oleh pipeline training Daisuki Mainbrain. Jangan mengubah format header.*
"""

    try:
        with open(output_path, "w", encoding="utf-8") as out:
            out.write(md_document.strip() + "\n")
        return True, output_path, "SUKSES"
    except Exception as err:
        LOGGER.error("Gagal menulis mainbrain output %s: %s", output_filename, err)
        return False, None, str(err)


def scan_and_generate_mainbrain() -> Dict[str, Any]:
    """
    Memindai subfolder raw_references, mengekstrak teks, dan menulis Markdown.
    """
    ensure_mainbrain_dir()
    if not RAW_DIR.exists():
        LOGGER.warning("Folder ai/data/raw_references belum dibuat.")
        return {"total": 0, "success": 0, "failed": 0, "files": []}

    candidate_files = [
        f for folder in ("pdf", "docs", "csv")
        for f in (RAW_DIR / folder).glob("*")
        if f.is_file() and not f.name.startswith(".") and f.name.lower() != "readme.md"
    ]

    total = len(candidate_files)
    success = 0
    failed = 0
    results: List[Dict[str, str]] = []

    for file_path in candidate_files:
        ok, out_path, reason = process_single_file(file_path)
        if ok and out_path:
            success += 1
            results.append({"source": file_path.name, "output": out_path.name, "status": "ok"})
        else:
            failed += 1
            results.append({"source": file_path.name, "output": "", "status": f"failed: {reason}"})

    LOGGER.info("Mainbrain Ingestion selesai: %d berhasil, %d gagal dari total %d file.", success, failed, total)
    return {
        "total": total,
        "success": success,
        "failed": failed,
        "results": results,
    }


def collect_mainbrain_knowledge_snippets(max_tokens: int = 15000) -> str:
    """
    Mengumpulkan file Markdown publik dari ai/data/mainbrain/context_embeddings/
    menjadi satu konteks ringkasan terstruktur untuk diinjeksikan ke prompt RAG.
    """
    ensure_mainbrain_dir()
    policy_path = DATA_DIR / "mainbrain" / "corporate_knowledge" / "rag_policy.json"
    with policy_path.open(encoding="utf-8") as source:
        policy = json.load(source)
    approved = set(policy["approved_sources"])
    blocked = [re.compile(pattern, re.IGNORECASE) for pattern in policy["blocked_content_patterns"]]
    md_files = sorted(file for file in MAINBRAIN_DIR.glob("*.public.md") if file.name in approved)[: policy["max_documents"]]
    if not md_files:
        return ""

    snippets: List[str] = []
    for md_path in md_files:
        try:
            with open(md_path, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if any(pattern.search(content) for pattern in blocked):
                    continue
                # Batasi per file jika terlalu besar agar prompt tetap hemat token
                if len(content) > 3000:
                    content = content[:3000] + "\n\n_... [Rincian dokumen dipotong untuk optimasi token]_"
                snippets.append(content)
        except Exception:
            continue

    joined = "\n\n================================================================================\n\n".join(snippets)
    return joined[:max_tokens]
