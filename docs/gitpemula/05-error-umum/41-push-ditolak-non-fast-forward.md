# Cara Atasi Push Ditolak karena Non-Fast-Forward

## 🎯 Kapan dipakai
Pakai ini saat kamu menjalankan `git push` dan terminal memunculkan pesan error:
`error: failed to push some refs to '...'`
`hint: Updates were rejected because the remote contains work that you do not have locally.`

## 📝 Penyebab error
Di GitHub sudah ada commit baru yang belum ada di komputermu (misal rekanmu baru saja push atau ada PR yang di-merge).

## ✅ Langkah-langkah
1. Ambil dan gabungkan commit dari GitHub terlebih dahulu:
   ```bash
   git pull origin <nama-branch>
   ```
2. Jika terjadi konflik, selesaikan konflik terlebih dahulu.
3. Setelah merge berhasil, push kembali pekerjaanmu:
   ```bash
   git push origin <nama-branch>
   ```

## ⚠️ Hati-hati
**JANGAN PERNAH** menggunakan `git push --force` di branch tim atau `main` karena akan menghapus commit milik rekanmu di GitHub!

## 🔗 Lihat juga
[32-selesaikan-konflik-saat-pull.md](../04-konflik/32-selesaikan-konflik-saat-pull.md)
