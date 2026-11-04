# Cara Lihat Ringkasan Perubahan per Commit (Stat)

## 🎯 Kapan dipakai
Pakai ini saat kamu ingin melihat riwayat commit beserta informasi ringkas: berapa file yang diubah dan berapa baris kode yang ditambah/dikurangi pada tiap commit.

## ✅ Langkah-langkah
Gunakan opsi `--stat`:
```bash
git log --stat -5
```

Contoh output:
```text
commit a1b2c3d
Author: dev <dev@example.com>
Date:   Wed Nov 4 2026

apps/web/src/routes/mitra.tsx | 15 ++++++++++-----
package.json                  |  2 +-
2 files changed, 11 insertions(+), 6 deletions(-)
```

## 🔗 Lihat juga
[71-lihat-riwayat-commit.md](71-lihat-riwayat-commit.md)
