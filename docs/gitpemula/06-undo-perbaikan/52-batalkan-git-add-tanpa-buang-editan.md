# Cara Batalkan Git Add Tanpa Membuang Editan

## 🎯 Kapan dipakai
Pakai ini saat kamu menjalankan `git add .` atau memasukkan file ke staging area (*Changes to be committed*), tetapi sadar ada file yang belum ingin dimasukkan ke dalam commit ini.

## ✅ Langkah-langkah
- **Untuk satu file tertentu**:
  ```bash
  git restore --staged <nama-file>
  ```
- **Untuk mengeluarkan semua file dari staging**:
  ```bash
  git restore --staged .
  ```

## 🔍 Cara cek berhasil
Ketik `git status`. File tersebut berpindah dari zona hijau (*Changes to be committed*) kembali ke zona merah (*Changes not staged for commit*), dan isi ketikan kodemu tetap utuh tidak terhapus.

## 🔗 Lihat juga
[51-batalkan-perubahan-belum-di-add.md](51-batalkan-perubahan-belum-di-add.md)
