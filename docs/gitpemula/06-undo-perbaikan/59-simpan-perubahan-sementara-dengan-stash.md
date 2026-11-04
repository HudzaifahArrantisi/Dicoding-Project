# Cara Simpan Perubahan Sementara dengan Stash

## 🎯 Kapan dipakai
Pakai ini saat kamu sedang asyik mengetik kode di tengah jalan yang belum siap di-commit, tetapi tiba-tiba harus pindah branch untuk memperbaiki hal mendesak lainnya.

## 📝 Istilah penting
- Stash: laci penyimpanan sementara di Git untuk menyimpan perubahan yang belum selesai tanpa perlu membuat commit.

## ✅ Langkah-langkah
1. Simpan perubahan ke dalam laci stash:
   ```bash
   git stash
   ```
   *(Kerjamu sekarang bersih, dan kamu bisa bebas pindah branch)*.

2. Lakukan pekerjaan lain (misal review kode teman atau cek `main`).
3. Kembali ke branch awalmu, lalu keluarkan kembali isi laci stash tadi:
   ```bash
   git stash pop
   ```

## 💡 Tips praktis
Kamu bisa memberi nama pada laci stash agar tidak tertukar:
```bash
git stash save "setengah jadi form order"
git stash list      # melihat daftar laci
git stash pop       # mengeluarkan laci paling atas
```

## 🔗 Lihat juga
[13-pindah-branch-dengan-aman.md](../02-branch/13-pindah-branch-dengan-aman.md), [98-pulihkan-stash-yang-tersimpan.md](../10-lanjutan-ringan/98-pulihkan-stash-yang-tersimpan.md)
