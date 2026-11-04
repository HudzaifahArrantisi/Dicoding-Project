# Cara Memastikan Branch Siap Sebelum Meminta Merge

## 🎯 Kapan dipakai
Pakai ini sebagai daftar periksa (*checklist*) sebelum kamu menekan tombol *Create Pull Request* atau meminta teman melakukan merge.

## 📝 Checklist sebelum merge
Sebelum mengajukan merge, lakukan 4 langkah penting ini di komputermu:

1. **Jalankan typecheck atau build**:
   Pastikan tidak ada error sintaks atau tipe TypeScript yang merusak build:
   ```bash
   bun run typecheck
   ```

2. **Periksa git status**:
   Pastikan tidak ada file sementara, log, atau `.env` yang tidak sengaja tertinggal:
   ```bash
   git status
   ```

3. **Tarik update terbaru dari main**:
   Pastikan branch kerjamu tidak ketinggalan zaman dari `main`:
   ```bash
   git fetch origin main
   git merge origin/main
   ```

4. **Uji aplikasi di browser**:
   Jalankan server lokal (`bun run dev`) dan pastikan fitur yang baru kamu buat benar-benar berjalan sesuai harapan.

## 🔍 Cara cek berhasil
- Perintah `bun run typecheck` keluar dengan status sukses (0 errors).
- Halaman PR di GitHub menampilkan centang hijau: *"This branch has no conflicts with the base branch"*.

## 🔗 Lihat juga
[14-ambil-update-terbaru-main-ke-branch.md](../02-branch/14-ambil-update-terbaru-main-ke-branch.md), [21-bikin-pull-request.md](21-bikin-pull-request.md)
