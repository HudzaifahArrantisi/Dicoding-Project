"""Train Daisuki from analysis runs, raw references, or the weekly API pipeline."""

from __future__ import annotations

import argparse
import logging
import json
import os
import pickle
import re
import sys
import uuid
from pathlib import Path
from typing import Any
import hashlib

from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from source import build_intent_samples
from doc_loader import RAW_DIR, MAINBRAIN_DIR, collect_mainbrain_knowledge_snippets, process_single_file, sanitize_filename, scan_and_generate_mainbrain
from knowledge_index import build_knowledge_index, build_raw_reference_index, list_raw_references
from analysis_index import build_analysis_index
from csv_handoff import INPUT as CSV_HANDOFF, is_fresh_handoff, load_samples, prepare_handoff

AI_ROOT = str(Path(__file__).resolve().parents[1])
if AI_ROOT not in sys.path:
    sys.path.insert(0, AI_ROOT)
from jobs.run_context import run_id, source_file, stage_dir, verify_manifest

LOGGER = logging.getLogger(__name__)
BASE_DIR = Path(__file__).resolve().parent
MODEL_OUTPUT_FILE = (stage_dir() / "daisuki.pkl") if run_id() else BASE_DIR.parent / "data" / "mainbrain" / "models" / "daisuki.pkl"
TEMP_MODEL_FILE = MODEL_OUTPUT_FILE.with_name("daisuki.pkl.tmp")
MANUAL_MODEL_FILE = BASE_DIR.parent / "data" / "private" / "manual" / "daisuki.pkl"
LEGACY_MODEL_FILE = BASE_DIR.parent / "data" / "mainbrain" / "models" / "daisuki.pkl"
RUNS = BASE_DIR.parents[1] / "data-science" / "reports" / "runs"
CORPORATE_DIR = BASE_DIR.parent / "data" / "mainbrain" / "corporate_knowledge"
POLICY = CORPORATE_DIR / "rag_policy.json"
CATEGORIES = ("category_products.json", "category_partners.json", "category_regions.json", "category_reporting.json")
ARTIFACTS = (*CATEGORIES, "cleaned_inventory_summary.csv", "weekly_analytics_summary.json", "weekly_analytics_report.md")
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


