# Cara Pakai Dua Akun GitHub di Satu Laptop

## 🎯 Kapan dipakai
Pakai ini saat satu komputermu digunakan untuk dua akun GitHub berbeda (misalnya akun kampus/kantor dan akun pribadi), agar commit tidak tercatat atas nama akun yang salah.

## ✅ Solusi praktis (Per-Repository Config)
Daripada bingung mengubah konfigurasi global laptopmu, cukup atur nama dan email khusus di dalam folder repo proyek tersebut (tanpa bendera `--global`):

1. Masuk ke folder proyek:
   ```bash
   cd c:/laragon/www/daisuki-inventory
   ```
2. Setel identitas lokal untuk proyek ini saja:
   ```bash
   git config user.name "Nama Khusus Proyek"
   git config user.email "email-khusus-proyek@example.com"
   ```

Pengaturan ini hanya akan berlaku di folder ini, sementara folder lain di laptopmu tetap memakai akun utamamu.

## 🔗 Lihat juga
[01-install-dan-setup-git.md](../01-setup-dasar/01-install-dan-setup-git.md)
