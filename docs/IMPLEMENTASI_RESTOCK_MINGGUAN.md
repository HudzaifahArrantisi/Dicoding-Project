# Operasional restock mingguan

## Urutan rilis

1. Hentikan penulisan pesanan sementara, lalu jalankan `neon/migrations/20261028_weekly_delivery.sql` dan `neon/migrations/20261028_restock_reservations.sql` secara berurutan pada database Neon. Migrasi kedua menambahkan `qty_reserved` dan mereservasi pesanan lama yang masih menunggu atau disetujui. Keduanya memakai penanda agar aman dijalankan ulang.
2. Pasang dependensi JavaScript dengan `bun install` dan dependensi Python dari `data-science/requirements.txt` serta `ai/requirements.txt`.
3. Jalankan API dan web versi baru bersama. Kamera memerlukan HTTPS atau localhost. Input kode manual tetap tersedia.
4. Atur `PYTHON_EXECUTABLE` pada proses API bila executable Python bukan `python`. Kedua workspace Python memakai `DATABASE_URL`; proses API juga perlu menyediakan variabel ini untuk job.

Cron Elysia menjalankan pipeline mingguan setiap Senin pukul 05.00 WIB. Admin dapat memulainya lewat tombol **Perbarui saran** di tab AI. `POST /admin/ai-insights/run` segera mengembalikan status berjalan (HTTP 202); `GET /admin/ai-insights/run` menampilkan status akhir. Halaman admin memeriksa status secara berkala dan memuat ulang hasil setelah semua tahap berhasil. Jika satu tahap gagal, tahap berikutnya tidak dijalankan dan status menjadi `failed`; periksa log API untuk penyebabnya.

Resi hanya tersedia setelah pesanan dikirim. Token QR tidak dikirim ke akun Mitra melalui API. Pemindaian atau input kode resi yang benar menyelesaikan pesanan dan mencatat stok cabang dalam satu transaksi.

Saat Mitra mengajukan restock, jumlah dimulai kosong. Jumlah yang diminta boleh berapa saja selama tidak melampaui stok gudang pusat yang tersedia. API mengunci baris produk dengan `FOR UPDATE` dan langsung mereservasi jumlah yang diminta; pengajuan serentak untuk produk yang sama diproses bergiliran. Jika stok tidak cukup, API mengembalikan 409 dan seluruh pengajuan dibatalkan tanpa pemotongan parsial. Pembatalan atau penolakan mengembalikan reservasi. Persetujuan parsial mengembalikan selisihnya, sedangkan pengiriman tidak memotong stok lagi.
