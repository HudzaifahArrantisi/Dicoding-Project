# Cara Ganti URL Remote dari HTTPS ke SSH

## 🎯 Kapan dipakai
Pakai ini saat kamu lelah terus-menerus diminta memasukkan Personal Access Token saat git push, dan ingin beralih ke kunci SSH (*Secure Shell*) yang otomatis login selamanya.

## ✅ Langkah-langkah
1. Pastikan kamu sudah menambahkan SSH Key komputermu di menu *Settings -> SSH and GPG keys* di GitHub.
2. Ganti URL remote `origin`:
   ```bash
   git remote set-url origin git@github.com:<username>/<nama-repo>.git
   ```
3. Cek hasil perubahan:
   ```bash
   git remote -v
   ```

Output sekarang diawali dengan `git@github.com:`, bukan lagi `https://`.

## 🔗 Lihat juga
[85-lihat-alamat-remote-terhubung.md](85-lihat-alamat-remote-terhubung.md), [88-pilih-https-atau-ssh-github.md](88-pilih-https-atau-ssh-github.md)
