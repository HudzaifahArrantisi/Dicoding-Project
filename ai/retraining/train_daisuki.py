"""Manual training for private analysis, approved references, or both."""

from __future__ import annotations

import argparse
import hashlib
import json
import pickle
import re
import uuid
from pathlib import Path

from csv_handoff import load_samples
from analysis_index import build_analysis_index
from doc_loader import RAW_DIR, MAINBRAIN_DIR, process_single_file, sanitize_filename
from knowledge_index import build_knowledge_index, build_raw_pdf_index
from source import build_intent_samples
from train import IDENTITY_BIO, MODEL_OUTPUT_FILE as LEGACY_MODEL, save_model_safely, train_pipeline

ROOT = Path(__file__).resolve().parents[2]
MODEL_OUTPUT_FILE = ROOT / "ai" / "data" / "private" / "manual" / "daisuki.pkl"
TEMP_MODEL_FILE = MODEL_OUTPUT_FILE.with_name("daisuki.pkl.tmp")
RUNS = ROOT / "data-science" / "reports" / "runs"
POLICY = ROOT / "ai" / "data" / "mainbrain" / "corporate_knowledge" / "rag_policy.json"
CATEGORIES = ("category_products.json", "category_partners.json", "category_regions.json", "category_reporting.json")
ARTIFACTS = (*CATEGORIES, "cleaned_inventory_summary.csv", "weekly_analytics_summary.json", "weekly_analytics_report.md")


def analysis_source(run_id: str | None) -> Path:
    if run_id:
        run_id = str(uuid.UUID(run_id))
    candidates = [RUNS / run_id] if run_id else sorted(
        (path for path in RUNS.iterdir() if path.is_dir()),
        key=lambda path: path.stat().st_mtime, reverse=True,
    ) if RUNS.is_dir() else []
    for folder in candidates:
        try:
            manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
            if manifest.get("run_id") != folder.name or manifest.get("schema_version") != 1:
                continue
            for name in ARTIFACTS:
                data = (folder / name).read_bytes()
                if manifest.get("sha256", {}).get(name) != hashlib.sha256(data).hexdigest():
                    raise ValueError(f"Checksum tidak cocok: {name}")
            for name in CATEGORIES:
                category = json.loads((folder / name).read_text(encoding="utf-8"))
                if not isinstance(category, (dict, list)):
                    raise ValueError(f"Kategori kosong atau salah format: {name}")
            return folder
        except (OSError, ValueError, KeyError, TypeError) as error:
            if run_id:
                raise ValueError(f"Run analisis {run_id} tidak valid: {error}") from error
    raise ValueError("Tidak ada run Data Science valid dengan empat kategori JSON. Jalankan analisis terlebih dahulu.")


