# Cara Gabungkan Branch Fitur dengan Git Merge

## 🎯 Kapan dipakai
Pakai ini saat kamu ingin menggabungkan satu branch fitur ke branch aktif secara lokal melalui terminal (sebelum atau tanpa Pull Request).

## ✅ Langkah-langkah
1. Pindah ke branch tujuan (misal `main`):
   ```bash
   git checkout main
   ```
2. Gabungkan branch fitur:
   ```bash
   git merge <nama-branch-fitur>
   ```
3. Push hasil penggabungan ke GitHub:
   ```bash
   git push origin main
   ```

## ⚠️ Hati-hati
Pada proyek tim, utamakan penggabungan melalui mekanisme **Pull Request (PR)** di GitHub agar ada jejak rekam *code review* antar anggota kelompok.

## 🔗 Lihat juga
[21-bikin-pull-request.md](../03-kolaborasi-pull-request/21-bikin-pull-request.md), [31-baca-dan-selesaikan-konflik-saat-merge.md](../04-konflik/31-baca-dan-selesaikan-konflik-saat-merge.md)
