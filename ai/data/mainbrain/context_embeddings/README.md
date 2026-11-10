# Mainbrain Knowledge Directory

Direktori ini berisi snapshot analitik dan Markdown (`.md`) hasil ekstraksi dokumen dari `data/raw_references/`.

- Dihasilkan secara otomatis oleh: `python ai/retraining/train.py` (melalui modul `doc_loader.py`).
- Hanya berkas `*.public.md` yang dibaca oleh runtime RAG Chatbot dan diinjeksikan ke LLM lokal via 9Router.
- Runtime portal mitra hanya mengambil berkas `*.public.md`. Ekstraksi baru tidak otomatis diberi penanda publik; isinya harus ditinjau terlebih dahulu. Jangan menandai data pribadi atau data cabang lain sebagai publik.
- API mengindeks kata dari dokumen publik ke RAM pada saat proses menyala. Tidak ada layanan embedding eksternal yang diperlukan untuk retrieval ini.
- Berkas yang boleh dibaca mitra harus memiliki akhiran `.public.md` dan tercantum dalam `data/mainbrain/corporate_knowledge/rag_policy.json`. Dokumen berisi email, nomor telepon, token, atau URL koneksi akan dilewati.
