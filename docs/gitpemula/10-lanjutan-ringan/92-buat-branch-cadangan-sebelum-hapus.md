# Cara Buat Branch Cadangan Sebelum Menghapus Branch Lama

## 🎯 Kapan dipakai
Pakai ini saat kamu ragu-ragu apakah suatu branch lama masih dibutuhkan atau tidak, dan ingin membuat salinan cadangan (*backup*) sebelum membersihkannya.

## ✅ Langkah-langkah
Buat branch baru dari branch tersebut:
```bash
git branch backup-<nama-branch> <nama-branch>
```
*Contoh:*
```bash
git branch backup-fitur-lama fitur-lama
```
Setelah itu, kamu bisa menghapus `fitur-lama` dengan tenang karena seluruh commit-nya sudah terduplikasi aman di branch `backup-fitur-lama`.

## 🔗 Lihat juga
[15-hapus-branch-lokal.md](../02-branch/15-hapus-branch-lokal.md)
