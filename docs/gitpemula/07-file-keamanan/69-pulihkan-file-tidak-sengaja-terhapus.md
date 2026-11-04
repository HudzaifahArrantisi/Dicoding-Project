# Cara Pulihkan File yang Tidak Sengaja Terhapus

## 🎯 Kapan dipakai
Pakai ini saat kamu atau skrip tanpa sengaja menghapus suatu file penting dari folder kodemu, dan kamu ingin mengembalikannya seperti sedia kala dari commit Git terakhir.

## ✅ Langkah-langkah
Jalankan perintah restore:
```bash
git restore <nama-file-yang-terhapus>
```
*Atau jika ada banyak file terhapus sekaligus:*
```bash
git restore .
```

## 🔍 Cara cek berhasil
File fisik tersebut akan muncul kembali di VS Code dan folder proyekmu dengan isi utuh.

## 🔗 Lihat juga
[51-batalkan-perubahan-belum-di-add.md](../06-undo-perbaikan/51-batalkan-perubahan-belum-di-add.md)
