# Container API dan worker RAG

Bangun dari root proyek dengan `docker build -f Dockerfile.api -t daisuki-api .`. Image berisi Bun, Python 3.11, API, dan dependensi worker `daisuki.pkl`.

Jalankan dengan `DATABASE_URL`, `WEB_ORIGIN`, kunci autentikasi, dan konfigurasi LLM sebagai environment. Pasang model yang telah ditraining sebagai volume privat pada `/app/ai/data/mainbrain/models/daisuki.pkl`, lalu set `DAISUKI_MODEL_PATH=ai/data/mainbrain/models/daisuki.pkl`. Berkas `.env`, data referensi mentah, dan model privat tidak ikut ke build context.

Terapkan migrasi yang belum berjalan, termasuk `neon/migrations/20261117_consignment_only.sql`, sebelum menjalankan versi API ini. Migrasi terbaru mengembalikan pengaturan mitra ke titip jual; riwayat pesanan lama tetap tersimpan untuk audit. Siapkan snapshot database terlebih dahulu. Container memakai proses API tunggal; riwayat chat dan memori yang perlu bertahan tetap tersimpan di PostgreSQL.

Migrasi finansial mengisi perkiraan nilai pesanan lama dari harga produk saat migrasi. Status pembayaran dan tanggal jatuh tempo pesanan lama dibiarkan kosong agar sistem tidak menandai tagihan historis sebagai belum lunas tanpa verifikasi.
