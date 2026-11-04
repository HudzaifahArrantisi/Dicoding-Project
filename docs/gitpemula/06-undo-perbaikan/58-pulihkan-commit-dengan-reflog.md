# Cara Pulihkan Commit yang Hilang dengan Reflog

## 🎯 Kapan dipakai
Pakai ini saat kamu tidak sengaja menjalankan `git reset --hard` atau menghapus branch lokal, lalu panik karena merasa commit pekerjaanmu hilang selamanya. Git memiliki kotak hitam penyelamat bernama `reflog`!

## 📝 Istilah penting
- `git reflog`: buku catatan lengkap setiap pergerakan pointer HEAD di komputermu, bahkan untuk commit yang sudah "terhapus".

## ✅ Langkah-langkah
1. Lihat riwayat pergerakan HEAD:
   ```bash
   git reflog -10
   ```
   *(Cari baris sebelum kejadian fatal terjadi, misal bertuliskan `HEAD@{2}: commit: feat nama fitur`)*.

2. Kembalikan kondisi ke titik tersebut:
   ```bash
   git reset --hard HEAD@{2}
   ```
   *Atau buat branch baru di titik selamat tersebut:*
   ```bash
   git checkout -b branch-penyelamat HEAD@{2}
   ```

## 🔗 Lihat juga
[54-batalkan-commit-terakhir-belum-dipush.md](54-batalkan-commit-terakhir-belum-dipush.md)
