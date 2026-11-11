# Daisuki AI Retraining

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
