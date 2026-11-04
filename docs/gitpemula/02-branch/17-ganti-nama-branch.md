# Cara Ganti Nama Branch

## 🎯 Kapan dipakai
Pakai ini saat kamu salah ketik nama branch (*typo*) atau ingin menyesuaikan nama branch agar sesuai dengan konvensi tim (contoh: dari `login` menjadi `feat-login-mitra`).

## 📝 Istilah penting
- `-m` (*move/rename*): opsi perintah Git untuk mengubah nama branch.
- Upstream: hubungan antara branch lokal dan branch di GitHub.

## ✅ Langkah-langkah

### Kasus 1: Mengubah nama branch yang sedang aktif
1. Pastikan kamu berada di branch yang ingin diganti namanya:
   ```bash
   git checkout <nama-branch-lama>
   ```

2. Ubah nama branch lokal:
   ```bash
   git branch -m <nama-branch-baru>
   ```

### Kasus 2: Jika branch sudah terlanjur di-push ke GitHub
1. Ubah nama branch lokal terlebih dahulu (langkah di atas).
2. Push branch dengan nama baru ke GitHub dan hubungkan upstream:
   ```bash
   git push -u origin <nama-branch-baru>
   ```
3. Hapus branch dengan nama lama yang ada di GitHub:
   ```bash
   git push origin --delete <nama-branch-lama>
   ```

## 🔍 Cara cek berhasil
Jalankan `git branch --show-current`. Nama yang muncul sekarang adalah nama baru yang sudah diperbaiki.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `fatal: a branch named '...' already exists` | Nama baru yang kamu pilih ternyata sudah ada. | Pilih nama lain yang belum dipakai. |

## ⚠️ Hati-hati
Jika branch sudah di-push ke GitHub dan rekan timmu sudah ikut mengambilnya, beri tahu mereka terlebih dahulu sebelum kamu mengubah nama dan menghapus nama lama di GitHub.

## 🔗 Lihat juga
[12-bikin-branch-baru-fitur.md](12-bikin-branch-baru-fitur.md), [16-hapus-branch-di-github.md](16-hapus-branch-di-github.md)
