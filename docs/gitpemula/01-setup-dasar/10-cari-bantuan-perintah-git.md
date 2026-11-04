# Cara Mencari Bantuan untuk Perintah Git

## 🎯 Kapan dipakai
Kamu melihat perintah Git yang belum dikenal dan ingin mengecek cara pakainya langsung dari Git.

## 📝 Istilah penting
- Opsi: tambahan pada perintah, biasanya diawali tanda `-` atau `--`.
- Help: petunjuk pemakaian yang disediakan Git.
- `status`: perintah Git untuk melihat kondisi file dan branch.

## ✅ Langkah-langkah
1. Lihat daftar perintah Git yang tersedia.

   ```bash
   git help -a
   ```

   Perintah ini menampilkan daftar nama perintah Git. Contoh potongan output: `add`, `commit`, `status`. Cari nama perintah yang ingin kamu pelajari.

2. Lihat bantuan singkat untuk satu perintah.

   ```bash
   git status -h
   ```

   Perintah ini menampilkan pilihan untuk `status`. Contoh output: `usage: git status [<options>] [--] [<pathspec>...]`. Kata `usage` menunjukkan bentuk pemakaiannya. Ganti `status` dengan perintah lain yang ingin kamu cek, misalnya `log`.

## 🔍 Cara cek berhasil

```bash
git status -h
```

Jika daftar opsi muncul, bantuan Git tersedia. Perintah bantuan tidak mengubah file proyek.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `git: '...' is not a git command` | Nama perintah salah ketik atau tidak ada. | Cek nama yang benar lewat daftar perintah pada langkah 1. |
| `'git' is not recognized` / `git: command not found` | Git belum terbaca terminal. | Buka [01-install-dan-setup-git.md](01-install-dan-setup-git.md). |

## ⚠️ Hati-hati

## 🔗 Lihat juga
[01-install-dan-setup-git.md](01-install-dan-setup-git.md), [04-baca-git-status.md](04-baca-git-status.md)

