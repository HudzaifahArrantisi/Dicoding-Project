# Cara Menambah Kode, Commit, dan Push ke GitHub

## 🎯 Kapan dipakai
Kamu sudah selesai mengubah kode di branch kerja dan ingin mengirimnya agar tim bisa meninjau lewat Pull Request.

## 📝 Istilah penting
- Branch: cabang kerja terpisah dari `main`.
- Staged: perubahan yang dipilih untuk commit berikutnya.
- Commit: catatan perubahan yang disimpan Git.
- Push: mengirim commit dari komputer ke GitHub.
- `origin`: nama singkat alamat repo GitHub.
- Pull Request (PR): permintaan untuk meninjau dan menggabungkan branch ke `main`.

## ✅ Langkah-langkah
1. Cek branch dan file yang berubah.

   ```bash
   git branch --show-current
   git status --short
   ```

   Baris pertama menampilkan nama branch aktif; contoh: `fitur-login`. Pastikan bukan `main`. Baris kedua menampilkan file berubah; contoh: ` M src/login.js`. Jika branch masih `main`, buat branch kerja lewat panduan 10 sebelum melanjutkan.

2. Pilih perubahan, lalu simpan sebagai commit.

   ```bash
   git add .
   git commit -m "<pesan-commit>"
   ```

   `git add .` memilih semua perubahan di folder saat ini, termasuk penghapusan file. Periksa dulu agar file rahasia tidak ikut. `git commit -m` menyimpan perubahan terpilih. Ganti `<pesan-commit>` dengan ringkasan, misalnya `feat: tambah login`. Contoh output commit: `[fitur-login a1b2c3d] feat: tambah login`.

3. Kirim branch ke GitHub.

   ```bash
   git push origin <nama-branch>
   ```

   `git push` mengirim commit ke `origin`. Ganti `<nama-branch>` dengan nama dari langkah 1. Contoh output: `* [new branch] fitur-login -> fitur-login` atau `fitur-login -> fitur-login`.

## 🔍 Cara cek berhasil

```bash
git status
```

`git status` mengecek perubahan lokal. Contoh `nothing to commit, working tree clean` berarti commit lokal sudah rapi. Untuk memastikan push, buka GitHub dan pilih branch kamu; commit terbarumu harus terlihat. Setelah itu buat PR lewat panduan 18.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `nothing to commit, working tree clean` | Tidak ada perubahan untuk commit. | Cek lokasi folder dan file lewat panduan 38. |
| `rejected (non-fast-forward)` | GitHub punya commit yang belum ada di laptopmu. | Buka [27-push-rejected.md](27-push-rejected.md). |
| `Authentication failed` | GitHub menolak kredensial. | Buka [29-authentication-failed.md](29-authentication-failed.md). |

## ⚠️ Hati-hati
`git add .` bisa memasukkan `.env` atau password. Periksa `git status --short` sebelum commit. Jangan push langsung ke `main`; kirim branch kerja lalu ajukan PR.

## 🔗 Lihat juga
[10-bikin-branch-baru.md](10-bikin-branch-baru.md), [06-push-pertama-branch.md](06-push-pertama-branch.md), [18-bikin-pull-request.md](18-bikin-pull-request.md)
