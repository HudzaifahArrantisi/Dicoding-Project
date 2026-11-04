# Cara Batalkan Commit Terakhir yang Belum di-Push

## 🎯 Kapan dipakai
Pakai ini saat kamu telanjur melakukan `git commit`, tetapi ingin membatalkan status commit tersebut agar file-filenya kembali ke status editan biasa di komputermu.

## ✅ Langkah-langkah
Jalankan perintah reset berstatus `--soft`:
```bash
git reset --soft HEAD~1
```

## 🔍 Cara cek berhasil
Ketik `git status`. Commit terakhir dibatalkan, namun seluruh baris kode yang kamu edit **tetap aman dan tidak hilang**, berada di area *Changes to be committed*.

## ⚠️ Hati-hati
Hindari penggunaan `--hard` (`git reset --hard HEAD~1`) kecuali kamu benar-benar berniat membuang seluruh isi kode editanmu ke tempat sampah.

## 🔗 Lihat juga
[55-balikkan-commit-sudah-dipush-dengan-revert.md](55-balikkan-commit-sudah-dipush-dengan-revert.md)
