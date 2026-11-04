# Cara Perbaiki Kode Setelah Komentar Review

## 🎯 Kapan dipakai
Pakai ini saat reviewer memberikan masukan/kritik/permintaan perbaikan (*Request Changes*) pada Pull Request-mu. Kamu tidak perlu menutup atau membuat PR baru!

## 📝 Istilah penting
- Incremental commit: commit tambahan yang dikirimkan ke branch fitur yang sama, yang akan otomatis muncul dan memperbarui Pull Request.
- Resolve conversation: tombol di GitHub untuk menandai bahwa catatan reviewer sudah selesai ditindaklanjuti.

## ✅ Langkah-langkah
1. Pastikan kamu berada di branch fitur yang sedang di-review di komputermu:
   ```bash
   git checkout <nama-branch-fitur>
   ```

2. Buka editor kodemu dan perbaiki bagian file sesuai komentar reviewer.
3. Simpan, lakukan commit, dan push perbaikan tersebut:
   ```bash
   git add .
   git commit -m "fix: perbaiki validasi input sesuai masukan review"
   git push origin <nama-branch-fitur>
   ```

4. Buka kembali halaman Pull Request di browser GitHub:
   - Commit barumu otomatis muncul di halaman PR tersebut.
   - Klik tombol **Resolve conversation** pada komentar reviewer yang sudah kamu bereskan.
   - Balas komentar dengan sopan, misalnya: *"Sudah diperbaiki pada commit terbaru ya, mohon dicek kembali."*

## 🔍 Cara cek berhasil
Halaman PR menampilkan commit baru di daftar riwayat, dan reviewer dapat melihat perubahan baru pada tab *Files changed*.

## ⚠️ Hati-hati
Jangan pernah menutup PR lalu membuat PR baru dari awal hanya karena ada catatan revisi. Cukup lakukan commit dan push ke branch yang sama!

## 🔗 Lihat juga
[22-review-dan-merge-pull-request.md](22-review-dan-merge-pull-request.md)
