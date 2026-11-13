# Daisuki AI Retraining

## Training manual dengan tiga pilihan

Panduan per pilihan: [analisis internal](../../docs/training/01-analisis-internal.md), [referensi mentah](../../docs/training/02-referensi-mentah.md), dan [gabungan](../../docs/training/03-gabungan.md). [Indeks panduan](../../docs/training/README.md) menjelaskan perbedaan sumber dan hasil model.

Jalankan dari root proyek dengan Python virtual environment AI:

```powershell
ai/.venv/Scripts/python.exe ai/retraining/train_daisuki.py
```

Menu menawarkan **1** analisis perusahaan, **2** referensi mentah, atau **3** keduanya. Untuk otomasi, pakai `--mode 1`, `--mode 2`, atau `--mode 3`. Opsi 1 dan 3 memakai run Data Science valid terbaru yang memiliki empat kategori JSON (`products`, `partners`, `regions`, `reporting`) beserta CSV pasangan mitra-produk. Gunakan `--run-id UUID` untuk memilih run tertentu. Empat JSON divalidasi; classifier risiko dilatih dari CSV run yang sama. Data per mitra tetap privat dan tidak masuk indeks dokumen mitra.

Opsi 2 dan 3 memasukkan teks seluruh PDF yang berhasil diekstrak ke indeks vektor **privat** dalam `daisuki.pkl`, serta memperbarui indeks TF-IDF dokumen publik. Pilih PDF, DOCX, MD, atau TXT yang boleh dibaca **semua mitra** secara eksplisit, misalnya:

```powershell
ai/.venv/Scripts/python.exe ai/retraining/train_daisuki.py --mode 2 --public-source "artikel-ai.pdf"
```

File harus ada di `ai/data/raw_references/pdf/` atau `ai/data/raw_references/docs/`. Skrip mengekstrak teks ke Markdown privat, memeriksa pola sensitif, lalu membuat `.public.md` dan menambahkannya ke `rag_policy.json`. Periksa isi PDF terlebih dahulu: persetujuan file adalah persetujuan publikasi isinya ke chatbot mitra. PDF hasil scan memerlukan OCR; DOC lama perlu dikonversi ke DOCX. Tanpa `--public-source`, opsi 2 hanya membangun ulang indeks dari sumber publik yang sudah disetujui. Maksimum sumber dan panjang per dokumen mengikuti `rag_policy.json`.

Opsi 1 dan 3 juga menaruh **vektor numerik analisis mingguan** dari empat JSON kategori dan CSV run valid ke dalam `analysis_retrieval`. Cuplikan kategori mitra/pelaporan dan produk diberi `partner_id`; worker hanya mengembalikan cuplikan milik mitra dari JWT. Agregat produk/wilayah tersimpan untuk analisis privat, tetapi tidak dikirim ke chatbot mitra. Untuk ringkasan mingguan, prompt membedakan snapshot periode model dari stok dan konsumsi terbaru yang dibaca dari PostgreSQL.

Training manual menulis model ke `ai/data/private/manual/daisuki.pkl` (diabaikan Git karena berisi data mitra dan PDF mentah). Arahkan `DAISUKI_MODEL_PATH=ai/data/private/manual/daisuki.pkl` di `apps/api/.env`, lalu restart API. Model run yang dipublikasikan lewat alur Admin tetap punya lokasi sendiri.

`daisuki.pkl` menyimpan indeks pencarian TF-IDF berupa vektor angka dari n-gram karakter, bukan embedding neural atau model bahasa yang memahami semua artikel. PDF privat tidak menjadi konteks chatbot mitra sampai disetujui lewat `--public-source`. Jawaban tetap dibuat oleh LLM 9Router atau fallback lokal; angka stok/PO terkini selalu berasal dari PostgreSQL sesuai JWT. Worker API memuat ulang model setelah berkas berubah, tetapi daftar sumber publik yang dimuat API saat startup memerlukan restart API.

Skrip ini ditujukan untuk training manual lokal. Alur analisis run yang diterbitkan melalui Admin tetap memakai `train.py` dan proses persetujuan run yang ada.

`train.py` memakai `data-science/reports/cleaned_inventory_summary.csv` untuk training risiko. Jalankan `python data-science/src/weekly_analytics_aggregator.py` dari root terlebih dahulu. Jika CSV tidak ada, kedaluwarsa, atau tidak valid, training berhenti dan model lama dipertahankan. Data Science menghitung konsumsi dari penurunan stok `manual_update`; penerimaan barang tidak dihitung sebagai konsumsi.

