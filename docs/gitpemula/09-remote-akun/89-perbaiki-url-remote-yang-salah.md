# Cara Perbaiki URL Remote yang Salah

## 🎯 Kapan dipakai
Pakai ini saat ada salah ketik (*typo*) pada URL remote GitHub (misal salah username atau salah nama repo) sehingga perintah git push selalu gagal.

## ✅ Langkah-langkah
Jalankan perintah `set-url`:
```bash
git remote set-url origin <url-repo-yang-benar>
```
*Contoh:*
```bash
git remote set-url origin https://github.com/HudzaifahArrantisi/Dicoding-Project.git
```

Cek kembali:
```bash
git remote -v
```

## 🔗 Lihat juga
[85-lihat-alamat-remote-terhubung.md](85-lihat-alamat-remote-terhubung.md)
