# Keamanan autentikasi dan akses

## Cara kerja saat ini

- Login membuat sesi acak di server. Browser menyimpan ID sesi dalam cookie `HttpOnly`, `SameSite=Strict`; pada `NODE_ENV=production` cookie juga memakai `Secure` dan awalan `__Host-`. Database hanya menyimpan hash ID sesi.
- Sesi Admin berakhir setelah 30 menit tanpa aktivitas atau 8 jam sejak login. Sesi Mitra berakhir setelah 2 jam tanpa aktivitas atau 24 jam sejak login. Logout mencabut sesi di database.
- `GET /me` memberi profil dan token CSRF untuk sesi yang sedang aktif. Token CSRF disimpan sementara di memori aplikasi web. Setiap `POST`, `PUT`, `PATCH`, dan `DELETE` (kecuali login) harus berasal dari `WEB_ORIGIN` yang tepat dan membawa `X-CSRF-Token` yang cocok.
- API menentukan identitas, peran, dan `partner_id` dari sesi di server. ID mitra di body atau query tidak memberi akses ke cabang lain. Akun cabang yang dinonaktifkan langsung kehilangan akses.
- Endpoint yang mengubah data mengembalikan `{ "status": "ok" }` saat berhasil. Untuk menampilkan data terbaru, web mengambil ulang endpoint baca. Respons error tetap berisi pesan error seperlunya. Foto bukti dan foto profil tersimpan sebagai file yang hanya dilayani setelah pemeriksaan sesi dan kepemilikan.
- Perubahan mitra, persetujuan pesanan, dan perubahan status pesanan tercatat di `audit_logs`. Penghapusan mitra melalui UI mengubah `is_active` menjadi `false` agar riwayat tidak hilang.

## Menjalankan dan menerapkan

1. Jalankan `neon/migrations/20261024_secure_sessions.sql` **sekali** pada database yang sudah ada. `neon/init.sql` sudah memuat tabel baru untuk database baru.
2. Tetapkan `WEB_ORIGIN` ke origin web yang sebenarnya, termasuk skema dan port, misalnya `https://inventory.example.com`. Akses lewat IP lokal membutuhkan nilai origin IP tersebut selama pengembangan.
3. Di produksi, sajikan web dan API lewat HTTPS pada situs yang sama (misalnya subdomain dalam domain yang sama), dan tetapkan `NODE_ENV=production`. Cookie `Secure` tidak akan terkirim lewat HTTP.
4. Pastikan `apps/api/uploads/` tidak dipublikasikan langsung oleh reverse proxy atau static server. Foto harus melewati route API `/uploads/*` agar izin akses diperiksa.
5. Ganti sandi akun nyata, jangan gunakan akun `@daisuki.test` di produksi, dan batasi akses `DATABASE_URL` ke API. Backup database dan file unggahan bersama-sama.
6. Jika memakai beberapa instance API, gunakan pembatas percobaan login bersama di gateway atau penyimpanan terpusat. Pembatas di aplikasi saat ini berada di memori tiap instance. Batasi ukuran request di reverse proxy dan tambahkan pemantauan login gagal serta error 5xx.
7. Hapus sesi kedaluwarsa secara berkala dari `auth_sessions`; pencabutan dan kedaluwarsa tetap diperiksa pada setiap request meski baris lama belum dibersihkan.

Perubahan ini mengurangi risiko pengambilalihan sesi, CSRF, akses lintas cabang, dan kebocoran foto. Tidak ada aplikasi yang dapat dijamin tidak bisa ditembus; TLS, konfigurasi server, pembaruan dependency, pemantauan, dan uji keamanan berkala tetap diperlukan.
