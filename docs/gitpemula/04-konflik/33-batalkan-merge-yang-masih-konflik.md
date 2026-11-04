# Cara Batalkan Merge yang Masih Konflik

## 🎯 Kapan dipakai
Pakai ini saat kamu sedang melakukan merge atau pull, lalu terjadi konflik yang terlalu rumit atau membingungkan, dan kamu ingin membatalkan proses merge serta mengembalikan kodemu persis seperti sebelum perintah merge dijalankan.

## 📝 Istilah penting
- `--abort`: opsi untuk membatalkan operasi Git yang sedang macet di tengah jalan.

## ✅ Langkah-langkah
1. Jalankan perintah batalkan merge:

   ```bash
   git merge --abort
   ```

2. Jika kamu sedang di tengah proses `pull --rebase`:

   ```bash
   git rebase --abort
   ```

## 🔍 Cara cek berhasil
Status repositori kembali bersih:
Tanda `(main|MERGING)` atau `(branch|MERGING)` di prompt terminal akan hilang, dan `git status` kembali normal.

## 🔗 Lihat juga
[31-baca-dan-selesaikan-konflik-saat-merge.md](31-baca-dan-selesaikan-konflik-saat-merge.md)
