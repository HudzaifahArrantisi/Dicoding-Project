# Cara Balikkan Commit yang Sudah di-Push dengan Revert

## 🎯 Kapan dipakai
Pakai ini saat commit yang bermasalah atau mengandung bug sudah telanjur di-push ke GitHub dan sudah ditarik oleh anggota tim lain. Cara ini adalah cara paling aman di standar industri karena tidak merusak riwayat git.

## 📝 Istilah penting
- `git revert`: membuat satu commit baru yang isinya membalikkan (meniadakan) perubahan dari commit lama yang dituju.

## ✅ Langkah-langkah
1. Cari nomor hash commit yang ingin dibalikkan:
   ```bash
   git log --oneline -5
   ```
2. Jalankan revert terhadap hash tersebut:
   ```bash
   git revert <hash-commit>
   ```
3. Git akan membuka editor untuk pesan commit (simpan dan tutup editor).
4. Push commit pembalik ini ke GitHub:
   ```bash
   git push origin <nama-branch>
   ```

## 🔗 Lihat juga
[54-batalkan-commit-terakhir-belum-dipush.md](54-batalkan-commit-terakhir-belum-dipush.md)
