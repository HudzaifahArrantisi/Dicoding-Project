# Cara Bikin Pull Request di GitHub

## 🎯 Kapan dipakai
Pakai ini saat pekerjaanmu di branch fitur sudah selesai, sudah di-commit, dan sudah di-push ke GitHub, lalu kamu ingin mengajukan agar kode tersebut digabungkan ke branch utama (`main`).

## 📝 Istilah penting
- Pull Request (PR): permintaan resmi untuk meninjau dan menggabungkan perubahan dari branch fitur ke branch tujuan.
- Base branch: branch tujuan penggabungan (biasanya `main`).
- Compare branch: branch fitur milikmu yang berisi perubahan baru.

## ✅ Langkah-langkah
1. Pastikan seluruh commit sudah kamu push ke GitHub:
   ```bash
   git push -u origin <nama-branch-fitur>
   ```

2. Buka repository proyek di browser GitHub.
3. Di bagian atas biasanya akan muncul banner kuning bertuliskan:
   **"<nama-branch-fitur> had recent pushes... Compare & pull request"**.
   Klik tombol hijau **Compare & pull request**.
4. Jika banner tidak muncul:
   - Klik tab **Pull requests**.
   - Klik tombol hijau **New pull request**.
   - Pilih `base: main` dan `compare: <nama-branch-fitur>`.
5. Tulis judul dan deskripsi yang jelas tentang apa yang kamu ubah/tambahkan.
6. Klik tombol hijau **Create pull request**.

## 🔍 Cara cek berhasil
Halaman PR terbuka dengan status warna hijau bertuliskan **Open**, nomor PR (misal `#12`), serta daftar commit dan perubahan file (*Files changed*).

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `Can't automatically merge` | Ada konflik antara kodemu dengan kode di `main`. | Selesaikan konflik terlebih dahulu di lokal dengan melakukan `git merge origin/main`. |
| `There isn't anything to compare` | Branch fiturmu belum memiliki commit baru dibandingkan `main`. | Pastikan kamu sudah melakukan commit dan push di branch tersebut. |

## ⚠️ Hati-hati
Jangan melakukan merge sendiri jika timmu memiliki aturan wajib *code review* atau *approval* dari anggota kelompok lain.

## 🔗 Lihat juga
[29-tulis-deskripsi-pull-request.md](29-tulis-deskripsi-pull-request.md), [30-pastikan-branch-siap-sebelum-merge.md](30-pastikan-branch-siap-sebelum-merge.md)
