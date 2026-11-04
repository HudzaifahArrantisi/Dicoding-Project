# Cara Atasi Remote Origin Already Exists

## 🎯 Kapan dipakai
Pakai ini saat kamu menjalankan perintah:
`git remote add origin https://github.com/...`
lalu terminal memunculkan pesan error:
`error: remote origin already exists.`

## 📝 Penyebab error
Repositori lokalmu sudah memiliki remote bernama `origin` yang terpasang sebelumnya.

## ✅ Solusi
- **Jika ingin memperbarui URL ke alamat baru**:
  ```bash
  git remote set-url origin <url-repo-baru>
  ```
- **Atau hapus dulu origin lama, lalu pasang yang baru**:
  ```bash
  git remote remove origin
  git remote add origin <url-repo-baru>
  ```

## 🔗 Lihat juga
[85-lihat-alamat-remote-terhubung.md](85-lihat-alamat-remote-terhubung.md), [89-perbaiki-url-remote-yang-salah.md](89-perbaiki-url-remote-yang-salah.md)
