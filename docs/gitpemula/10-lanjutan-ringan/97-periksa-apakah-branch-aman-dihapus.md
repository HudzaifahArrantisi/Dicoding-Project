# Cara Periksa Apakah Branch Aman untuk Dihapus

## 🎯 Kapan dipakai
Pakai ini sebelum menjalankan `git branch -d` untuk memastikan bahwa semua commit di branch tersebut sudah benar-benar masuk ke branch `main`.

## ✅ Langkah-langkah
Jalankan perintah pengecekan branch yang sudah ter-merge:
```bash
git branch --merged main
```

Daftar branch yang muncul pada output adalah branch yang **100% aman dihapus** karena seluruh perubahannya sudah ada di dalam `main`.

Sebaliknya, untuk melihat branch yang belum ter-merge:
```bash
git branch --no-merged main
```

## 🔗 Lihat juga
[15-hapus-branch-lokal.md](../02-branch/15-hapus-branch-lokal.md)
