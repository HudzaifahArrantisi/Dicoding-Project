# Cara Tambah File yang Tertinggal ke Commit Terakhir

## 🎯 Kapan dipakai
Pakai ini saat kamu baru saja membuat commit, lalu tersadar: *"Waduh, ada 1 file penting yang lupa di-`git add`!"*, dan kamu tidak ingin membuat commit baru yang jelek seperti `"fix lupa file"`.

## ✅ Langkah-langkah
1. Tambahkan file yang tertinggal ke staging:
   ```bash
   git add <nama-file-yang-tertinggal>
   ```

2. Gabungkan langsung ke dalam commit terakhir tanpa mengubah pesan commit:
   ```bash
   git commit --amend --no-edit
   ```

## 🔍 Cara cek berhasil
Ketik `git log -1 --stat`. File yang tertinggal tadi kini sudah menyatu rapi di dalam commit terakhir seolah-olah kamu tidak pernah melupakannya.

## 🔗 Lihat juga
[53-ubah-pesan-commit-terakhir.md](53-ubah-pesan-commit-terakhir.md)
