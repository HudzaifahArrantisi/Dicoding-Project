# Cara Batalkan Cherry-Pick yang Konflik

## 🎯 Kapan dipakai
Pakai ini saat kamu menjalankan `git cherry-pick <hash>` lalu terjadi konflik yang terlalu rumit, dan kamu memutuskan untuk membatalkannya serta mengembalikan kondisi branch ke keadaan semula.

## ✅ Langkah-langkah
Jalankan perintah pembatalan cherry-pick:
```bash
git cherry-pick --abort
```

Git akan membersihkan seluruh perubahan konflik dan mengembalikan status repository seperti sebelum perintah cherry-pick dijalankan.

## 🔗 Lihat juga
[37-selesaikan-konflik-saat-cherry-pick.md](../04-konflik/37-selesaikan-konflik-saat-cherry-pick.md), [93-ambil-satu-commit-cherry-pick.md](93-ambil-satu-commit-cherry-pick.md)
