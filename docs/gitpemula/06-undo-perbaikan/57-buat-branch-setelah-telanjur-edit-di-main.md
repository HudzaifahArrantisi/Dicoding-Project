# Cara Buat Branch Setelah Telanjur Mengedit di main

## 🎯 Kapan dipakai
Pakai ini saat kamu sudah mengedit banyak file di komputermu, lalu baru tersadar: *"Aduh, saya masih berada di branch `main` dan belum membuat branch fitur!"* (Namun file-file tersebut **BELUM di-commit**).

## ✅ Langkah-langkah
Cukup buat branch baru dan pindah langsung ke dalamnya:
```bash
git checkout -b <nama-branch-fitur-baru>
```
*Atau:*
```bash
git switch -c <nama-branch-fitur-baru>
```

Git secara otomatis akan membawa seluruh file editanmu yang belum di-commit ke dalam branch baru tersebut tanpa merusak branch `main` sama sekali!

Setelah itu, kamu bisa commit dengan aman:
```bash
git add .
git commit -m "feat: fitur baru di branch yang benar"
```

## 🔗 Lihat juga
[12-bikin-branch-baru-fitur.md](../02-branch/12-bikin-branch-baru-fitur.md)
