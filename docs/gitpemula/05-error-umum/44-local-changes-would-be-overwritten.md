# Cara Atasi Local Changes Would Be Overwritten

## 🎯 Kapan dipakai
Pakai ini saat kamu menjalankan `git checkout`, `git switch`, atau `git pull` dan muncul pesan:
`error: Your local changes to the following files would be overwritten by checkout:`
`Please commit your changes or stash them before you switch branches.`

## 📝 Penyebab error
Kamu memiliki editan file lokal yang belum disimpan dalam commit, dan file tersebut juga memiliki perubahan berbeda di branch tujuan.

## ✅ Solusi (Pilih salah satu)
- **Opsi 1: Simpan dalam commit (Rekomendasi)**:
  ```bash
  git add .
  git commit -m "chore: simpan perubahan sementara"
  git checkout <nama-branch-tujuan>
  ```
- **Opsi 2: Simpan di laci sementara (Stash)**:
  ```bash
  git stash
  git checkout <nama-branch-tujuan>
  # nanti saat kembali ke branch asal, kembalikan dengan: git stash pop
  ```
- **Opsi 3: Buang editan lokal (jika memang tidak terpakai)**:
  ```bash
  git restore .
  ```

## 🔗 Lihat juga
[13-pindah-branch-dengan-aman.md](../02-branch/13-pindah-branch-dengan-aman.md), [59-simpan-perubahan-sementara-dengan-stash.md](../06-undo-perbaikan/59-simpan-perubahan-sementara-dengan-stash.md)
