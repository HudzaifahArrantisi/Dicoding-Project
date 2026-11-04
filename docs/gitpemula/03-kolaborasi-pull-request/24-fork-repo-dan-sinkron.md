# Cara Fork Repo dan Menjaga Sinkronisasi dengan Repo Asli

## 🎯 Kapan dipakai
Pakai ini saat kamu berkontribusi ke repository organisasi atau open-source yang tidak memberikan izin *direct push*, sehingga kamu harus membuat salinan (*fork*) ke akun GitHub pribadimu terlebih dahulu.

## 📝 Istilah penting
- Fork: salinan repository orang lain/organisasi ke akun GitHub pribadimu.
- Upstream: sebutan konvensi untuk repository asli milik pembuat utama.
- Origin: repository fork di akun GitHub pribadimu.

## ✅ Langkah-langkah
1. Buka repo asli di GitHub, klik tombol **Fork** di pojok kanan atas, lalu clone repo hasil fork ke laptopmu:
   ```bash
   git clone https://github.com/<username-kamu>/<nama-repo>.git
   cd <nama-repo>
   ```

2. Tambahkan alamat remote repo asli sebagai `upstream`:
   ```bash
   git remote add upstream https://github.com/<organisasi-asli>/<nama-repo>.git
   ```

3. Cek kedua remote:
   ```bash
   git remote -v
   ```

4. Cara mengambil update terbaru dari repo asli kapan saja:
   ```bash
   git checkout main
   git fetch upstream
   git merge upstream/main
   git push origin main
   ```

## 🔍 Cara cek berhasil
Perintah `git remote -v` menampilkan dua remote yang berbeda: `origin` (akunmu) dan `upstream` (repo asli).

## 🔗 Lihat juga
[86-tambah-remote-repo-asli-setelah-fork.md](../09-remote-akun/86-tambah-remote-repo-asli-setelah-fork.md)
