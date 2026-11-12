# Mega Data Word

Lokasi fisik: `C:\laragon\www\daisuki-inventory\ai\data\mega_data_word\`.

- `intent/*.json`: pola yang dibaca API saat proses menyala.
- `intent/tours/*.json`: pemicu panduan fitur mitra.
- `intent/training_examples.json`: contoh dasar berlabel untuk classifier `daisuki.pkl`.
- `intent/training/*.json`: contoh tambahan per intent. Format setiap berkas: `category`, `name`, `version`, `intent`, dan `phrases`.
- `guardrails/*.json`: pola penolakan topik luar, prompt injection, probe sistem, dan permintaan data cabang lain.
- `dictionary/product_aliases.json`: alias untuk empat produk resmi.
- `dictionary/courtesy_phrases.json`: frasa pendek yang tidak boleh dianggap sebagai tujuan sesi.
- `tests/*.json`: fixture pengujian guardrail, intent, dan kebijakan respons. Test TypeScript membaca fixture ini; contoh kalimat tidak ditulis ulang di source test.

Tambahkan frasa ke berkas berlabel yang sesuai, lalu jalankan `python retraining/refresh_identity.py` dari folder `ai/` agar classifier intent lokal memakai data baru. Model risiko stok tetap dipertahankan. Restart API agar pola filter JSON terbaru dimuat. Frasa training membantu klasifikasi intent; fakta perusahaan dan SOP untuk jawaban RAG berasal dari `ai/data/mainbrain/corporate_knowledge/` serta dokumen `*.public.md` yang disetujui di `ai/data/mainbrain/context_embeddings/`.

Bank data adalah sumber perubahan kosakata. Jika menambah atau mengubah contoh uji, edit `tests/*.json`, bukan menambahkan string pesan langsung ke file test. Pola produksi tetap dimuat sekali saat startup oleh `word-loader.ts` menggunakan `Set` dan RegExp terkompilasi.

Jangan masukkan angka stok, nomor PO, identitas cabang lain, atau rahasia ke frasa training. Fakta operasional tetap berasal dari PostgreSQL.
