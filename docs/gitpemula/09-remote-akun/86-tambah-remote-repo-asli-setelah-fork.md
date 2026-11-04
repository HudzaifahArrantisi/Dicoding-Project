# Cara Tambah Remote untuk Repo Asli Setelah Fork (Upstream)

## 🎯 Kapan dipakai
Pakai ini saat kamu bekerja di repository fork dan ingin menambahkan tautan ke repository induk/asli milik tim agar selalu bisa mengambil update terbaru dari mereka.

## ✅ Langkah-langkah
1. Tambahkan remote baru dengan nama konvensi `upstream`:
   ```bash
   git remote add upstream https://github.com/<organisasi-asli>/<nama-repo>.git
   ```
2. Cek apakah kedua remote sudah terpasang:
   ```bash
   git remote -v
   ```
3. Cara mengambil update dari repo asli kapan saja:
   ```bash
   git fetch upstream
   git merge upstream/main
   ```

## 🔗 Lihat juga
[24-fork-repo-dan-sinkron.md](../03-kolaborasi-pull-request/24-fork-repo-dan-sinkron.md)
