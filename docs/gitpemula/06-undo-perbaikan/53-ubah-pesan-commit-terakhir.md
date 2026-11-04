# Cara Ubah Pesan Commit Terakhir yang Belum di-Push

## 🎯 Kapan dipakai
Pakai ini saat kamu baru saja membuat commit, lalu sadar ada salah ketik (*typo*) pada pesan commit atau ingin memperjelas pesannya sebelum dikirim ke GitHub.

## ✅ Langkah-langkah
Jalankan perintah commit dengan opsi `--amend`:
```bash
git commit --amend -m "feat: pesan commit baru yang sudah diperbaiki"
```

## 🔍 Cara cek berhasil
Ketik `git log -1`. Pesan commit terakhir sudah berganti dengan teks baru yang kamu masukkan.

## ⚠️ Hati-hati
Hanya gunakan `--amend` untuk commit yang **BELUM** di-push ke GitHub.

## 🔗 Lihat juga
[60-tambah-file-tertinggal-ke-commit-terakhir.md](60-tambah-file-tertinggal-ke-commit-terakhir.md)
