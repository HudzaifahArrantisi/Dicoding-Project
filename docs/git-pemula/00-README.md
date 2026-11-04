# Panduan Git untuk Tim: Mulai dari Mana?

## 🎯 Kapan dipakai
Kamu baru memakai Git dan ingin menemukan solusi untuk satu masalah tertentu.

## 📝 Istilah penting
- Git: alat untuk mencatat perubahan file.
- GitHub: tempat menyimpan proyek Git secara daring dan bekerja bersama tim.
- Branch: cabang kerja agar perubahanmu terpisah dari pekerjaan orang lain.
- Pull Request (PR): permintaan agar perubahan di branch kamu ditinjau sebelum digabung.

## ✅ Langkah-langkah
1. Cari gejala atau tugasmu di daftar isi. Buka satu file yang paling cocok.
2. Jalankan perintah dari file itu satu per satu. Contoh perintah pertama untuk mengecek pemasangan Git:

   ```bash
   git --version
   ```

   `git --version` menampilkan versi Git. Contoh output: `git version 2.47.0`, artinya Git tersedia. Angka versimu bisa berbeda.

3. Untuk kerja tim, buat branch sendiri, kirim ke GitHub, lalu ajukan PR. Jangan kirim perubahan langsung ke `main`.

### Setup & dasar
- [01-install-dan-setup-git.md](01-install-dan-setup-git.md): pakai ini kalau Git belum terpasang atau nama dan email belum diatur.
- [02-clone-repo-github.md](02-clone-repo-github.md): pakai ini kalau mau menyalin proyek tim dari GitHub.
- [03-bikin-repo-baru.md](03-bikin-repo-baru.md): pakai ini kalau proyek lokal belum menjadi repo Git.
- [04-baca-git-status.md](04-baca-git-status.md): pakai ini kalau bingung membaca file yang berubah.
- [05-tambah-commit-push.md](05-tambah-commit-push.md): pakai ini kalau mau menyimpan dan mengirim kode.
- [06-push-pertama-branch.md](06-push-pertama-branch.md): pakai ini kalau branch baru belum terhubung ke GitHub.
- [07-ambil-update-terbaru.md](07-ambil-update-terbaru.md): pakai ini kalau mau mengambil perubahan terbaru ke branch aktif.
- [08-beda-fetch-dan-pull.md](08-beda-fetch-dan-pull.md): pakai ini kalau bingung memilih `fetch` atau `pull`.

### Branch
- [09-cek-branch.md](09-cek-branch.md): pakai ini kalau ingin melihat branch lokal dan GitHub.
- [10-bikin-branch-baru.md](10-bikin-branch-baru.md): pakai ini sebelum mengerjakan fitur baru.
- [11-pindah-branch.md](11-pindah-branch.md): pakai ini kalau ingin berpindah cabang kerja.
- [12-update-main-ke-branch.md](12-update-main-ke-branch.md): pakai ini kalau branch kerjamu perlu perubahan terbaru dari `main`.
- [13-hapus-branch-lokal.md](13-hapus-branch-lokal.md): pakai ini kalau branch lokal sudah selesai dipakai.
- [14-hapus-branch-remote.md](14-hapus-branch-remote.md): pakai ini kalau branch di GitHub sudah boleh dihapus.
- [15-rename-branch.md](15-rename-branch.md): pakai ini kalau nama branch perlu diperbaiki.
- [16-ambil-branch-teman.md](16-ambil-branch-teman.md): pakai ini kalau mau membuka branch teman dari GitHub.
- [17-bersihkan-branch-hantu.md](17-bersihkan-branch-hantu.md): pakai ini kalau daftar branch GitHub di laptop sudah usang.

### Kolaborasi & Pull Request
- [18-bikin-pull-request.md](18-bikin-pull-request.md): pakai ini kalau branch siap diminta review.
- [19-review-dan-merge-pr.md](19-review-dan-merge-pr.md): pakai ini kalau kamu bertugas meninjau dan menggabungkan PR.
- [20-update-setelah-pr-merge.md](20-update-setelah-pr-merge.md): pakai ini setelah PR masuk ke `main`.
- [21-fork-dan-sinkron.md](21-fork-dan-sinkron.md): pakai ini kalau bekerja lewat salinan repo orang lain.
- [22-kerja-bareng-satu-file.md](22-kerja-bareng-satu-file.md): pakai ini kalau dua orang perlu mengubah file yang sama.

### Konflik
- [23-selesaikan-konflik-merge.md](23-selesaikan-konflik-merge.md): pakai ini saat Git meminta pilihan perubahan yang bentrok.
- [24-konflik-saat-pull.md](24-konflik-saat-pull.md): pakai ini kalau `pull` berhenti karena konflik.
- [25-batalkan-merge-konflik.md](25-batalkan-merge-konflik.md): pakai ini kalau perlu membatalkan merge yang belum selesai.
- [26-cegah-konflik.md](26-cegah-konflik.md): pakai ini sebelum banyak orang mengubah bagian kode yang sama.

