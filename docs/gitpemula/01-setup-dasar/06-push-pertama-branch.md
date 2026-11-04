# Cara Push Pertama Kali untuk Branch Baru

## 🎯 Kapan dipakai
Branch kerjamu sudah punya commit, tetapi belum pernah dikirim ke GitHub. Panduan ini juga cocok saat `git push` meminta upstream.

## 📝 Istilah penting
- Branch: cabang kerja terpisah dari `main`.
- Push: mengirim commit ke GitHub.
- Upstream: branch tujuan bawaan untuk `git push` dan `git pull` berikutnya.
- `origin`: nama singkat repo GitHub yang terhubung.

## ✅ Langkah-langkah
1. Pastikan kamu berada di branch kerja.

   ```bash
   git branch --show-current
   ```

   Perintah ini menampilkan branch aktif; contoh output: `fitur-login`. Jika yang muncul `main`, pindah dulu ke branch kerja.

2. Kirim branch sekaligus atur upstream.

   ```bash
   git push -u origin <nama-branch>
   ```

   `git push` mengirim commit. `-u` menyimpan hubungan branch lokal dengan branch di GitHub. Ganti `<nama-branch>` dengan hasil langkah 1. Contoh output: `branch 'fitur-login' set up to track 'origin/fitur-login'`. Ini berarti tujuan bawaan sudah tersimpan.

## 🔍 Cara cek berhasil

```bash
git status -sb
```

Perintah ini menampilkan branch dan upstream secara ringkas. Contoh: `## fitur-login...origin/fitur-login`. Buka branch itu di GitHub untuk memastikan commit muncul.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `src refspec ... does not match any` | Nama branch salah atau belum ada commit. | Cek `git branch --show-current`, lalu buat commit jika belum ada. |
| `Authentication failed` | GitHub menolak login. | Buka [29-authentication-failed.md](../09-remote-akun/81-authentication-failed.md). |

## ⚠️ Hati-hati
Pastikan `<nama-branch>` adalah branch kerja, bukan `main`. Tim memakai PR untuk menggabungkan perubahan ke `main`.

## 🔗 Lihat juga
[05-tambah-commit-push.md](05-tambah-commit-push.md), [28-no-upstream-branch.md](../05-error-umum/42-no-upstream-branch.md)

