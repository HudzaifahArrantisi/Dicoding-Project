# Cara Ambil Perubahan Terbaru main ke Branch Kerja

## 🎯 Kapan dipakai
Pakai ini saat kamu sedang mengerjakan branch fitur, namun rekan tim sudah melakukan merge kode baru ke branch `main`. Kamu perlu menyelaraskan branch kerjamu agar tidak tertinggal dan tidak konflik saat nantinya dibuat Pull Request.

## 📝 Istilah penting
- Sinkronisasi branch: menggabungkan commit terbaru dari branch utama ke dalam branch kerjamu.
- `git merge`: menyatukan riwayat commit dari branch sumber ke branch tujuan.
- Up-to-date: kondisi ketika branch kerjamu memiliki seluruh commit terbaru dari `main`.

## ✅ Langkah-langkah
1. Pastikan seluruh editan di branch kerjamu sudah di-commit:

   ```bash
   git status
   ```

2. Ambil update terbaru dari GitHub untuk branch `main`:

   ```bash
   git fetch origin main
   ```

3. Gabungkan perubahan `origin/main` ke branch kerjamu yang sedang aktif:

   ```bash
   git merge origin/main
   ```

4. *(Alternatif 2 langkah):* Pindah dulu ke `main`, pull, lalu kembali ke branch kerja dan merge:
   ```bash
   git checkout main
   git pull origin main
   git checkout <branch-kerjamu>
   git merge main
   ```

## 🔍 Cara cek berhasil
Terminal menampilkan pesan seperti:
`Updating a1b2c3d..e5f6g7h`
`Fast-forward` atau `Merge made by the 'ort' strategy.`
Tidak ada konflik yang menggantung.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `CONFLICT (content): Merge conflict in ...` | Ada baris kode yang sama yang diubah di `main` dan di branch kerjamu. | Buka file yang berkonflik di editor, pilih bagian kode yang benar, simpan, lalu jalankan `git add .` dan `git commit -m "merge: selesaikan konflik dari main"`. |

## ⚠️ Hati-hati
Lakukan sinkronisasi ini secara berkala, terutama sebelum kamu membuat Pull Request (PR), agar proses review tim berjalan mulus tanpa konflik.

## 🔗 Lihat juga
[07-ambil-update-terbaru.md](../01-setup-dasar/07-ambil-update-terbaru.md), [31-baca-dan-selesaikan-konflik-saat-merge.md](../04-konflik/31-baca-dan-selesaikan-konflik-saat-merge.md)
