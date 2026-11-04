# Cara Simpan Update README Tanpa Mengganggu Branch Kerja

## 🎯 Kapan dipakai
Pakai ini saat kamu sedang berada di tengah-tengah pengerjaan fitur besar, lalu ingin segera memperbaiki salah ketik atau dokumentasi di `README.md` langsung ke branch `main`.

## ✅ Langkah-langkah
1. Amankan pekerjaan fiturmu terlebih dahulu:
   ```bash
   git stash
   ```
2. Pindah ke `main` dan tarik update:
   ```bash
   git checkout main
   git pull origin main
   ```
3. Edit file `README.md`, lalu commit:
   ```bash
   git add README.md
   git commit -m "docs: perbaiki panduan di README"
   git push origin main
   ```
4. Kembali ke branch fiturmu dan lanjutkan coding:
   ```bash
   git checkout <branch-fitur>
   git stash pop
   ```

## 🔗 Lihat juga
[59-simpan-perubahan-sementara-dengan-stash.md](../06-undo-perbaikan/59-simpan-perubahan-sementara-dengan-stash.md)
