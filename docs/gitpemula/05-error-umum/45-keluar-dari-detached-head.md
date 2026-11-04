# Cara Keluar dari Detached HEAD dengan Aman

## 🎯 Kapan dipakai
Pakai ini saat prompt terminalmu menampilkan teks aneh seperti `((a1b2c3d...))` bukannya nama branch, atau muncul peringatan:
`You are in 'detached HEAD' state.`

## 📝 Penyebab error
Kamu melakukan checkout langsung ke nomor hash commit tertentu atau tag, bukan ke nama branch. Setiap commit baru yang kamu buat di kondisi ini tidak memiliki branch pelindung dan bisa hilang terhapus oleh Git.

## ✅ Langkah-langkah aman
- **Jika kamu TIDAK membuat commit baru dan hanya ingin kembali ke branch utama**:
  ```bash
  git checkout main
  ```
- **Jika kamu SUDAH telanjur membuat commit di kondisi detached HEAD dan ingin menyimpannya**:
  Buat branch baru dari titik ini:
  ```bash
  git checkout -b <nama-branch-penyelamat>
  ```
  Commit kamu kini aman tersimpan di branch baru tersebut.

## 🔗 Lihat juga
[12-bikin-branch-baru-fitur.md](../02-branch/12-bikin-branch-baru-fitur.md)