def analysis_source(selected_run_id: str | None) -> Path:
    if selected_run_id:
        selected_run_id = str(uuid.UUID(selected_run_id))
    candidates = [RUNS / selected_run_id] if selected_run_id else sorted(
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
            if selected_run_id:
                raise ValueError(f"Run analisis {selected_run_id} tidak valid: {error}") from error
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


def select_raw_reference(name: str, paths: list[Path]) -> Path:
    if Path(name).name != name or not name.strip():
        raise ValueError("Masukkan nama file saja, misalnya nama-file.pdf")
    matches = [path for path in paths if path.name.casefold() == name.casefold()]
    if len(matches) != 1:
        raise ValueError(f"File {name} harus ada tepat satu kali di raw_references; ditemukan {len(matches)}")
    return matches[0]


def select_shared_summaries(previous: list[dict], specifications: list[str], paths: list[Path], revoked_names: list[str] | None = None) -> list[dict]:
    by_name: dict[str, list[Path]] = {}
    for path in paths:
        by_name.setdefault(path.name.casefold(), []).append(path)
    selected_sources = {path.relative_to(RAW_DIR).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}
    summaries = {item["raw_source"]: item for item in previous
                 if isinstance(item, dict) and item.get("source_sha256") == selected_sources.get(item.get("raw_source"))}
    for name in revoked_names or []:
        matches = by_name.get(name.strip().casefold(), [])
        if len(matches) != 1:
            raise ValueError(f"File untuk mencabut akses Mitra tidak ditemukan atau ambigu: {name}")
        summaries.pop(matches[0].relative_to(RAW_DIR).as_posix(), None)
    policy = json.loads(POLICY.read_text(encoding="utf-8"))
    blocked = [re.compile(pattern, re.I) for pattern in policy["blocked_content_patterns"]]
    for specification in specifications:
        name, separator, excerpt = specification.partition("=")
        matches = by_name.get(name.strip().casefold(), [])
        excerpt = excerpt.strip()
        if not separator or len(matches) != 1 or len(excerpt) < 40:
            raise ValueError("--mitra-summary harus berbentuk 'nama-file.pdf=ringkasan minimal 40 karakter' untuk file yang dilatih")
        path = matches[0]
        if any(pattern.search(excerpt) for pattern in blocked):
            raise ValueError(f"Ringkasan {path.name} mengandung pola data privat; sunting sebelum dibagikan ke Mitra")
        terms = [term.casefold() for term in re.findall(r"[\w]+", path.stem)
                 if len(term) >= 3 and term.casefold() not in {"artikel", "dokumen", "file", "pdf", "resume", "referensi", "refrensi"}]
        aliases = list(dict.fromkeys([" ".join(terms), *terms])) if terms else []
        raw_source = path.relative_to(RAW_DIR).as_posix()
        summaries[raw_source] = {"raw_source": raw_source, "source_sha256": selected_sources[raw_source],
                                 "excerpt": excerpt, "aliases": aliases}
    return list(summaries.values())


def train_manual(mode: int, selected_run_id: str | None, public_sources: list[str], source_file_name: str | None = None,
                 mitra_summaries: list[str] | None = None, revoked_mitra_sources: list[str] | None = None) -> None:
    if mode == 1 and (public_sources or mitra_summaries or revoked_mitra_sources):
        raise ValueError("Pengaturan sumber Mitra hanya berlaku untuk opsi 2 atau 3")
    previous_model = MANUAL_MODEL_FILE if MANUAL_MODEL_FILE.is_file() else LEGACY_MODEL_FILE
    bundle: dict[str, Any] = {}
    if previous_model.is_file():
        with previous_model.open("rb") as source:
            loaded = pickle.load(source)
        if not isinstance(loaded, dict):
            raise ValueError("Format daisuki.pkl lama tidak didukung")
        bundle = dict(loaded)
    texts, labels = build_intent_samples()
    bundle["intent"] = train_pipeline(texts, labels, fit_prior=False)
    metadata = dict(bundle.get("metadata") or {})
    metadata.update(name="Daisuki AI Assistant", identity_bio=IDENTITY_BIO)
    bundle["metadata"] = metadata
    if mode == 1:
        folder = analysis_source(selected_run_id)
        samples, risks, _ = load_samples(folder / "cleaned_inventory_summary.csv")
        if len(set(risks)) >= 2:
            bundle["risk"] = train_pipeline(samples, risks)
        elif "risk" not in bundle:
            raise ValueError("Laporan hanya memiliki satu kelas risiko dan belum ada model risiko lama")
        bundle["mainbrain_meta"] = {**dict(bundle.get("mainbrain_meta") or {}),
                                    "source_run_id": folder.name, "training_input_source": "data_science_run"}
        bundle["analysis_retrieval"] = build_analysis_index(folder, bundle.get("analysis_retrieval"))
        print(f"Analisis privat: {folder.name}; empat kategori tervalidasi; {len(samples)} pasangan mitra-produk")
    if mode in (2, 3):
        available = list_raw_references()
        paths = available if mode == 2 else [select_raw_reference(source_file_name or "", available)]
        if not paths:
            raise ValueError("Tidak ada data PDF/DOCX/MD/TXT/JSON/CSV di raw_references")
        if mode == 3 and any(name.casefold() != paths[0].name.casefold() for name in public_sources):
            raise ValueError("Mode 3 hanya boleh menerbitkan file yang sedang dilatih")
        reference_index = build_raw_reference_index(paths)
        published = publish_references(public_sources)
        bundle["shared_summaries"] = select_shared_summaries(bundle.get("shared_summaries", []), mitra_summaries or [], paths, revoked_mitra_sources)
        bundle["retrieval"] = build_knowledge_index(shared_summaries=bundle["shared_summaries"])
        bundle["raw_pdf_retrieval"] = reference_index
        print(f"Referensi publik baru: {', '.join(published) if published else 'tidak ada'}")
        print(f"Cuplikan retrieval: {len(bundle['retrieval']['documents'])}")
        print(f"Berkas mentah terindeks: {len(paths)}; cuplikan privat dalam biner: {len(reference_index['documents'])}")
        print(f"Ringkasan yang dapat dibaca Mitra dalam biner: {len(bundle['shared_summaries'])}")
    MANUAL_MODEL_FILE.parent.mkdir(parents=True, exist_ok=True)
    save_model_safely(bundle, MANUAL_MODEL_FILE, MANUAL_MODEL_FILE.with_name("daisuki.pkl.tmp"))
    print(f"Model tersimpan: {MANUAL_MODEL_FILE}")


def refresh_intent() -> None:
    if not MODEL_OUTPUT_FILE.is_file():
        raise ValueError("daisuki.pkl belum tersedia; jalankan training terlebih dahulu")
    with MODEL_OUTPUT_FILE.open("rb") as source:
        bundle = pickle.load(source)
    if not isinstance(bundle, dict) or "intent" not in bundle:
        raise ValueError("Format daisuki.pkl tidak mendukung pembaruan intent")
    texts, labels = build_intent_samples()
    bundle["intent"] = train_pipeline(texts, labels, fit_prior=False)
    bundle["retrieval"] = build_knowledge_index(shared_summaries=bundle.get("shared_summaries", []))
    metadata = dict(bundle.get("metadata") or {})
    metadata.update(name="Daisuki AI Assistant", identity_bio=IDENTITY_BIO)
    bundle["metadata"] = metadata
    save_model_safely(bundle, MODEL_OUTPUT_FILE, TEMP_MODEL_FILE)
    print(f"Daisuki AI: {len(texts)} contoh intent dan {len(bundle['retrieval']['documents'])} cuplikan retrieval diperbarui; model risiko dipertahankan.")


def run_retraining_loop(training_source: str = "analysis") -> bool:
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
        risk_training_source = "data_science_csv"
        raw_paths = list_raw_references() if training_source == "raw_references" else []
        raw_input_sha256: str | None = None
        if training_source == "raw_references":
            if not raw_paths:
                raise ValueError("Belum ada file referensi mentah di database untuk training")
            texts, labels = [], []
            risk_training_source = "raw_references"
            raw_digest = hashlib.sha256()
            for path in raw_paths:
                raw_digest.update(path.relative_to(RAW_DIR).as_posix().encode("utf-8"))
                raw_digest.update(path.read_bytes())
            raw_input_sha256 = raw_digest.hexdigest()
        intent_texts, intent_labels = build_intent_samples()
        previous_bundle: dict[str, Any] = {}
        if MODEL_OUTPUT_FILE.is_file():
            with MODEL_OUTPUT_FILE.open("rb") as previous_file:
                loaded = pickle.load(previous_file)
            if not isinstance(loaded, dict):
                raise ValueError("Format model sebelumnya tidak didukung")
            previous_bundle = loaded
        bundle: dict[str, Any] = {
            "intent": train_pipeline(intent_texts, intent_labels, fit_prior=False),
            "public_knowledge": collect_mainbrain_knowledge_snippets(),
            "retrieval": build_knowledge_index(shared_summaries=previous_bundle.get("shared_summaries", [])),
            "mainbrain_meta": {
                "total_documents": mainbrain_stats["total"],
                "converted_markdowns": mainbrain_stats["success"],
                "training_input_source": risk_training_source,
                "training_input_samples": len(texts),
                "source_run_id": run_id(),
                "training_input_sha256": raw_input_sha256 if training_source == "raw_references"
                else hashlib.sha256(handoff.read_bytes()).hexdigest(),
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
        for retained in ("analysis_retrieval", "raw_pdf_retrieval", "shared_summaries"):
            if retained in previous_bundle:
                bundle[retained] = previous_bundle[retained]
        if run_id():
            historical = bundle.get("analysis_retrieval")
            for historical_id in filter(None, os.environ.get("DAISUKI_HISTORICAL_RUN_IDS", "").split(",")):
                historical_folder = RUNS / str(uuid.UUID(historical_id))
                historical = build_analysis_index(historical_folder, historical,
                                                  BASE_DIR.parent / "data" / "private" / "runs" / historical_id)
            if training_source == "analysis":
                historical = build_analysis_index(handoff.parent, historical, stage_dir())
            else:
                bundle["raw_pdf_retrieval"] = build_raw_reference_index(raw_paths)
            if historical:
                bundle["analysis_retrieval"] = historical
        if len(set(labels)) >= 2:
            bundle["risk"] = train_pipeline(texts, labels)
            bundle["mainbrain_meta"]["risk_model_source"] = risk_training_source
        elif MODEL_OUTPUT_FILE.exists():
            from filter import DaisukiFilter
            previous = DaisukiFilter(MODEL_OUTPUT_FILE, model_key="risk")
            if previous.is_ready:
                bundle["risk"] = previous.model
                bundle["mainbrain_meta"]["risk_model_source"] = "retained_previous"
        if "risk" not in bundle:
            LOGGER.warning("Data stok hanya satu kelas; model intent tetap dilatih, prediksi risiko belum tersedia")
        LOGGER.info("Training intent dari %d frasa; sumber model risiko: %s (%d pasangan mitra-produk)",
                    len(intent_texts), risk_training_source, len(texts))
        save_model_safely(bundle, MODEL_OUTPUT_FILE, TEMP_MODEL_FILE)
        return True
    except (OSError, ValueError, RuntimeError) as error:
        LOGGER.exception("Retraining gagal; model lama dipertahankan: %s", error)
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--mode", type=int, choices=(1, 2, 3), help="1=analisis Data Science, 2=semua raw_references, 3=satu file")
    action.add_argument("--weekly", action="store_true", help="Training pipeline mingguan dari CSV Data Science")
    action.add_argument("--intent-only", action="store_true", help="Perbarui classifier intent tanpa melatih ulang risiko")
    parser.add_argument("--training-source", choices=("analysis", "raw_references"), default="analysis",
                        help="Sumber data untuk training pipeline; raw_references mempertahankan model risiko saat ini")
    parser.add_argument("--run-id", help="ID run Data Science untuk mode 1; default run valid terbaru")
    parser.add_argument("--file", dest="source_file_name", help="Nama satu file dalam raw_references untuk mode 3")
    parser.add_argument("--public-source", action="append", default=[], metavar="FILE",
                        help="Nama PDF/DOCX/MD/TXT di raw_references/pdf atau docs yang disetujui untuk chatbot mitra")
    parser.add_argument("--mitra-summary", action="append", default=[], metavar="FILE=TEXT",
                        help="Ringkasan aman satu file mentah untuk Mitra; izin dan teks tersimpan dalam daisuki.pkl")
    parser.add_argument("--revoke-mitra-source", action="append", default=[], metavar="FILE",
                        help="Cabut akses ringkasan file dari Chat AI Mitra pada model berikutnya")
    args = parser.parse_args()
    if run_id() or args.weekly:
        if args.run_id or args.source_file_name or args.public_source or args.mitra_summary or args.revoke_mitra_source or args.intent_only or args.mode:
            parser.error("Pipeline mingguan tidak menerima opsi training manual")
        raise SystemExit(0 if run_retraining_loop(args.training_source) else 1)
    if args.intent_only:
        if args.run_id or args.source_file_name or args.public_source or args.mitra_summary or args.revoke_mitra_source:
            parser.error("--intent-only tidak menerima --run-id, --file, --public-source, atau --mitra-summary")
        try:
            refresh_intent()
        except (OSError, ValueError) as error:
            parser.exit(1, f"Training gagal: {error}\n")
        return
    try:
        if args.mode is None:
            print("1. Training hasil analisis Data Science (empat kategori)")
            print("2. Training semua data di raw_references")
            print("3. Training satu file dari raw_references")
        mode = args.mode or int(input("Pilih training (1/2/3): ").strip())
        if mode not in (1, 2, 3):
            parser.error("Pilihan harus 1, 2, atau 3")
        if args.run_id and mode != 1:
            parser.error("--run-id hanya berlaku untuk mode 1")
        if args.source_file_name and mode != 3:
            parser.error("--file hanya berlaku untuk mode 3")
        source_file_name = args.source_file_name or (input("Nama file (contoh: nama-file.pdf): ").strip() if mode == 3 else None)
        if args.mode is None and mode in (2, 3):
            while True:
                action = input("Akses ringkasan Mitra: tambah (t), cabut (c), atau Enter untuk lanjut: ").strip().casefold()
                if not action:
                    break
                if action not in ("t", "c"):
                    raise ValueError("Pilih t, c, atau Enter")
                name = source_file_name if mode == 3 else input("Nama file referensi: ").strip()
                if action == "t":
                    summary = input("Ringkasan aman untuk semua Mitra (minimal 40 karakter): ").strip()
                    args.mitra_summary.append(f"{name}={summary}")
                else:
                    args.revoke_mitra_source.append(name)
        train_manual(mode, args.run_id, args.public_source, source_file_name, args.mitra_summary, args.revoke_mitra_source)
    except (OSError, ValueError) as error:
        parser.exit(1, f"Training gagal: {error}\n")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", stream=sys.stdout)
    main()
