# Cara Perbarui Repo Lokal Setelah PR Digabung

## 🎯 Kapan dipakai
Pakai ini setelah sebuah Pull Request (milikmu atau milik rekan tim) berhasil di-merge ke `main` di GitHub, agar branch `main` di laptopmu ikut mendapatkan update terbaru tersebut.

## 📝 Istilah penting
- Sinkronisasi lokal: menyamakan status kode di komputer dengan kondisi server GitHub setelah penggabungan fitur.

## ✅ Langkah-langkah
1. Pindah ke branch `main`:
   ```bash
   git checkout main
   ```

2. Ambil commit terbaru dari GitHub:
   ```bash
   git pull origin main
   ```

3. Bersihkan branch fitur lokal yang sudah selesai digunakan:
   ```bash
   git branch -d <nama-branch-fitur>
   ```

4. Sinkronkan referensi branch yang sudah dihapus di GitHub:
   ```bash
   git fetch --prune
   ```

## 🔍 Cara cek berhasil
Perintah `git log -1` di branch `main` akan menampilkan commit merge terbaru dari Pull Request yang baru saja disatukan.

## 🔗 Lihat juga
[07-ambil-update-terbaru.md](../01-setup-dasar/07-ambil-update-terbaru.md), [15-hapus-branch-lokal.md](../02-branch/15-hapus-branch-lokal.md)
