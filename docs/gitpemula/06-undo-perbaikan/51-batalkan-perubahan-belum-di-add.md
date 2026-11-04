# Cara Batalkan Perubahan File yang Belum di-Add

## 🎯 Kapan dipakai
Pakai ini saat kamu mengedit file, lalu hasilnya salah/berantakan, dan kamu ingin mengembalikan isi file tersebut persis seperti kondisi commit terakhir.

## ✅ Langkah-langkah
- **Untuk satu file tertentu**:
  ```bash
  git restore <nama-file>
  ```
- **Untuk SEMUA file yang belum di-add**:
  ```bash
  git restore .
  ```

## ⚠️ Hati-hati
Perintah ini akan menghapus semua editan barumu secara permanen pada file tersebut. Pastikan kamu memang tidak membutuhkan ketikan tersebut lagi!

## 🔗 Lihat juga
[52-batalkan-git-add-tanpa-buang-editan.md](52-batalkan-git-add-tanpa-buang-editan.md)
