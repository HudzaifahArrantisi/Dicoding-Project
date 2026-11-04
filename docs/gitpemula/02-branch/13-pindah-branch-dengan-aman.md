# Cara Pindah Branch dengan Aman

## 🎯 Kapan dipakai
Pakai ini saat kamu ingin berpindah dari satu branch ke branch lain (misal dari branch fitur kembali ke `main`, atau pindah ke branch fitur lain yang sudah ada).

## 📝 Istilah penting
- Checkout / Switch: proses berpindah lingkungan kerja ke branch lain.
- Uncommitted changes: perubahan file yang belum di-commit dan masih ada di area kerja (*working directory*).

## ✅ Langkah-langkah
1. Periksa status pekerjaanmu terlebih dahulu:

   ```bash
   git status
   ```

2. Pastikan tidak ada file yang belum disimpan atau menggantung. Jika ada file editan:
   - Simpan dulu dalam commit:
     ```bash
     git add .
     git commit -m "feat: simpan perubahan sementara sebelum pindah branch"
     ```
   - Atau amankan sementara dengan stash jika belum ingin di-commit:
     ```bash
     git stash
     ```

3. Pindah ke branch tujuan:

   ```bash
   git checkout <nama-branch-tujuan>
   ```

   *Atau dengan perintah Git modern:*
   ```bash
   git switch <nama-branch-tujuan>
   ```

## 🔍 Cara cek berhasil
Terminal menampilkan pesan:
`Switched to branch '<nama-branch-tujuan>'`
Ketik `git branch --show-current` untuk memastikan branch aktif sudah sesuai.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `error: Your local changes to the following files would be overwritten by checkout` | Ada perubahan file di branch saat ini yang bertabrakan dengan branch tujuan. | Commit dulu perubahanmu (`git commit -m "..."`) atau jalankan `git stash` sebelum pindah branch. |
| `error: pathspec '...' did not match any file(s) known to git` | Nama branch tujuan belum ada di komputermu. | Cek nama branch dengan `git branch -a`. Jika branch itu baru dibuat teman di GitHub, jalankan `git fetch origin` dulu. |

## ⚠️ Hati-hati
Jangan memaksakan pindah branch dengan `git checkout -f` jika kamu tidak ingin kehilangan perubahan file yang belum di-commit!

## 🔗 Lihat juga
[11-cek-branch-lokal-dan-github.md](11-cek-branch-lokal-dan-github.md), [59-simpan-perubahan-sementara-dengan-stash.md](../06-undo-perbaikan/59-simpan-perubahan-sementara-dengan-stash.md)
