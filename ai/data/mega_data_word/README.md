# Mega Data Word

Lokasi fisik: `C:\laragon\www\daisuki-inventory\data\mega_data_word\`.

- `intent/*.json`: pola yang dibaca API saat proses menyala.
- `intent/tours/*.json`: pemicu panduan fitur mitra.
- `intent/training_examples.json`: contoh dasar berlabel untuk classifier `daisuki.pkl`.
- `intent/training/*.json`: contoh tambahan per intent. Format setiap berkas: `category`, `name`, `version`, `intent`, dan `phrases`.
- `guardrails/*.json`: pola penolakan topik luar, prompt injection, probe sistem, dan permintaan data cabang lain.
- `dictionary/product_aliases.json`: alias untuk empat produk resmi.

Tambahkan frasa ke berkas berlabel yang sesuai, lalu jalankan `python ai/retraining/refresh_identity.py` dari root repository agar classifier intent lokal memakai data baru. Model risiko stok tetap dipertahankan. Restart API agar pola filter JSON terbaru dimuat. Frasa training membantu klasifikasi intent; fakta perusahaan dan SOP untuk jawaban RAG berasal dari `data/mainbrain/corporate_knowledge/` serta dokumen `*.public.md` yang disetujui di `data/mainbrain/context_embeddings/`.

Jangan masukkan angka stok, nomor PO, identitas cabang lain, atau rahasia ke frasa training. Fakta operasional tetap berasal dari PostgreSQL.
