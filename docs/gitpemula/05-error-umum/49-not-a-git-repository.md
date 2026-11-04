# Cara Atasi Not a Git Repository

## 🎯 Kapan dipakai
Pakai ini saat kamu menjalankan perintah Git apapun di terminal lalu langsung muncul pesan error:
`fatal: not a git repository (or any of the parent directories): .git`

## 📝 Penyebab error
Terminalmu sedang membuka folder yang bukan merupakan repository Git (tidak ada folder tersembunyi `.git`), atau kamu membuka terminal di folder luar/salah.

## ✅ Langkah-langkah
1. Cek folder tempatmu berada saat ini:
   ```bash
   pwd    # di Linux/Mac/Git Bash
   # atau
   cd     # di CMD/PowerShell
   ```
2. Pindah ke dalam folder proyek yang benar:
   ```bash
   cd c:/laragon/www/daisuki-inventory
   ```
3. Cek kembali:
   ```bash
   git status
   ```

## 🔗 Lihat juga
[09-temukan-folder-repo.md](../01-setup-dasar/09-temukan-folder-repo.md)
