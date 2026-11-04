# Cara Selesaikan Konflik saat Cherry-Pick

## 🎯 Kapan dipakai
Pakai ini saat kamu mengambil satu commit tertentu dari branch lain dengan `git cherry-pick <hash>`, namun baris kodenya bentrok dengan branch saat ini.

## ✅ Langkah-langkah
1. Terminal memunculkan peringatan konflik cherry-pick.
2. Buka file yang berkonflik, tentukan baris kode yang benar, dan buang penanda konflik `<<< === >>>`.
3. Tandai file sudah beres:
   ```bash
   git add <nama-file>
   ```
4. Lanjutkan cherry-pick:
   ```bash
   git cherry-pick --continue
   ```
5. *(Jika ingin membatalkan sama sekali):*
   ```bash
   git cherry-pick --abort
   ```

## 🔗 Lihat juga
[93-ambil-satu-commit-cherry-pick.md](../10-lanjutan-ringan/93-ambil-satu-commit-cherry-pick.md), [99-batalkan-cherry-pick-konflik.md](../10-lanjutan-ringan/99-batalkan-cherry-pick-konflik.md)
