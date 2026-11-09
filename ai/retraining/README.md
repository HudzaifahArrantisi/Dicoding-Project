# Daisuki AI Retraining

`train.py` membaca data operasional PostgreSQL yang juga dipakai tab **AI Insights** admin. Tidak ada dataset JSON contoh dalam alur produksi. Sumbernya adalah `partner_stocks`, `stock_logs` laporan fisik mitra, `partners`, `products`, `orders`, dan `order_items`. Konsumsi dihitung dari penurunan stok `manual_update` selama 7 dan 30 hari; perubahan karena penerimaan barang tidak dihitung sebagai penjualan.

Setiap pasangan mitra-produk menjadi satu sampel teks berisi stok saat ini, buffer minimal, konsumsi, frekuensi kritis, dan status pesanan. Label `urgent_restock`, `regular_order`, dan `normal` diturunkan dari aturan risiko stok yang sejalan dengan AI Insights. Label ini adalah *pseudo-label* dari data operasional, bukan keputusan manusia yang sudah diverifikasi.

`daisuki.pkl` sekarang berisi dua pipeline Scikit-Learn: `intent` untuk 11 maksud pertanyaan Daisuki, dan `risk` untuk prioritas restock. Contoh intent di `source.py` adalah korpus berlabel yang dikurasi, bukan fakta angka. Bila data stok hanya menghasilkan satu kelas, pipeline intent tetap dilatih dan pipeline risiko lama dipertahankan bila tersedia. Model ini pengklasifikasi, bukan LLM pembuat teks.

```powershell
cd ai\retraining
python -m pip install -r requirements.txt
python test_pipeline.py
python train.py
```

Atur `DATABASE_URL` di environment atau di `ai/.env` / `apps/api/.env`. Pengguna database perlu akses baca tabel di atas. `test_pipeline.py` memakai fixture lokal untuk menguji logika tanpa menyentuh database atau model produksi. `python train.py` membaca database aktual dan mengganti model secara atomik; tidak menghapus atau mengubah data database.

Pipeline mingguan API menjalankan analisis wilayah, `ai/jobs/weekly_facts_aggregator.py`, lalu `train.py`. Agregator menghasilkan `ai/data/weekly_operational_facts.json` dari PostgreSQL dan hasil Naive Bayes wilayah. Snapshot itu menjadi dasar angka KPI admin dan jawaban faktual chatbot. Jalankan job agregator setelah job wilayah; jangan menulis angka contoh ke file produksi.

Tombol **Jalankan analisis Python** di tab Log & Data memanggil pipeline yang sama melalui API admin. Setelah pelatihan, `chart_data.py` membaca log penurunan stok fisik 14 hari terakhir dan memakai pipeline `risk` dari `daisuki.pkl` untuk menghitung jumlah pasangan mitra-produk per kelas risiko saat itu. Grafik garis menunjukkan konsumsi aktual per hari, bukan prediksi deret waktu dari model klasifikasi. Progres tiap skrip tersedia pada status pipeline; hasil grafik disimpan di memori API sampai proses berikutnya atau server dimulai ulang.

Model teks ini adalah modul tersendiri. Tab AI Insights saat ini tetap menggunakan analisis SQL dan model risiko yang sudah ada; belum memakai hasil prediksi `DaisukiFilter` untuk mengubah dashboard.

Chatbot memakai pipeline intent untuk mengenali pertanyaan dan pipeline risiko untuk saran restock. API menyusun jawaban dari snapshot mingguan dan data toko milik mitra yang login. `inference_worker.py` berjalan sebagai proses Python yang dipakai ulang oleh API dan memuat ulang artefak saat berkas berubah. Pada server, pasang dependensi di `requirements.txt`, siapkan artefak `daisuki.pkl` lewat `train.py`, dan atur `DAISUKI_PYTHON_BIN` atau `DAISUKI_MODEL_PATH` bila lokasinya berbeda. Artefak `.pkl` sengaja tidak masuk Git karena dapat memuat pola data pelatihan dan hanya boleh dimuat dari sumber tepercaya. Jika model atau snapshot belum tersedia, jawaban faktual tidak mengarang angka.

Riwayat pertanyaan, jawaban, label model, dan penilaian membantu/tidak membantu disimpan di tabel `assistant_chat_events`. Terapkan `neon/migrations/20261104_assistant_chat_events.sql` sekali pada database yang dipakai API. Riwayat hanya dapat dibaca oleh mitra pemilik percakapan. Penilaian chat adalah data evaluasi jawaban, bukan label pelatihan untuk model risiko stok.
