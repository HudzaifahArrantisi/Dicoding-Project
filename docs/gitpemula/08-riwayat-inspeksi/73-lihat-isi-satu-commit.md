# Cara Lihat Isi Satu Commit Tertentu

## 🎯 Kapan dipakai
Pakai ini saat kamu melihat nomor commit tertentu di `git log` dan ingin melihat detail apa saja baris kode yang diubah pada commit tersebut.

## ✅ Langkah-langkah
Jalankan perintah `git show` diikuti nomor hash commit:
```bash
git show <hash-commit>
```
*Contoh:* `git show a1b2c3d`

Jika hanya ingin melihat commit paling terakhir:
```bash
git show HEAD
```

## 🔗 Lihat juga
[71-lihat-riwayat-commit.md](71-lihat-riwayat-commit.md)
