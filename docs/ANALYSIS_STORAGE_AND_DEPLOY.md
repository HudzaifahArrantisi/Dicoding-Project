# Penyimpanan referensi dan hasil analisis

## Alur saat ini

1. Admin membuka **Log & Data → Referensi mentah** dan mengunggah PDF, CSV, JSON, MD, TXT, atau DOCX (maksimal 10 MB per file). API memvalidasi ekstensi dan isi dasar, lalu menyimpan byte asli, SHA-256, kategori, dan identitas pengunggah di `raw_references`. Nama yang sama dalam kategori yang sama diperbarui. Daftar utama menampilkan unggahan Admin; tombol **Semua di database** juga menampilkan referensi yang dulu diimpor dari folder. Kedua tampilan mengambil data dari tabel database, bukan membaca folder.
2. Tombol **Perbarui analisis Data Science** membuat `analysis_runs.id`. Agregator menghasilkan laporan mingguan, CSV handoff, Markdown, manifest, serta empat JSON kategori: produk, mitra, wilayah, dan pelaporan. Seluruh file disalin ke `analysis_run_artifacts` dengan kunci `(run_id, file_name)`. Nilai JSON juga disimpan dalam kolom `payload jsonb`.
3. Pratinjau run dan AI Insights membaca artefak run aktif dari database. Pada proses AI, API menyiapkan salinan sementara referensi mentah dari database dan CSV/JSON run yang sudah disimpan, lalu menjalankan Python. Setelah validasi, `daisuki.pkl` dan hasil AI lain juga diarsipkan di `analysis_run_artifacts`. Direktori referensi sementara dihapus setelah proses selesai.
4. Referensi mentah menjadi indeks pencarian privat di dalam `daisuki.pkl`; CSV hasil analisis menjadi data training classifier risiko. Data stok dan pesanan terkini tetap berasal dari database operasional sesuai hak akses, bukan dari file referensi.

`/reports/runs/<run_id>/` adalah konsep alamat artefak per run, bukan nama tabel SQL. Implementasinya memakai satu tabel `analysis_run_artifacts` dengan `run_id` dan `file_name`. File referensi mentah lama dapat diimpor sekali dengan `python ai/scripts/import_raw_references.py`; hasil run lama yang sudah punya delapan artefak Data Science lengkap dapat disalin dengan `bun run apps/api/src/db/backfill-analysis-artifacts.ts`. Run lama tanpa empat kategori dilewati. Migrasi skema ada di `neon/migrations/20261119_analysis_storage.sql`.

## Batas deployment

Database menyimpan referensi dan hasil run agar tidak bergantung pada file yang dikomit ke Git. Pipeline Python saat ini masih memakai filesystem sementara dan `Bun.spawn`, sehingga **endpoint pembuatan dan proses run belum dapat dijalankan di Cloudflare Workers**. Worker dapat melayani upload, pembacaan JSON, dan API operasional setelah backend diadaptasi untuk runtime Workers; training dan agregasi perlu dijalankan oleh layanan Python terpisah.

PDF lama telah dikeluarkan dari pelacakan Git dan tetap ada pada disk pengembang sebagai salinan lokal yang diabaikan. Commit Git lama masih memuat PDF tersebut; penghapusan dari seluruh riwayat memerlukan migrasi riwayat Git dan koordinasi dengan seluruh clone.

Rancangan deployment berikutnya: Cloudflare Workers menerima permintaan Admin dan menyimpan status run; job Python di Hugging Face Docker Space atau worker komputasi lain mengambil referensi dan run dari database lewat kredensial layanan terbatas, melatih model, menyimpan hasil ke database dan model ke repositori privat atau storage persisten, lalu mengirim status selesai. API inferensi model dapat memakai bridge HTTP `RAG_BRIDGE_URL` yang sudah tersedia. Jangan memuat `.pkl` dari unggahan pengguna; hanya muat artefak yang dihasilkan job tepercaya.

Penyimpanan disk Docker Space bersifat sementara kecuali bucket persisten dipasang. Cloudflare Workers juga tidak menyediakan proses Python lokal untuk pipeline ini. Rujukan: [Hugging Face Docker Spaces](https://huggingface.co/docs/hub/en/spaces-sdks-docker), [custom inference handler](https://huggingface.co/docs/inference-endpoints/en/guides/custom_handler), dan [Node.js compatibility Cloudflare Workers](https://developers.cloudflare.com/workers/runtime-apis/nodejs/).
