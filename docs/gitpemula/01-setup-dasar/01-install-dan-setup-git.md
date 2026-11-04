# Cara Memasang Git dan Mengatur Nama serta Email

## 🎯 Kapan dipakai
Pakai ini saat pertama memakai Git, atau saat commit ditolak karena nama dan email belum diatur.

## 📝 Istilah penting
- Git: alat untuk mencatat perubahan file.
- Commit: satu catatan perubahan yang disimpan Git.
- `user.name` dan `user.email`: identitas penulis yang dicatat pada commit.
- `--global`: pengaturan yang berlaku untuk semua repo Git milik akun komputermu.

## ✅ Langkah-langkah
1. Pasang Git dari [halaman resmi Git](https://git-scm.com/downloads). Di Windows, jalankan pemasang lalu buka ulang terminal. Di Mac/Linux, ikuti petunjuk sesuai sistemmu di halaman itu.

2. Cek apakah terminal sudah mengenali Git.

   ```bash
   git --version
   ```

   `git --version` menampilkan versi Git. Contoh output: `git version 2.47.0`. Angkanya boleh berbeda.

3. Atur identitas commit.

   ```bash
   git config --global user.name "<nama-kamu>"
   git config --global user.email "<email-kamu>"
   ```

   Baris pertama menyimpan nama penulis commit. Baris kedua menyimpan email penulis commit. Ganti `<nama-kamu>` dengan namamu dan `<email-kamu>` dengan email yang kamu pakai di GitHub. Kedua perintah biasanya tidak menampilkan output saat berhasil.

## 🔍 Cara cek berhasil

```bash
git config --global user.name
git config --global user.email
```

Baris pertama menampilkan nama yang tersimpan. Baris kedua menampilkan email. Contoh output: `Budi Santoso` dan `budi@example.com`.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `'git' is not recognized` / `git: command not found` | Terminal belum menemukan Git. | Selesaikan pemasangan, lalu buka terminal baru. |
| `Please tell me who you are` | Identitas commit belum lengkap. | Jalankan kedua perintah `git config` di atas. |

## ⚠️ Hati-hati

## 🔗 Lihat juga
[02-clone-repo-github.md](02-clone-repo-github.md), [30-please-tell-me-who-you-are.md](../05-error-umum/43-please-tell-me-who-you-are.md)

