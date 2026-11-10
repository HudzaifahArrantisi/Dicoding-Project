# Daisuki AI Retraining

`train.py` memakai `ai/data/raw_references/csv/cleaned_inventory_summary.csv` untuk training risiko bila berkas handoff Data Science tersebut tersedia dan valid. Jika tidak ada CSV, training membaca data operasional PostgreSQL yang juga dipakai tab **AI Insights** admin: `partner_stocks`, `stock_logs` laporan fisik mitra, `partners`, `products`, `orders`, dan `order_items`. Konsumsi database dihitung dari penurunan stok `manual_update` selama 7 dan 30 hari; perubahan karena penerimaan barang tidak dihitung sebagai penjualan.

Setiap pasangan mitra-produk menjadi satu sampel teks berisi stok saat ini, buffer minimal, konsumsi, frekuensi kritis, dan status pesanan. Label `urgent_restock`, `regular_order`, dan `normal` diturunkan dari aturan risiko stok yang sejalan dengan AI Insights. Label ini adalah *pseudo-label* dari data operasional, bukan keputusan manusia yang sudah diverifikasi.

`ai/data/mainbrain/models/daisuki.pkl` berisi dua pipeline Scikit-Learn: `intent` untuk maksud pertanyaan Daisuki, dan `risk` untuk prioritas restock. Contoh intent berasal dari `ai/data/mega_data_word/intent/training_examples.json` dan berkas per label di `ai/data/mega_data_word/intent/training/`; keduanya adalah korpus frasa berlabel, bukan fakta angka. Jalankan `python retraining/refresh_identity.py` dari folder `ai/` untuk memperbarui classifier intent tanpa melatih ulang model risiko. Bila data stok hanya menghasilkan satu kelas, pipeline intent tetap dilatih dan pipeline risiko lama dipertahankan bila tersedia. Model ini pengklasifikasi, bukan LLM pembuat teks.

```powershell
cd ai
python -m pip install -r requirements.txt
python retraining/test_pipeline.py
python retraining/train.py
```

Atur `DATABASE_URL` di environment atau di `ai/.env` / `apps/api/.env` bila memakai PostgreSQL. `test_pipeline.py` memakai fixture lokal untuk menguji logika tanpa menyentuh database atau model produksi. `test_csv_handoff.py` menguji pemakaian CSV dengan model sementara. `python retraining/train.py` mengganti model secara atomik; tidak mengubah data database. CSV dengan skema tidak valid menggagalkan training dan mempertahankan model lama.

Pipeline mingguan API menjalankan analisis wilayah, `ai/jobs/weekly_facts_aggregator.py`, lalu `train.py`. Agregator menghasilkan `ai/data/mainbrain/context_embeddings/weekly_operational_facts.json` dari PostgreSQL dan hasil Naive Bayes wilayah. Snapshot itu menjadi dasar angka KPI admin dan jawaban faktual chatbot. Jalankan job agregator setelah job wilayah; jangan menulis angka contoh ke file produksi.

Tombol **Jalankan analisis Python** di tab Log & Data memanggil pipeline yang sama melalui API admin. Setelah pelatihan, `chart_data.py` membaca log penurunan stok fisik 14 hari terakhir dan memakai pipeline `risk` dari `daisuki.pkl` untuk menghitung jumlah pasangan mitra-produk per kelas risiko saat itu. Grafik garis menunjukkan konsumsi aktual per hari, bukan prediksi deret waktu dari model klasifikasi. Progres tiap skrip tersedia pada status pipeline; hasil grafik disimpan di memori API sampai proses berikutnya atau server dimulai ulang.

Model teks ini adalah modul tersendiri. Tab AI Insights saat ini tetap menggunakan analisis SQL dan model risiko yang sudah ada; belum memakai hasil prediksi `DaisukiFilter` untuk mengubah dashboard.

Chatbot memakai pipeline intent untuk mengenali pertanyaan dan pipeline risiko untuk saran restock. API menyusun jawaban dari snapshot mingguan dan data toko milik mitra yang login. CSV Data Science menghasilkan `ai_analysis_summary.csv` agregat di raw references serta Markdown privat di mainbrain; CSV mentah dan Markdown privat tidak dibaca RAG mitra. `inference_worker.py` berjalan sebagai proses Python yang dipakai ulang oleh API dan memuat ulang artefak saat berkas berubah. Pada server, pasang dependensi di `requirements.txt`, siapkan artefak `daisuki.pkl` lewat `train.py`, dan atur `DAISUKI_PYTHON_BIN` atau `DAISUKI_MODEL_PATH` bila lokasinya berbeda. Artefak `.pkl` tidak boleh dimuat dari sumber tidak tepercaya. Jika model atau snapshot belum tersedia, jawaban faktual tidak mengarang angka.

Riwayat pertanyaan, jawaban, label model, dan penilaian membantu/tidak membantu disimpan di tabel `assistant_chat_events`. Terapkan `neon/migrations/20261104_assistant_chat_events.sql` sekali pada database yang dipakai API. Riwayat hanya dapat dibaca oleh mitra pemilik percakapan. Penilaian chat adalah data evaluasi jawaban, bukan label pelatihan untuk model risiko stok.
