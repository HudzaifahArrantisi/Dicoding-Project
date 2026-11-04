# Cara Cari Commit Berdasarkan Pesan (Grep)

## 🎯 Kapan dipakai
Pakai ini saat kamu ingat pernah mengerjakan fitur tertentu (misal fitur restock atau login), tetapi lupa nomor commit-nya.

## ✅ Langkah-langkah
Gunakan opsi `--grep`:
```bash
git log --oneline --grep="restock"
```

Git akan menyaring dan hanya menampilkan commit-commit yang pesannya mengandung kata `"restock"`.

## 🔗 Lihat juga
[71-lihat-riwayat-commit.md](71-lihat-riwayat-commit.md)
