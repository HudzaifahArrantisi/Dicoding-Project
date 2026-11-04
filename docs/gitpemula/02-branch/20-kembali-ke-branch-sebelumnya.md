# Cara Kembali ke Branch Sebelumnya dengan Cepat

## 🎯 Kapan dipakai
Pakai ini saat kamu sedang berada di branch fitur, lalu harus pindah sebentar ke `main` untuk mengecek sesuatu, dan ingin langsung kembali ke branch fitur tadi tanpa perlu mengetik ulang nama branch-nya yang panjang.

## 📝 Istilah penting
- Tanda hubung (`-`): shortcut khusus di Git yang berarti "branch terakhir yang saya kunjungi sebelum ini" (mirip tombol *Back* pada remote TV).
- `@{-1}`: representasi internal Git untuk referensi checkout sebelumnya.

## ✅ Langkah-langkah
1. Dari branch saat ini, langsung ketik:

   ```bash
   git checkout -
   ```

   *Atau dengan Git modern:*
   ```bash
   git switch -
   ```

2. Jika kamu mengetik `git checkout -` sekali lagi, kamu akan kembali bolak-balik ke branch sebelumnya lagi.

## 🔍 Cara cek berhasil
Terminal otomatis berpindah dan mencetak pesan:
`Switched to branch '<nama-branch-sebelumnya>'`

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `fatal: git checkout: we do not have previous branch` | Git belum mencatat riwayat perpindahan branch (misal terminal baru dibuka pertama kali). | Ketik nama branch secara manual dengan `git checkout <nama-branch>`. |

## ⚠️ Hati-hati
Pastikan file editanmu sudah bersih (sudah di-commit atau di-stash) sebelum berpindah bolak-balik antar branch.

## 🔗 Lihat juga
[13-pindah-branch-dengan-aman.md](13-pindah-branch-dengan-aman.md), [11-cek-branch-lokal-dan-github.md](11-cek-branch-lokal-dan-github.md)
