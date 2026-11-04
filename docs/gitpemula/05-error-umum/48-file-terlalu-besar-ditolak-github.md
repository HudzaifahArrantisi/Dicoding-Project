# Cara Atasi File Terlalu Besar Ditolak GitHub

## 🎯 Kapan dipakai
Pakai ini saat `git push` gagal dengan pesan:
`remote: error: GH001: Large files detected.`
`remote: error: File besar.mp4 is 120.00 MB; this exceeds GitHub's file size limit of 100.00 MB`

## 📝 Penyebab error
GitHub memiliki batas maksimal ukuran satu file sebesar **100 MB**. Jika kamu memasukkan file video, zip besar, dataset raksasa, atau file `.venv`/`node_modules`, push akan ditolak secara mutlak.

## ✅ Langkah-langkah
1. Batalkan commit terakhir tanpa membuang file:
   ```bash
   git reset --soft HEAD~1
   ```
2. Keluarkan file besar dari staging:
   ```bash
   git restore --staged <nama-file-besar>
   ```
3. Daftarkan file tersebut ke dalam `.gitignore`:
   ```bash
   echo "<nama-file-besar>" >> .gitignore
   ```
4. Commit ulang file lainnya yang aman:
   ```bash
   git add .
   git commit -m "feat: commit tanpa file besar"
   git push origin <nama-branch>
   ```

## 🔗 Lihat juga
[61-pilih-file-masuk-gitignore.md](../07-file-keamanan/61-pilih-file-masuk-gitignore.md)