Setiap pasangan mitra-produk menjadi satu sampel teks berisi stok saat ini, buffer minimal, konsumsi, dan cakupan stok. Label `urgent_restock`, `regular_order`, dan `normal` diturunkan dari aturan risiko stok. Label ini adalah *pseudo-label* dari data operasional, bukan keputusan manusia yang sudah diverifikasi.

`ai/data/mainbrain/models/daisuki.pkl` berisi dua pipeline Scikit-Learn: `intent` untuk maksud pertanyaan Daisuki, dan `risk` untuk prioritas restock. Contoh intent berasal dari `ai/data/mega_data_word/intent/training_examples.json` dan berkas per label di `ai/data/mega_data_word/intent/training/`; keduanya adalah korpus frasa berlabel, bukan fakta angka. Jalankan `python retraining/refresh_identity.py` dari folder `ai/` untuk memperbarui classifier intent tanpa melatih ulang model risiko. Bila data stok hanya menghasilkan satu kelas, pipeline intent tetap dilatih dan pipeline risiko lama dipertahankan bila tersedia. Model ini pengklasifikasi, bukan LLM pembuat teks.

```powershell
cd ai
python -m pip install -r requirements.txt
python retraining/test_pipeline.py
python retraining/train.py
```

`test_pipeline.py` memakai fixture lokal tanpa menyentuh database atau model produksi. `test_csv_handoff.py` menguji pemakaian CSV dengan model sementara. `python retraining/train.py` mengganti model secara atomik; tidak mengubah database.

Pipeline mingguan API menjalankan agregator Data Science, Naive Bayes wilayah, alokasi, sintesis fakta, lalu `train.py`. `weekly_facts_aggregator.py` menghasilkan `ai/data/mainbrain/context_embeddings/weekly_operational_facts.json` dari laporan Data Science dan skor wilayah; job ini tidak mengagregasi SQL sendiri. Snapshot menjadi sumber empat kartu AI Insights admin dan konteks agregat yang sudah disaring untuk chatbot mitra.

Tombol **Jalankan analisis Python** di tab Log & Data memanggil pipeline yang sama melalui API admin. Setelah pelatihan, `chart_data.py` membaca deret konsumsi 14 hari dari laporan Data Science dan memakai pipeline `risk` dari `daisuki.pkl` untuk menghitung jumlah pasangan mitra-produk per kelas. Grafik garis menunjukkan konsumsi aktual, bukan prediksi deret waktu. Hasil grafik disimpan di memori API sampai proses berikutnya atau server dimulai ulang.

Empat kartu AI Insights admin memakai laporan Data Science. Skor zona wilayah berasal dari job Naive Bayes Python. Klasifikasi `risk` di `daisuki.pkl` dipakai oleh worker chatbot dan ringkasan grafik.

Chatbot memakai pipeline intent untuk mengenali pertanyaan dan pipeline risiko untuk saran restock. API menyusun jawaban dari snapshot mingguan dan data toko milik mitra yang login. CSV Data Science menghasilkan `ai_analysis_summary.csv` agregat di raw references serta Markdown privat di mainbrain; CSV mentah dan Markdown privat tidak dibaca RAG mitra. `inference_worker.py` berjalan sebagai proses Python yang dipakai ulang oleh API dan memuat ulang artefak saat berkas berubah. Pada server, pasang dependensi di `requirements.txt`, siapkan artefak `daisuki.pkl` lewat `train.py`, dan atur `DAISUKI_PYTHON_BIN` atau `DAISUKI_MODEL_PATH` bila lokasinya berbeda. Artefak `.pkl` tidak boleh dimuat dari sumber tidak tepercaya. Jika model atau snapshot belum tersedia, jawaban faktual tidak mengarang angka.

Riwayat pertanyaan, jawaban, label model, dan penilaian membantu/tidak membantu disimpan di tabel `assistant_chat_events`. Terapkan `neon/migrations/20261104_assistant_chat_events.sql` sekali pada database yang dipakai API. Riwayat hanya dapat dibaca oleh mitra pemilik percakapan. Penilaian chat adalah data evaluasi jawaban, bukan label pelatihan untuk model risiko stok.
