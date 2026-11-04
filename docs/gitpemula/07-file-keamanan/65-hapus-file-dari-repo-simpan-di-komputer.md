# Cara Hapus File dari Repo tetapi Tetap Simpan di Komputer

## 🎯 Kapan dipakai
Pakai ini saat kamu ingin sebuah file (seperti file catatan pribadi `catatan.txt` atau file setting `config.local.json`) dihapus dari repository GitHub, tetapi file aslinya tetap ingin kamu simpan di komputermu sendiri.

## ✅ Langkah-langkah
1. Gunakan opsi `--cached`:
   ```bash
   git rm --cached <nama-file>
   ```
2. Daftarkan file tersebut ke `.gitignore` agar tidak masuk lagi:
   ```bash
   echo "<nama-file>" >> .gitignore
   ```
3. Commit perubahannya:
   ```bash
   git add .gitignore
   git commit -m "chore: hapus file dari repo tanpa menghapus file lokal"
   ```

## 🔗 Lihat juga
[62-berhenti-melacak-file-sudah-tercommit.md](62-berhenti-melacak-file-sudah-tercommit.md)
