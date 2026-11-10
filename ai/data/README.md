# Data Daisuki

- `raw_references/`: dokumen sumber untuk ekstraksi; tempatkan PDF, dokumen teks, dan CSV di subfolder yang sesuai.
- `mainbrain/models/`: artefak `daisuki.pkl` hasil training lokal.
- `mainbrain/context_embeddings/`: snapshot analitik dan dokumen Markdown hasil ekstraksi. Chatbot membangun indeks kata terbalik di RAM dari `*.public.md` saat API menyala; folder ini belum berisi vektor embedding.
- `mainbrain/corporate_knowledge/`: profil perusahaan, aturan bisnis, dan teks jawaban cadangan yang disetujui.
- `mainbrain/session_memory/`: dokumentasi memori; ringkasan percakapan nyata disimpan terisolasi di PostgreSQL.
- `mega_data_word/`: pola intent, guardrail, alias produk, dan contoh training.

Perubahan kamus JSON dibaca pada proses API berikutnya. Tambah contoh intent pada berkas per topik di `mega_data_word/intent/training/`, lalu jalankan `python ai/retraining/refresh_identity.py` untuk memperbarui classifier lokal tanpa mengubah model risiko. Daftar dokumen RAG yang boleh dibaca mitra diatur oleh `mainbrain/corporate_knowledge/rag_policy.json`.
