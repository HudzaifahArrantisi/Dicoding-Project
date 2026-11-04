# Cara Bandingkan Dua Branch

## 🎯 Kapan dipakai
Pakai ini saat kamu ingin melihat apa saja perbedaan kode atau file antara branch fiturmu dengan branch `main` sebelum mengajukan merge.

## ✅ Langkah-langkah
- **Melihat perbedaan kode baris per baris**:
  ```bash
  git diff main..<nama-branch-fitur>
  ```
- **Hanya melihat daftar nama file yang berbeda**:
  ```bash
  git diff --name-only main..<nama-branch-fitur>
  ```

## 🔗 Lihat juga
[76-lihat-commit-belum-masuk-main.md](76-lihat-commit-belum-masuk-main.md)
