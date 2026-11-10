# Mainbrain Knowledge Directory

Direktori ini berisi file-file Markdown (`.md`) hasil ekstraksi otomatis dari seluruh dokumen mentah (PDF, DOCX, JSON, CSV, TXT) yang diletakkan di folder `ai/data/`.

- Dihasilkan secara otomatis oleh: `python ai/retraining/train.py` (melalui modul `doc_loader.py`).
- Hanya berkas `*.public.md` yang dibaca oleh runtime RAG Chatbot dan diinjeksikan ke LLM lokal via 9Router.
- Runtime portal mitra hanya mengambil berkas `*.public.md`. Berkas hasil ekstraksi lain tetap internal sampai isinya ditinjau dan diberi penanda publik. Jangan menandai CV pribadi atau data cabang lain sebagai publik.
