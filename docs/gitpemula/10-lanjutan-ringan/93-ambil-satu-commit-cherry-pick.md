# Cara Ambil Satu Commit dari Branch Lain dengan Cherry-Pick

## 🎯 Kapan dipakai
Pakai ini saat kamu membutuhkan satu perbaikan bug penting yang ada di branch lain, tanpa ingin menggabungkan seluruh branch tersebut.

## ✅ Langkah-langkah
1. Cari nomor hash commit yang ingin diambil:
   ```bash
   git log --oneline <branch-lain> -5
   ```
2. Pindah ke branch tujuanmu:
   ```bash
   git checkout <branch-tujuan>
   ```
3. Petik commit tersebut:
   ```bash
   git cherry-pick <hash-commit>
   ```

Git akan langsung menerapkan perubahan dari commit tersebut ke branch kerjamu saat ini.

## 🔗 Lihat juga
[37-selesaikan-konflik-saat-cherry-pick.md](../04-konflik/37-selesaikan-konflik-saat-cherry-pick.md), [99-batalkan-cherry-pick-konflik.md](99-batalkan-cherry-pick-konflik.md)
