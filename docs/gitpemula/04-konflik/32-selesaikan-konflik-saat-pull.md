# Cara Selesaikan Konflik saat Pull

## 🎯 Kapan dipakai
Pakai ini saat kamu menjalankan `git pull` dan terminal memberi tahu bahwa ada perubahan dari GitHub yang bertabrakan dengan commit lokalmu.

## 📝 Istilah penting
- `git pull`: sebenarnya adalah gabungan dari dua perintah: `git fetch` diikuti dengan `git merge`. Konflik saat pull adalah konflik merge.

## ✅ Langkah-langkah
1. Terminal memunculkan pesan:
   `Automatic merge failed; fix conflicts and then commit the result.`
2. Cek file yang berkonflik:
   ```bash
   git status
   ```
3. Buka file yang berstatus `both modified` di editor kodemu.
4. Tentukan kode yang benar dan hapus seluruh penanda `<<<<<<<`, `=======`, dan `>>>>>>>`.
5. Tandai file sudah beres dan selesaikan commit:
   ```bash
   git add .
   git commit -m "merge: selesaikan konflik dari git pull"
   ```
6. Push kembali hasil penggabungan ke GitHub:
   ```bash
   git push origin <nama-branch>
   ```

## 🔗 Lihat juga
[31-baca-dan-selesaikan-konflik-saat-merge.md](31-baca-dan-selesaikan-konflik-saat-merge.md), [33-batalkan-merge-yang-masih-konflik.md](33-batalkan-merge-yang-masih-konflik.md)