def publish_references(names: list[str]) -> list[str]:
    policy = json.loads(POLICY.read_text(encoding="utf-8"))
    blocked = [re.compile(pattern, re.I) for pattern in policy["blocked_content_patterns"]]
    selected = []
    for name in names:
        if Path(name).name != name or not name.lower().endswith((".pdf", ".docx", ".md", ".txt")):
            raise ValueError(f"Nama atau format referensi tidak diizinkan: {name}")
        matches = [folder / name for folder in (RAW_DIR / "pdf", RAW_DIR / "docs") if (folder / name).is_file()]
        if len(matches) != 1:
            raise ValueError(f"Referensi harus ada tepat di satu folder pdf/docs: {name}")
        ok, extracted, reason = process_single_file(matches[0])
        if not ok or extracted is None:
            raise ValueError(f"Ekstraksi {name} gagal: {reason}")
        content = extracted.read_text(encoding="utf-8")
        if any(pattern.search(content) for pattern in blocked):
            raise ValueError(f"Referensi {name} mengandung pola privat; tinjau dan sunting dokumen publik secara manual")
        public_name = f"{sanitize_filename(matches[0].stem)}.public.md"
        public_path = MAINBRAIN_DIR / public_name
        if public_path.exists() and f"`{name}`" not in public_path.read_text(encoding="utf-8"):
            raise ValueError(f"Nama keluaran {public_name} sudah dipakai dokumen lain")
        selected.append((public_name, content))
    approved = list(policy["approved_sources"])
    if len({name for name, _ in selected}) != len(selected):
        raise ValueError("Referensi berbeda menghasilkan nama dokumen publik yang sama")
    if len(set(approved) | {name for name, _ in selected}) > policy["max_documents"]:
        raise ValueError("Jumlah sumber publik melebihi max_documents dalam rag_policy.json")
    for name, content in selected:
        (MAINBRAIN_DIR / name).write_text(content, encoding="utf-8")
        if name not in approved:
            approved.append(name)
    if selected:
        policy["approved_sources"] = approved
        POLICY.write_text(json.dumps(policy, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return [name for name, _ in selected]


def train(mode: int, run_id: str | None, public_sources: list[str]) -> None:
    if mode == 1 and public_sources:
        raise ValueError("--public-source hanya berlaku untuk opsi 2 atau 3")
    bundle = {}
    previous_model = MODEL_OUTPUT_FILE if MODEL_OUTPUT_FILE.is_file() else LEGACY_MODEL
    if previous_model.is_file():
        with previous_model.open("rb") as source:
            bundle = pickle.load(source)
        if not isinstance(bundle, dict):
            raise ValueError("Format daisuki.pkl lama tidak didukung")
    bundle = dict(bundle)
    texts, labels = build_intent_samples()
    bundle["intent"] = train_pipeline(texts, labels, fit_prior=False)
    metadata = dict(bundle.get("metadata") or {})
    metadata.update(name="Daisuki AI Assistant", identity_bio=IDENTITY_BIO)
    bundle["metadata"] = metadata
    if mode in (1, 3):
        folder = analysis_source(run_id)
        samples, risks, _ = load_samples(folder / "cleaned_inventory_summary.csv")
        if len(set(risks)) >= 2:
            bundle["risk"] = train_pipeline(samples, risks)
        elif "risk" not in bundle:
            raise ValueError("Laporan hanya memiliki satu kelas risiko dan belum ada model risiko lama")
        bundle["mainbrain_meta"] = {**dict(bundle.get("mainbrain_meta") or {}),
                                    "source_run_id": folder.name, "training_input_source": "data_science_run"}
        bundle["analysis_retrieval"] = build_analysis_index(folder)
        print(f"Analisis privat: {folder.name}; empat kategori tervalidasi; {len(samples)} pasangan mitra-produk")
    if mode in (2, 3):
        published = publish_references(public_sources)
        bundle["retrieval"] = build_knowledge_index()
        bundle["raw_pdf_retrieval"] = build_raw_pdf_index()
        print(f"Referensi publik baru: {', '.join(published) if published else 'tidak ada'}")
        print(f"Cuplikan retrieval: {len(bundle['retrieval']['documents'])}")
        print(f"Cuplikan PDF privat dalam biner: {len(bundle['raw_pdf_retrieval']['documents'])}")
    MODEL_OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    save_model_safely(bundle, MODEL_OUTPUT_FILE, TEMP_MODEL_FILE)
    print(f"Model tersimpan: {MODEL_OUTPUT_FILE}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", type=int, choices=(1, 2, 3), help="1=analisis, 2=referensi, 3=keduanya")
    parser.add_argument("--run-id", help="ID run Data Science; default run valid terbaru")
    parser.add_argument("--public-source", action="append", default=[], metavar="FILE",
                        help="Nama PDF/DOCX/MD/TXT di raw_references/pdf atau docs yang disetujui untuk chatbot mitra")
    args = parser.parse_args()
    mode = args.mode or int(input("Pilih training (1=analisis, 2=referensi, 3=keduanya): ").strip())
    if mode not in (1, 2, 3):
        parser.error("Pilihan harus 1, 2, atau 3")
    try:
        train(mode, args.run_id, args.public_source)
    except (OSError, ValueError) as error:
        parser.exit(1, f"Training gagal: {error}\n")


if __name__ == "__main__":
    main()
