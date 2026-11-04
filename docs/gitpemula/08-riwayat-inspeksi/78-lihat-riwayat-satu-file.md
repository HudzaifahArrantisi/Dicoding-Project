# Cara Lihat Riwayat Satu File Tertentu

## 🎯 Kapan dipakai
Pakai ini saat kamu ingin melihat jejak masa lalu hanya pada satu file spesifik (siapa saja yang mengeditnya sejak awal proyek dibuat).

## ✅ Langkah-langkah
Jalankan git log diikuti tanda `--` dan nama file:
```bash
git log --oneline -- <path/ke/nama-file>
```
*Contoh:*
```bash
git log --oneline -5 -- apps/web/src/routes/mitra.tsx
```

## 🔗 Lihat juga
[74-cari-siapa-yang-mengubah-baris.md](74-cari-siapa-yang-mengubah-baris.md)
