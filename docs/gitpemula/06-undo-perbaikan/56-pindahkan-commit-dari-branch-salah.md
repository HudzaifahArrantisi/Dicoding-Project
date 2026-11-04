# Cara Pindahkan Commit dari Branch yang Salah

## 🎯 Kapan dipakai
Pakai ini saat kamu berniat mengerjakan fitur baru, tetapi lupa membuat branch dan telanjur membuat 1 atau 2 commit di branch yang salah (misal di `main`).

## ✅ Langkah-langkah
1. Dari branch saat ini, langsung buat branch fitur baru (commit akan otomatis ikut):
   ```bash
   git branch <nama-branch-fitur-baru>
   ```
2. Mundurkan posisi branch saat ini (misal `main`) ke sebelum commit yang salah:
   ```bash
   git reset --hard HEAD~1
   ```
3. Pindah ke branch fitur baru:
   ```bash
   git checkout <nama-branch-fitur-baru>
   ```

## 🔍 Cara cek berhasil
Branch `main` bersih kembali seperti semula, sementara commit pekerjaanmu kini berada rapi di `<nama-branch-fitur-baru>`.

## 🔗 Lihat juga
[57-buat-branch-setelah-telanjur-edit-di-main.md](57-buat-branch-setelah-telanjur-edit-di-main.md)
