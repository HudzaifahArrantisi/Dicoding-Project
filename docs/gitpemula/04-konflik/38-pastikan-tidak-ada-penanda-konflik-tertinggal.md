# Cara Pastikan Tidak Ada Penanda Konflik Tertinggal

## 🎯 Kapan dipakai
Pakai ini sebelum melakukan `git commit` setelah menyelesaikan konflik, untuk memastikan tidak ada simbol `<<<<<<<` atau `>>>>>>>` yang tanpa sengaja tertinggal di baris kode.

## 📝 Langkah pengecekan
1. Gunakan pencarian teks di terminal:
   ```bash
   git diff --check
   ```
   *Jika ada penanda konflik yang tertinggal, perintah ini akan mencetak nomor baris dan nama filenya secara langsung.*

2. Atau cari dengan fitur search global di VS Code:
   - Tekan `Ctrl + Shift + F`
   - Ketik: `<<<<<<<` atau `=======` atau `>>>>>>>`
   - Pastikan hasilnya **0 results**.

## 🔗 Lihat juga
[35-kenali-penanda-konflik-dalam-file.md](35-kenali-penanda-konflik-dalam-file.md), [40-lanjutkan-pekerjaan-setelah-konflik-selesai.md](40-lanjutkan-pekerjaan-setelah-konflik-selesai.md)
