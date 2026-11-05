# Pemeriksaan QA API saat development

Jalankan API lokal lebih dulu (`bun --cwd=apps/api run dev`), lalu di terminal lain:

```powershell
bun run qa:api --json qa-reports/api-latest.json
```

Perintah ini membaca route Elysia dari `apps/api/src`, memeriksa `/health`, lalu mencoba semua GET statis tanpa login. Hasil `PASS` untuk akses tanpa login berarti endpoint privat mengembalikan HTTP 401. Hasil `FAIL` berarti status tidak sesuai, server error, atau permintaan timeout. Laporan JSON berisi sumber route dan rincian setiap pemeriksaan.

Untuk memeriksa respons GET sebagai admin dan mitra, isi kredensial akun development melalui environment variable di terminal yang menjalankan QA. Kata sandi tidak ditulis ke laporan:

```powershell
$env:QA_ADMIN_EMAIL = 'email-admin-development'
$env:QA_ADMIN_PASSWORD = 'kata-sandi-admin'
$env:QA_MITRA_EMAIL = 'email-mitra-development'
$env:QA_MITRA_PASSWORD = 'kata-sandi-mitra'
bun run qa:api --json qa-reports/api-latest.json
```

Gunakan `--base-url http://127.0.0.1:3001` untuk menentukan server lokal lain dan `--timeout-ms 20000` untuk mengubah batas waktu. URL harus mengarah ke `localhost`, `127.0.0.1`, atau `::1`. Untuk menguji lewat proxy web, gunakan `--base-url http://127.0.0.1:3000/api`.

GET dengan parameter route memakai data dari daftar mitra dan pesanan yang berhasil dibaca. Jika data tersebut belum tersedia, buat file JSON fixture, misalnya `qa-fixtures.json`:

```json
{
  "GET /orders/:id/receipt-proof": "/orders/ID_PESANAN_NYATA/receipt-proof",
  "GET /admin/stock-logs/partners/:partnerId": "/admin/stock-logs/partners/ID_MITRA_NYATA",
  "GET /regions/regencies/:code": "/regions/regencies/KODE_PROVINSI_NYATA"
}
```

Lalu jalankan `bun run qa:api --fixtures qa-fixtures.json`. Fixture mengutamakan nilai yang Anda pilih dan harus menunjuk data nyata; respons 404 akan dilaporkan sebagai gagal. Route dinamis tanpa data, aliran SSE, dan mutasi POST/PUT/PATCH/DELETE ditandai `SKIP` secara eksplisit. Login menjadi pengecualian ketika kredensial QA tersedia. Berkas privat dapat diuji dengan fixture URL berkas nyata; tanpa fixture hanya batas aksesnya yang diperiksa. Pemeriksa ini tidak menjalankan mutasi stok dan pesanan. Untuk menguji alur mutasi, gunakan database development terpisah dan tes integrasi yang menyiapkan serta membersihkan datanya.

Kode keluar `1` jika ada `FAIL`, sehingga perintah dapat dipakai dalam pemeriksaan lokal atau CI dengan API development yang sudah berjalan. `SKIP` bukan tanda endpoint sehat; baca jumlahnya sebelum menyatakan cakupan QA lengkap.
