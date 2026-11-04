# Cara Bikin Branch Baru untuk Fitur

## 🎯 Kapan dipakai
Pakai ini saat kamu akan mulai mengerjakan tugas, fitur baru, atau perbaikan bug agar perubahan kodemu tidak langsung bercampur di branch `main`.

## 📝 Istilah penting
- Branch fitur (*feature branch*): cabang kerja mandiri untuk satu tugas tertentu (misal: `feat-login`, `adel_data`, `fix-navbar`).
- Base branch: branch acuan tempat branch baru dicabangkan (biasanya `main` yang sudah ter-update).
- `git checkout -b` / `git switch -c`: perintah untuk membuat branch baru sekaligus langsung berpindah ke dalamnya.

## ✅ Langkah-langkah
1. Pastikan kamu berada di branch `main` dan kodenya sudah paling baru:

   ```bash
   git checkout main
   git pull origin main
   ```

2. Buat branch baru sekaligus berpindah ke dalamnya:

   ```bash
   git checkout -b <nama-branch-baru>
   ```

   *Atau dengan perintah Git modern:*
   ```bash
   git switch -c <nama-branch-baru>
   ```

   Ganti `<nama-branch-baru>` dengan nama fiturmu (contoh: `adel_data` atau `fitur-restock`). Huruf kecil dan gunakan tanda hubung `-` atau garis bawah `_`, tanpa spasi.

3. Konfirmasi branch aktif:

   ```bash
   git branch --show-current
   ```

## 🔍 Cara cek berhasil
Terminal memunculkan pesan:
`Switched to a new branch '<nama-branch-baru>'`
Dan saat menjalankan `git branch --show-current`, yang muncul adalah nama branch barumu.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `fatal: a branch named '...' already exists` | Nama branch tersebut sudah pernah dibuat sebelumnya. | Pakai nama lain atau pindah ke branch tersebut dengan `git checkout <nama-branch>`. |
| `fatal: cannot create branch ... not a valid branch name` | Nama branch mengandung spasi atau karakter terlarang. | Hindari spasi, gunakan tanda strip (`-`) atau underscore (`_`). |

## ⚠️ Hati-hati
Selalu buat branch baru dari `main` yang sudah di-`pull` terbaru. Jika membuat branch baru saat masih berada di branch fitur lain yang belum selesai, kodemu akan ikut membawa perubahan dari fitur lain tersebut.

## 🔗 Lihat juga
[11-cek-branch-lokal-dan-github.md](11-cek-branch-lokal-dan-github.md), [13-pindah-branch-dengan-aman.md](13-pindah-branch-dengan-aman.md), [06-push-pertama-branch.md](../01-setup-dasar/06-push-pertama-branch.md)