### Error umum
- [27-push-rejected.md](27-push-rejected.md): pakai ini kalau push ditolak karena GitHub lebih baru.
- [28-no-upstream-branch.md](28-no-upstream-branch.md): pakai ini kalau Git bilang branch belum punya tujuan push.
- [29-authentication-failed.md](29-authentication-failed.md): pakai ini kalau login GitHub lewat Git gagal.
- [30-please-tell-me-who-you-are.md](30-please-tell-me-who-you-are.md): pakai ini kalau identitas commit belum diatur.
- [31-local-changes-overwritten.md](31-local-changes-overwritten.md): pakai ini kalau Git menolak pindah branch atau merge demi menjaga file lokal.
- [32-detached-head.md](32-detached-head.md): pakai ini kalau Git menyebut `detached HEAD`.
- [33-divergent-branches.md](33-divergent-branches.md): pakai ini kalau `pull` meminta strategi penggabungan.
- [34-origin-already-exists.md](34-origin-already-exists.md): pakai ini kalau nama remote `origin` sudah dipakai.
- [35-unrelated-histories.md](35-unrelated-histories.md): pakai ini kalau dua repo punya riwayat awal yang berbeda.
- [36-file-terlalu-besar.md](36-file-terlalu-besar.md): pakai ini kalau GitHub menolak file besar.
- [37-not-a-git-repository.md](37-not-a-git-repository.md): pakai ini kalau perintah Git dijalankan di luar repo.
- [38-nothing-to-commit.md](38-nothing-to-commit.md): pakai ini kalau perubahanmu tidak terlihat oleh Git.

### Undo & perbaikan
- [39-batalkan-perubahan-file.md](39-batalkan-perubahan-file.md): pakai ini kalau ingin membuang edit file yang belum disiapkan.
- [40-batalkan-git-add.md](40-batalkan-git-add.md): pakai ini kalau file salah masuk daftar commit.
- [41-ubah-pesan-commit.md](41-ubah-pesan-commit.md): pakai ini kalau pesan commit terakhir salah.
- [42-batalkan-commit-belum-push.md](42-batalkan-commit-belum-push.md): pakai ini kalau commit terakhir masih hanya di laptop.
- [43-revert-commit-sudah-push.md](43-revert-commit-sudah-push.md): pakai ini kalau commit yang sudah dibagikan perlu dibalik.
- [44-commit-di-branch-salah.md](44-commit-di-branch-salah.md): pakai ini kalau commit masuk ke branch keliru.
- [45-lupa-pindah-branch.md](45-lupa-pindah-branch.md): pakai ini kalau sudah mengedit sebelum membuat branch kerja.
- [46-pulihkan-dengan-reflog.md](46-pulihkan-dengan-reflog.md): pakai ini kalau branch atau commit lokal terhapus.
- [47-simpan-sementara-stash.md](47-simpan-sementara-stash.md): pakai ini kalau editan perlu disimpan sebentar.
- [48-tambah-file-ke-commit.md](48-tambah-file-ke-commit.md): pakai ini kalau satu file tertinggal dari commit terakhir.

### File & keamanan
- [49-gitignore.md](49-gitignore.md): pakai ini kalau file lokal tertentu tidak boleh ikut commit.
- [50-berhenti-melacak-file.md](50-berhenti-melacak-file.md): pakai ini kalau file sudah telanjur dilacak Git.
- [51-rahasia-terlanjur-push.md](51-rahasia-terlanjur-push.md): pakai ini kalau password atau `.env` terlanjur terunggah.
- [52-hapus-file-di-git.md](52-hapus-file-di-git.md): pakai ini kalau file memang ingin dihapus dari repo dan folder.

### Riwayat & inspeksi
- [53-lihat-riwayat-commit.md](53-lihat-riwayat-commit.md): pakai ini kalau ingin tahu commit sebelumnya.
- [54-lihat-perubahan-diff.md](54-lihat-perubahan-diff.md): pakai ini kalau ingin melihat baris yang berubah.
- [55-lihat-isi-commit.md](55-lihat-isi-commit.md): pakai ini kalau ingin memeriksa satu commit.
- [56-cari-pengubah-baris.md](56-cari-pengubah-baris.md): pakai ini kalau ingin tahu siapa yang terakhir mengubah baris.
- [57-bandingkan-dua-branch.md](57-bandingkan-dua-branch.md): pakai ini kalau ingin membandingkan branch dengan `main`.

### Lanjutan ringan
- [58-tag-dan-backup-branch.md](58-tag-dan-backup-branch.md): pakai ini sebelum menghapus branch penting atau menandai versi.
- [59-cherry-pick-commit.md](59-cherry-pick-commit.md): pakai ini kalau hanya satu commit dari branch lain yang dibutuhkan.
- [60-ganti-url-remote.md](60-ganti-url-remote.md): pakai ini kalau alamat repo berubah atau pindah ke SSH.
- [61-dua-akun-github.md](61-dua-akun-github.md): pakai ini kalau memakai akun pribadi dan kantor.
- [62-update-readme-terpisah.md](62-update-readme-terpisah.md): pakai ini kalau ingin memperbarui dokumen tanpa mengganggu branch kerja.

### Ringkasan
- [99-cheat-sheet.md](99-cheat-sheet.md): pakai ini untuk melihat perintah harian dalam satu halaman.

## 🔍 Cara cek berhasil
Kamu menemukan file yang sesuai masalahmu. Untuk langkah teknis, ikuti bagian “Cara cek berhasil” di file tersebut.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `git: command not found` / `'git' is not recognized` | Git belum terpasang atau belum terbaca terminal. | Buka [01-install-dan-setup-git.md](01-install-dan-setup-git.md). |

## ⚠️ Hati-hati
Jangan menjalankan perintah yang belum kamu pahami, terutama yang menghapus file atau riwayat. Baca tanda ⚠️ di panduan terkait.

## 🔗 Lihat juga
[01-install-dan-setup-git.md](01-install-dan-setup-git.md), [99-cheat-sheet.md](99-cheat-sheet.md)
