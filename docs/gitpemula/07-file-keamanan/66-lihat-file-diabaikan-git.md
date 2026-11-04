# Cara Lihat File yang Diabaikan Git

## 🎯 Kapan dipakai
Pakai ini saat kamu ingin memeriksa apakah suatu file benar-benar diabaikan oleh aturan `.gitignore`, atau ingin melihat seluruh daftar file yang saat ini diabaikan Git di dalam proyekmu.

## ✅ Langkah-langkah
- **Untuk memeriksa 1 file spesifik (apakah di-ignore dan oleh baris mana)**:
  ```bash
  git check-ignore -v <nama-file>
  ```
  *Contoh output: `.gitignore:4:.env .env` (artinya diabaikan oleh file .gitignore di baris ke-4).*

- **Untuk melihat semua file yang diabaikan di folder proyek**:
  ```bash
  git status --ignored
  ```

## 🔗 Lihat juga
[61-pilih-file-masuk-gitignore.md](61-pilih-file-masuk-gitignore.md)
