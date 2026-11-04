# Cara Hapus Branch di GitHub (Remote)

## 🎯 Kapan dipakai
Pakai ini setelah Pull Request di GitHub berhasil digabung (*merged*) dan kamu ingin menghapus branch tersebut dari repository online GitHub agar repository tim tetap bersih.

## 📝 Istilah penting
- Remote branch: branch yang tersimpan di server GitHub (`origin`).
- `--delete`: opsi untuk memerintahkan GitHub menghapus referensi branch tersebut.

## ✅ Langkah-langkah
1. Hapus branch di GitHub lewat terminal:

   ```bash
   git push origin --delete <nama-branch>
   ```

2. *(Alternatif lewat antarmuka Web GitHub):*
   - Buka halaman Pull Request yang sudah *Merged*.
   - Klik tombol ungu **Delete branch** di bagian bawah halaman PR.

## 🔍 Cara cek berhasil
Terminal menampilkan pesan seperti:
`To https://github.com/organisasi/repo.git`
`- [deleted]         <nama-branch>`
Saat memeriksa daftar semua branch dengan `git branch -a`, branch `remotes/origin/<nama-branch>` sudah tidak ada lagi.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `error: unable to delete '...': remote ref does not exist` | Branch tersebut sudah terhapus di GitHub sebelumnya. | Sinkronkan daftar lokalmu dengan menjalankan `git fetch --prune`. |
| `remote: error: refusing to delete protected branch` | Branch tersebut dilindungi oleh aturan repository (misal `main`). | Branch utama yang diproteksi tidak boleh dihapus. Pastikan kamu hanya menghapus branch fitur. |

## ⚠️ Hati-hati
Jangan pernah menghapus branch utama (`main` / `master`) atau branch yang rekan timmu masih sedang gunakan!

## 🔗 Lihat juga
[15-hapus-branch-lokal.md](15-hapus-branch-lokal.md), [19-bersihkan-daftar-branch-github.md](19-bersihkan-daftar-branch-github.md)
