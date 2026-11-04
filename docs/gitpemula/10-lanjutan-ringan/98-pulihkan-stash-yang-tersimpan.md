# Cara Pulihkan Stash yang Tersimpan

## 🎯 Kapan dipakai
Pakai ini saat kamu menyimpan perubahan sementara dengan `git stash` beberapa waktu lalu, dan sekarang ingin menerapkannya kembali.

## ✅ Langkah-langkah
- **Melihat daftar laci stash yang ada**:
  ```bash
  git stash list
  ```
- **Menerapkan dan langsung menghapus stash paling atas**:
  ```bash
  git stash pop
  ```
- **Menerapkan stash tertentu tanpa menghapusnya dari daftar**:
  ```bash
  git stash apply stash@{1}
  ```
- **Membersihkan seluruh isi laci stash**:
  ```bash
  git stash clear
  ```

## 🔗 Lihat juga
[59-simpan-perubahan-sementara-dengan-stash.md](../06-undo-perbaikan/59-simpan-perubahan-sementara-dengan-stash.md)
