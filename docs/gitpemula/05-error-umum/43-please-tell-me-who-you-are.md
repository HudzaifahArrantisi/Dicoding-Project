# Cara Atasi Pesan Please Tell Me Who You Are

## 🎯 Kapan dipakai
Pakai ini saat kamu menjalankan `git commit` lalu muncul pesan penolakan:
`Author identity unknown`
`*** Please tell me who you are.`
`Run: git config --global user.email "you@example.com"`

## 📝 Penyebab error
Git belum mengetahui nama dan alamat emailmu untuk dicatat sebagai penulis commit.

## ✅ Langkah-langkah
Jalankan dua perintah konfigurasi global ini di terminal:
```bash
git config --global user.name "Nama Lengkapmu"
git config --global user.email "email-github-kamu@example.com"
```
Setelah itu, ulangi kembali perintah `git commit` kamu.

## 🔗 Lihat juga
[01-install-dan-setup-git.md](../01-setup-dasar/01-install-dan-setup-git.md)
