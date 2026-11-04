# Cara Lihat Riwayat Commit

## 🎯 Kapan dipakai
Pakai ini saat kamu ingin melihat daftar pekerjaan yang sudah pernah di-commit di repositori, siapa yang membuatnya, dan kapan dibuat.

## ✅ Langkah-langkah
- **Tampilan ringkas satu baris (Paling sering dipakai)**:
  ```bash
  git log --oneline -10
  ```
- **Tampilan diagram percabangan (*graph*) yang rapi**:
  ```bash
  git log --oneline --graph --decorate -15
  ```

## 💡 Tips
Jika daftar log terlalu panjang, tekan huruf `q` pada keyboard untuk keluar dari tampilan log.

## 🔗 Lihat juga
[73-lihat-isi-satu-commit.md](73-lihat-isi-satu-commit.md), [80-lihat-ringkasan-perubahan-per-commit.md](80-lihat-ringkasan-perubahan-per-commit.md)
