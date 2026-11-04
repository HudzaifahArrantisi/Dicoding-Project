# Cara Periksa File Sebelum Git Add

## 🎯 Kapan dipakai
Pakai ini sebelum menjalankan `git add .` secara membabi buta, untuk memastikan tidak ada file berbahaya, password, file uji coba, atau file sampah yang ikut terseret ke dalam staging.

## ✅ Langkah-langkah
1. Periksa ringkasan status:
   ```bash
   git status
   ```
2. Lihat perubahan teks spesifik yang kamu buat:
   ```bash
   git diff
   ```
3. Tambahkan hanya file yang memang relevan dengan tugasmu:
   ```bash
   git add src/components/Navbar.tsx
   ```

## 🔗 Lihat juga
[04-baca-git-status.md](../01-setup-dasar/04-baca-git-status.md), [72-lihat-perubahan-baris-git-diff.md](../08-riwayat-inspeksi/72-lihat-perubahan-baris-git-diff.md)
