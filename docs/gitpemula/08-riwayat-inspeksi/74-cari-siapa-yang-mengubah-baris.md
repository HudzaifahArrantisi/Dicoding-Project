# Cara Cari Siapa yang Mengubah Baris Tertentu (Blame)

## 🎯 Kapan dipakai
Pakai ini saat menemukan baris kode yang membingungkan atau rusak, dan kamu ingin tahu siapa anggota tim yang menulis baris tersebut, pada commit apa, dan kapan dibuat.

## ✅ Langkah-langkah
Jalankan perintah `git blame`:
```bash
git blame <nama-file>
```
*Contoh membatasi hanya baris 20 sampai 35:*
```bash
git blame -L 20,35 <nama-file>
```

Setiap baris kode akan diawali dengan hash commit, nama penulis, tanggal, dan nomor baris.

## 🔗 Lihat juga
[78-lihat-riwayat-satu-file.md](78-lihat-riwayat-satu-file.md)
