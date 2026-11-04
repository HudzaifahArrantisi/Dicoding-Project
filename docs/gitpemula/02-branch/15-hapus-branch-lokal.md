# Cara Hapus Branch Lokal yang Sudah Selesai

## 🎯 Kapan dipakai
Pakai ini saat fitur pada branch lokal sudah berhasil di-merge ke `main` dan kamu ingin membersihkan daftar branch di komputermu agar rapi dan tidak menumpuk.

## 📝 Istilah penting
- Branch lokal: branch yang tersimpan di laptop/komputermu.
- `-d` (*delete safe*): opsi aman untuk menghapus branch yang sudah selesai di-merge.
- `-D` (*force delete*): opsi paksa untuk menghapus branch meskipun belum di-merge.

## ✅ Langkah-langkah
1. Pindah keluar dari branch yang ingin dihapus (misalnya pindah ke `main`):

   ```bash
   git checkout main
   ```

2. Hapus branch secara aman:

   ```bash
   git branch -d <nama-branch-yang-dihapus>
   ```

3. Jika Git menolak karena branch dianggap belum di-merge padahal kamu yakin ingin membuangnya (misal pekerjaan eksperimen yang dibatalkan):

   ```bash
   git branch -D <nama-branch-yang-dihapus>
   ```

## 🔍 Cara cek berhasil
Terminal memunculkan pesan:
`Deleted branch <nama-branch-yang-dihapus> (was a1b2c3d).`
Ketik `git branch` untuk memastikan branch tersebut sudah hilang dari daftar.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `error: Cannot delete branch '...' checked out at '...'` | Kamu sedang berada di dalam branch yang ingin dihapus. | Pindah dulu ke branch lain (`git checkout main`), baru hapus branch tersebut. |
| `error: The branch '...' is not fully merged` | Ada commit di branch tersebut yang belum ada di `main`. | Jika memang tidak butuh lagi, gunakan huruf kapital `-D` (`git branch -D nama-branch`). |

## ⚠️ Hati-hati
Perintah `git branch -D` (huruf kapital) bersifat permanen menghapus commit lokal yang belum digabung. Pastikan kamu benar-benar tidak membutuhkan perubahan di dalamnya lagi.

## 🔗 Lihat juga
[16-hapus-branch-di-github.md](16-hapus-branch-di-github.md), [19-bersihkan-daftar-branch-github.md](19-bersihkan-daftar-branch-github.md)
