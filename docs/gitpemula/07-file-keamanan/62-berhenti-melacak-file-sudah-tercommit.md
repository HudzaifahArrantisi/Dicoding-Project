# Cara Berhenti Melacak File yang Sudah Ter-Commit

## 🎯 Kapan dipakai
Pakai ini saat sebuah file (misal `.env` atau folder `build/`) sudah telanjur ter-commit ke Git di masa lalu, lalu kamu baru menambahkan namanya ke `.gitignore`. File tersebut akan tetap terus dilacak Git sebelum kamu menghapus pelacakannya dari index cache.

## ✅ Langkah-langkah
1. Hapus pelacakan dari cache Git (file di laptopmu tetap aman dan tidak terhapus):
   ```bash
   git rm --cached <nama-file>
   ```
   *Atau untuk satu folder penuh:*
   ```bash
   git rm -r --cached <nama-folder>/
   ```
2. Pastikan file tersebut sudah tercantum di `.gitignore`.
3. Commit perubahan penghapusan pelacakan tersebut:
   ```bash
   git add .gitignore
   git commit -m "chore: berhenti melacak file rahasia dari git"
   ```

## 🔗 Lihat juga
[61-pilih-file-masuk-gitignore.md](61-pilih-file-masuk-gitignore.md), [65-hapus-file-dari-repo-simpan-di-komputer.md](65-hapus-file-dari-repo-simpan-di-komputer.md)
