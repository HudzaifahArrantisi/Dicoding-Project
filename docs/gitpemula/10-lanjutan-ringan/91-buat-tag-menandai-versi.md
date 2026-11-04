# Cara Buat Tag untuk Menandai Versi Rilis

## 🎯 Kapan dipakai
Pakai ini saat aplikasi siap dirilis atau di-deploy (misal versi `v1.0.0` atau `v1.2.0`) untuk menandai titik tonggak penting dalam sejarah proyek.

## ✅ Langkah-langkah
1. Buat tag dengan nama versi:
   ```bash
   git tag -a v1.0.0 -m "Release: rilis versi 1.0.0 modul inventaris"
   ```
2. Push tag tersebut ke GitHub:
   ```bash
   git push origin v1.0.0
   ```
3. *(Atau push semua tag sekaligus)*:
   ```bash
   git push origin --tags
   ```

## 🔍 Cara cek berhasil
Buka tab **Releases / Tags** di repositori GitHub. Versi `v1.0.0` akan muncul dengan paket source code zip otomatis.

## 🔗 Lihat juga
[95-lihat-commit-sebelum-merge.md](95-lihat-commit-sebelum-merge.md)
