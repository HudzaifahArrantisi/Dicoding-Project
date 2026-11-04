# Cara Lihat Perubahan yang Sudah di-Add (Staged)

## 🎯 Kapan dipakai
Pakai ini saat kamu sudah menjalankan `git add .`, lalu ingin mengecek ulang baris kode apa saja yang sekarang sedang siap di-commit (*staged*). Mengetik `git diff` biasa tidak akan menampilkan apa-apa karena file sudah di-add.

## ✅ Langkah-langkah
Gunakan opsi `--staged` (atau `--cached`):
```bash
git diff --staged
```

Output akan menampilkan diff hijau/merah dari perubahan yang sudah masuk ke antrean commit.

## 🔗 Lihat juga
[72-lihat-perubahan-baris-git-diff.md](72-lihat-perubahan-baris-git-diff.md), [52-batalkan-git-add-tanpa-buang-editan.md](../06-undo-perbaikan/52-batalkan-git-add-tanpa-buang-editan.md)
