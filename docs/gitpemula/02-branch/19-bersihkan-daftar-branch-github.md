# Cara Bersihkan Daftar Branch GitHub yang Sudah Dihapus (Prune)

## 🎯 Kapan dipakai
Pakai ini saat branch di GitHub sudah dihapus (karena sudah di-merge), tetapi saat kamu mengetik `git branch -a` di terminal komputermu, nama `origin/<nama-branch>` tersebut masih terus muncul seperti hantu (*stale tracking branch*).

## 📝 Istilah penting
- Prune: proses membersihkan referensi remote yang sudah tidak ada lagi di server GitHub.
- Tracking reference: catatan lokal Git mengenai branch apa saja yang ada di GitHub.

## ✅ Langkah-langkah
1. Jalankan perintah fetch dengan opsi `--prune`:

   ```bash
   git fetch origin --prune
   ```

   *Atau versi singkatnya:*
   ```bash
   git fetch -p
   ```

2. Periksa kembali daftar branch remote:

   ```bash
   git branch -r
   ```

3. Jika branch lokalnya juga masih ada di komputermu dan ingin dibuang sekalian:

   ```bash
   git branch -d <nama-branch>
   ```

## 🔍 Cara cek berhasil
Terminal menampilkan output seperti:
```text
- [deleted]         (none) -> origin/fitur-lama
```
Branch yang sudah terhapus di GitHub tidak akan muncul lagi di daftar `git branch -a`.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| Branch lokal masih ada setelah prune | `fetch --prune` hanya membersihkan penanda di GitHub, bukan menghapus branch di laptopmu. | Hapus branch lokal secara manual dengan `git branch -d <nama-branch>`. |

## 💡 Tips praktis
Kamu bisa mengatur agar Git selalu otomatis melakukan *prune* setiap kali kamu mengetik `git fetch` atau `git pull`:
```bash
git config --global fetch.prune true
```

## 🔗 Lihat juga
[15-hapus-branch-lokal.md](15-hapus-branch-lokal.md), [16-hapus-branch-di-github.md](16-hapus-branch-di-github.md)
