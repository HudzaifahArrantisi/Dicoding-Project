# Cara Lanjutkan Pekerjaan Setelah Konflik Selesai

## 🎯 Kapan dipakai
Pakai ini setelah kamu selesai mengedit semua file yang berkonflik dan ingin memverifikasi bahwa proyek kembali normal sebelum lanjut mengetik kode baru.

## ✅ Langkah-langkah
1. Pastikan status Git sudah bersih:
   ```bash
   git status
   ```
2. Jalankan typecheck proyek:
   ```bash
   bun run typecheck
   ```
3. Uji dev server lokal:
   ```bash
   bun run dev
   ```
   Pastikan tidak ada error kompilasi di terminal maupun konsol browser.
4. Push hasil penyelesaian konflik ke GitHub:
   ```bash
   git push origin <nama-branch>
   ```

## 🔗 Lihat juga
[31-baca-dan-selesaikan-konflik-saat-merge.md](31-baca-dan-selesaikan-konflik-saat-merge.md), [30-pastikan-branch-siap-sebelum-merge.md](../03-kolaborasi-pull-request/30-pastikan-branch-siap-sebelum-merge.md)
