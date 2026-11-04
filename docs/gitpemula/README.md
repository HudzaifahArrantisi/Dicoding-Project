# Panduan Git untuk Pemula

Panduan ini disusun sebagai 10 kategori, masing-masing berisi 10 masalah. Buka kategori yang sesuai, lalu pilih satu masalah. Tim bekerja lewat branch fitur dan Pull Request; perubahan digabung dengan `git merge`, tanpa push langsung ke `main`.

| Kategori | Isi | Status |
|---|---|---|
| [01 Setup & Dasar](01-setup-dasar/) | Memasang Git, menyalin repo, menyimpan perubahan, dan membaca hasil perintah. | 10/10 panduan |
| [02 Branch](02-branch/) | Membuat, berpindah, memperbarui, dan menghapus branch. | 10/10 panduan |
| [03 Kolaborasi & Pull Request](03-kolaborasi-pull-request/) | Mengirim pekerjaan untuk ditinjau dan bekerja bersama tim. | 10/10 panduan |
| [04 Konflik](04-konflik/) | Membaca, menyelesaikan, dan mencegah perubahan yang bentrok. | 10/10 panduan |
| [05 Error Umum](05-error-umum/) | Memahami pesan error Git yang paling sering membuat bingung. | 10/10 panduan |
| [06 Undo & Perbaikan](06-undo-perbaikan/) | Membetulkan perubahan dan commit yang keliru. | 10/10 panduan |
| [07 File & Keamanan](07-file-keamanan/) | Mengatur file yang dilacak Git dan menangani rahasia yang terunggah. | 10/10 panduan |
| [08 Riwayat & Inspeksi](08-riwayat-inspeksi/) | Melihat commit, membandingkan perubahan, dan mencari asal sebuah baris. | 10/10 panduan |
| [09 Remote & Akun](09-remote-akun/) | Mengatur alamat GitHub, akses, dan beberapa akun. | 10/10 panduan |
| [10 Lanjutan Ringan](10-lanjutan-ringan/) | Tag, cherry-pick, dan pekerjaan lanjutan yang sering dibutuhkan tim. | 10/10 panduan |

## 01 Setup & Dasar

- [01 Memasang Git dan mengatur identitas](01-setup-dasar/01-install-dan-setup-git.md): pakai ini saat Git baru dipasang atau commit meminta nama dan email.
- [02 Clone repo GitHub](01-setup-dasar/02-clone-repo-github.md): pakai ini saat mulai bekerja dari proyek tim yang sudah ada.
- [03 Membuat repo baru](01-setup-dasar/03-bikin-repo-baru.md): pakai ini saat proyek lokal belum terhubung ke GitHub.
- [04 Membaca status](01-setup-dasar/04-baca-git-status.md): pakai ini saat bingung melihat file yang berubah.
- [05 Menambah, commit, dan push](01-setup-dasar/05-tambah-commit-push.md): pakai ini saat ingin mengirim pekerjaan di branch fitur.
- [06 Push pertama branch](01-setup-dasar/06-push-pertama-branch.md): pakai ini saat branch baru belum punya tujuan push.
- [07 Mengambil update](01-setup-dasar/07-ambil-update-terbaru.md): pakai ini saat branch aktif perlu commit terbaru dari GitHub.
- [08 Fetch dan pull](01-setup-dasar/08-beda-fetch-dan-pull.md): pakai ini saat ingin memilih antara melihat update dan menggabungkannya.
- [09 Menemukan folder repo](01-setup-dasar/09-temukan-folder-repo.md): pakai ini saat terminal terasa berada di folder yang salah.
- [10 Mencari bantuan Git](01-setup-dasar/10-cari-bantuan-perintah-git.md): pakai ini saat ingin memeriksa cara pakai sebuah perintah.

## 02 Branch

- [11 Cek branch lokal dan GitHub](02-branch/11-cek-branch-lokal-dan-github.md): pakai ini saat ingin melihat daftar branch aktif dan yang ada di GitHub.
- [12 Bikin branch baru untuk fitur](02-branch/12-bikin-branch-baru-fitur.md): pakai ini saat akan mulai mengerjakan tugas/fitur baru.
- [13 Pindah branch dengan aman](02-branch/13-pindah-branch-dengan-aman.md): pakai ini saat ingin berganti branch tanpa menghilangkan editan.
- [14 Ambil update terbaru main ke branch kerja](02-branch/14-ambil-update-terbaru-main-ke-branch.md): pakai ini saat branch fitur perlu diselaraskan dengan commit baru di `main`.
- [15 Hapus branch lokal yang sudah selesai](02-branch/15-hapus-branch-lokal.md): pakai ini saat fitur sudah di-merge dan ingin merapikan branch di laptop.
- [16 Hapus branch di GitHub](02-branch/16-hapus-branch-di-github.md): pakai ini setelah PR berhasil di-merge dan ingin membersihkan branch remote.
- [17 Ganti nama branch](02-branch/17-ganti-nama-branch.md): pakai ini saat ada salah ketik nama branch lokal atau remote.
- [18 Ambil branch teman dari GitHub](02-branch/18-ambil-branch-teman-dari-github.md): pakai ini saat ingin ikut masuk dan mengedit branch yang dibuat rekan tim.
- [19 Bersihkan daftar branch GitHub (prune)](02-branch/19-bersihkan-daftar-branch-github.md): pakai ini saat branch yang sudah dihapus di GitHub masih muncul di terminal.
- [20 Kembali ke branch sebelumnya](02-branch/20-kembali-ke-branch-sebelumnya.md): pakai ini untuk bolak-balik ke branch terakhir secara instan.

## 03 Kolaborasi & Pull Request

- [21 Bikin Pull Request](03-kolaborasi-pull-request/21-bikin-pull-request.md): pakai ini saat pekerjaan branch fitur siap diajukan untuk digabung ke `main`.
- [22 Review dan merge Pull Request](03-kolaborasi-pull-request/22-review-dan-merge-pull-request.md): pakai ini saat meninjau dan menggabungkan PR rekan tim.
- [23 Perbarui repo lokal setelah PR digabung](03-kolaborasi-pull-request/23-perbarui-repo-lokal-setelah-pr-digabung.md): pakai ini agar branch `main` di laptopmu sinkron setelah PR merge.
- [24 Fork repo dan sinkron](03-kolaborasi-pull-request/24-fork-repo-dan-sinkron.md): pakai ini saat berkontribusi lewat mekanisme fork dan upstream.
- [25 Kerja bersama satu file](03-kolaborasi-pull-request/25-kerja-bersama-satu-file.md): tips dan cara mencegah konflik saat mengedit file yang sama dengan rekan tim.
- [26 Minta review dari rekan tim](03-kolaborasi-pull-request/26-minta-review-dari-rekan-tim.md): cara menugaskan reviewer di GitHub.
- [27 Perbaiki kode setelah komentar review](03-kolaborasi-pull-request/27-perbaiki-kode-setelah-review.md): cara mengirim perbaikan tanpa perlu menutup atau membuat PR baru.
- [28 Batalkan Pull Request belum digabung](03-kolaborasi-pull-request/28-batalkan-pull-request-belum-digabung.md): cara menutup PR yang dibatalkan.
- [29 Tulis deskripsi Pull Request](03-kolaborasi-pull-request/29-tulis-deskripsi-pull-request.md): panduan dan template deskripsi PR yang rapi dan mudah dicek.
- [30 Pastikan branch siap sebelum meminta merge](03-kolaborasi-pull-request/30-pastikan-branch-siap-sebelum-merge.md): checklist wajib sebelum menekan tombol pengajuan merge.

## 04 Konflik

- [31 Membaca dan menyelesaikan konflik merge](04-konflik/31-baca-dan-selesaikan-konflik-saat-merge.md): panduan mengatasi baris kode yang bentrok saat merge.
- [32 Selesaikan konflik saat pull](04-konflik/32-selesaikan-konflik-saat-pull.md): cara menyelesaikan konflik yang muncul sehabis `git pull`.
- [33 Batalkan merge yang masih konflik](04-konflik/33-batalkan-merge-yang-masih-konflik.md): cara membatalkan merge yang macet dan mengembalikan status ke semula.
- [34 Cegah konflik sebelum mulai mengubah kode](04-konflik/34-cegah-konflik-sebelum-mulai-kode.md): kebiasaan kerja agar jarang terkena konflik.
- [35 Kenali penanda konflik dalam file](04-konflik/35-kenali-penanda-konflik-dalam-file.md): memahami arti `<<<<<<<`, `=======`, dan `>>>>>>>`.
- [36 Selesaikan konflik ketika file dihapus dan diubah](04-konflik/36-selesaikan-konflik-file-dihapus-dan-diubah.md): menyelesaikan konflik modify/delete.
- [37 Selesaikan konflik saat cherry-pick](04-konflik/37-selesaikan-konflik-saat-cherry-pick.md): cara melanjutkan cherry-pick yang membentur baris kode.
- [38 Pastikan tidak ada penanda konflik tertinggal](04-konflik/38-pastikan-tidak-ada-penanda-konflik-tertinggal.md): cek bersih sebelum commit agar tidak merusak build.
- [39 Minta bantuan tim saat pilihan tidak jelas](04-konflik/39-minta-bantuan-tim-saat-konflik-tidak-jelas.md): koordinasi kode bersama rekan tim saat buntu.
- [40 Lanjutkan pekerjaan setelah konflik selesai](04-konflik/40-lanjutkan-pekerjaan-setelah-konflik-selesai.md): verifikasi kesehatan proyek setelah konflik selesai.

## 05 Error Umum

- [41 Atasi push ditolak karena non-fast-forward](05-error-umum/41-push-ditolak-non-fast-forward.md): solusi saat push ditolak karena ada commit baru di GitHub.
- [42 Atasi pesan no upstream branch](05-error-umum/42-no-upstream-branch.md): cara menghubungkan branch lokal pertama kali saat push.
- [43 Atasi pesan Please tell me who you are](05-error-umum/43-please-tell-me-who-you-are.md): setup nama dan email commit yang belum lengkap.
- [44 Atasi local changes would be overwritten](05-error-umum/44-local-changes-would-be-overwritten.md): solusi saat pindah branch/pull terhalang editan lokal.
- [45 Keluar dari detached HEAD dengan aman](05-error-umum/45-keluar-dari-detached-head.md): menyelamatkan commit saat berada di kondisi tanpa branch.
- [46 Atasi divergent branches saat pull](05-error-umum/46-divergent-branches-saat-pull.md): menentukan strategi penggabungan standar saat pull.
- [47 Atasi refusing to merge unrelated histories](05-error-umum/47-refusing-to-merge-unrelated-histories.md): menyatukan dua repo awal yang terpisah.
- [48 Atasi file terlalu besar ditolak GitHub](05-error-umum/48-file-terlalu-besar-ditolak-github.md): cara membatalkan dan mengeluarkan file >100MB dari commit.
- [49 Atasi not a git repository](05-error-umum/49-not-a-git-repository.md): memastikan lokasi direktori terminal yang tepat.
- [50 Cari sebab nothing to commit padahal sudah edit](05-error-umum/50-nothing-to-commit-padahal-sudah-edit.md): 4 penyebab umum status bersih meski sudah mengubah file.

## 06 Undo & Perbaikan

- [51 Batalkan perubahan file yang belum di-add](06-undo-perbaikan/51-batalkan-perubahan-belum-di-add.md): membuang editan salah pada file yang belum masuk staging.
- [52 Batalkan git add tanpa membuang editan](06-undo-perbaikan/52-batalkan-git-add-tanpa-buang-editan.md): mengeluarkan file dari staging tanpa menghapus ketikan kode.
- [53 Ubah pesan commit terakhir](06-undo-perbaikan/53-ubah-pesan-commit-terakhir.md): mengganti teks pesan commit terakhir dengan amend.
- [54 Batalkan commit terakhir belum di-push](06-undo-perbaikan/54-batalkan-commit-terakhir-belum-dipush.md): membatalkan commit dengan reset soft agar kode tetap utuh.
- [55 Balikkan commit yang sudah di-push dengan revert](06-undo-perbaikan/55-balikkan-commit-sudah-dipush-dengan-revert.md): membatalkan perubahan di branch tim secara aman.
- [56 Pindahkan commit dari branch yang salah](06-undo-perbaikan/56-pindahkan-commit-dari-branch-salah.md): memindahkan commit yang telanjur dibuat di branch yang tidak sesuai.
- [57 Buat branch setelah telanjur mengedit di main](06-undo-perbaikan/57-buat-branch-setelah-telanjur-edit-di-main.md): menyelamatkan editan di main langsung ke branch baru.
- [58 Pulihkan commit dengan reflog](06-undo-perbaikan/58-pulihkan-commit-dengan-reflog.md): mengembalikan commit yang tidak sengaja terhapus.
- [59 Simpan perubahan sementara dengan stash](06-undo-perbaikan/59-simpan-perubahan-sementara-dengan-stash.md): menyimpan editan separuh jalan saat harus pindah branch darurat.
- [60 Tambah file yang tertinggal ke commit terakhir](06-undo-perbaikan/60-tambah-file-tertinggal-ke-commit-terakhir.md): menyatukan file susulan ke commit sebelumnya tanpa membuat commit baru.

## 07 File & Keamanan

- [61 Pilih file yang masuk .gitignore](07-file-keamanan/61-pilih-file-masuk-gitignore.md): daftar wajib file dan folder yang tidak boleh di-commit.
- [62 Berhenti melacak file yang sudah ter-commit](07-file-keamanan/62-berhenti-melacak-file-sudah-tercommit.md): menghapus file dari tracking tanpa menghapus file di laptop.
- [63 Tangani password atau .env yang telanjur ter-push](07-file-keamanan/63-tangani-password-atau-env-telanjur-terpush.md): tindakan darurat saat credential bocor ke GitHub.
- [64 Hapus file dari repo dan folder sekaligus](07-file-keamanan/64-hapus-file-dari-repo-dan-folder.md): menghapus file kode lama secara permanen.
- [65 Hapus file dari repo tetapi tetap simpan di komputer](07-file-keamanan/65-hapus-file-dari-repo-simpan-di-komputer.md): membuang file dari GitHub namun tetap menyimpannya lokal.
- [66 Lihat file yang diabaikan Git](07-file-keamanan/66-lihat-file-diabaikan-git.md): mengecek file apa saja yang diabaikan oleh .gitignore.
- [67 Tambah aturan .gitignore untuk satu folder](07-file-keamanan/67-tambah-aturan-gitignore-satu-folder.md): cara mengabaikan folder upload atau cache model.
- [68 Periksa file sebelum git add](07-file-keamanan/68-periksa-file-sebelum-git-add.md): membiasakan pengecekan diff sebelum memasukkan ke staging.
- [69 Pulihkan file yang tidak sengaja terhapus](07-file-keamanan/69-pulihkan-file-tidak-sengaja-terhapus.md): mengembalikan file terhapus dengan restore.
- [70 Hindari commit file hasil build dan cache](07-file-keamanan/70-hindari-commit-file-build-dan-cache.md): menjaga ukuran repository tetap bersih dan ringan.

## 08 Riwayat & Inspeksi

- [71 Lihat riwayat commit](08-riwayat-inspeksi/71-lihat-riwayat-commit.md): melihat daftar commit dengan oneline dan graph visual.
- [72 Lihat perubahan baris dengan git diff](08-riwayat-inspeksi/72-lihat-perubahan-baris-git-diff.md): memeriksa baris hijau/merah sebelum staging.
- [73 Lihat isi satu commit tertentu](08-riwayat-inspeksi/73-lihat-isi-satu-commit.md): memeriksa detail perubahan pada suatu hash commit.
- [74 Cari siapa yang mengubah baris tertentu (blame)](08-riwayat-inspeksi/74-cari-siapa-yang-mengubah-baris.md): melacak penulis kode baris per baris.
- [75 Bandingkan dua branch](08-riwayat-inspeksi/75-bandingkan-dua-branch.md): melihat perbedaan file dan baris antara dua branch.
- [76 Lihat commit yang belum masuk ke main](08-riwayat-inspeksi/76-lihat-commit-belum-masuk-main.md): daftar commit unik branch fitur sebelum merge.
- [77 Cari commit berdasarkan pesan](08-riwayat-inspeksi/77-cari-commit-berdasarkan-pesan.md): menyaring pencarian kata kunci commit dengan grep.
- [78 Lihat riwayat satu file tertentu](08-riwayat-inspeksi/78-lihat-riwayat-satu-file.md): mengecek sejarah commit khusus pada suatu file.
- [79 Lihat perubahan yang sudah di-add](08-riwayat-inspeksi/79-lihat-perubahan-yang-sudah-diadd.md): melihat diff file yang sudah masuk staging area.
- [80 Lihat ringkasan perubahan per commit (stat)](08-riwayat-inspeksi/80-lihat-ringkasan-perubahan-per-commit.md): informasi ringkas jumlah baris/file yang diubah.

## 09 Remote & Akun

- [81 Atasi authentication failed dan pakai Personal Access Token](09-remote-akun/81-authentication-failed-dan-token.md): solusi login terminal pasca penghapusan password oleh GitHub.
- [82 Ganti URL remote dari HTTPS ke SSH](09-remote-akun/82-ganti-url-remote-https-ke-ssh.md): beralih ke kunci SSH untuk login otomatis permanen.
- [83 Pakai dua akun GitHub di satu laptop](09-remote-akun/83-pakai-dua-akun-github-satu-laptop.md): konfigurasi identitas commit per repositori.
- [84 Atasi remote origin already exists](09-remote-akun/84-remote-origin-already-exists.md): solusi saat menambahkan remote yang namanya sudah ada.
- [85 Lihat alamat remote yang terhubung](09-remote-akun/85-lihat-alamat-remote-terhubung.md): memeriksa URL GitHub yang tersambung dengan remote -v.
- [86 Tambah remote untuk repo asli setelah fork](09-remote-akun/86-tambah-remote-repo-asli-setelah-fork.md): menyambungkan remote upstream pada repo fork.
- [87 Pastikan izin akses ke repo tim](09-remote-akun/87-pastikan-izin-akses-repo-tim.md): langkah mengundang dan menerima undangan collaborator GitHub.
- [88 Pilih antara HTTPS atau SSH untuk GitHub](09-remote-akun/88-pilih-https-atau-ssh-github.md): perbandingan kelebihan dan kekurangan dua metode koneksi.
- [89 Perbaiki URL remote yang salah](09-remote-akun/89-perbaiki-url-remote-yang-salah.md): mengoreksi typo pada alamat repository remote.
- [90 Hapus remote yang tidak dipakai](09-remote-akun/90-hapus-remote-tidak-dipakai.md): membersihkan remote usang atau cadangan.

## 10 Lanjutan Ringan

- [91 Buat tag untuk menandai versi rilis](10-lanjutan-ringan/91-buat-tag-menandai-versi.md): menandai titik rilis v1.0.0 di repositori.
- [92 Buat branch cadangan sebelum menghapus](10-lanjutan-ringan/92-buat-branch-cadangan-sebelum-hapus.md): membuat backup branch sebelum dibersihkan.
- [93 Ambil satu commit dengan cherry-pick](10-lanjutan-ringan/93-ambil-satu-commit-cherry-pick.md): memetik perbaikan commit tertentu tanpa merge seluruh branch.
- [94 Simpan update README tanpa ganggu branch](10-lanjutan-ringan/94-update-readme-tanpa-ganggu-branch.md): trik stash saat ingin cepat update dokumentasi ke main.
- [95 Lihat commit sebelum merge](10-lanjutan-ringan/95-lihat-commit-sebelum-merge.md): komparasi log commit incoming vs local.
- [96 Gabungkan branch dengan git merge](10-lanjutan-ringan/96-gabungkan-branch-dengan-git-merge.md): alur merge lokal antarcabang.
- [97 Periksa apakah branch aman dihapus](10-lanjutan-ringan/97-periksa-apakah-branch-aman-dihapus.md): mengecek branch yang sudah ter-merged sepenuhnya.
- [98 Pulihkan stash yang tersimpan](10-lanjutan-ringan/98-pulihkan-stash-yang-tersimpan.md): menerapkan kembali editan dari laci stash.
- [99 Batalkan cherry-pick yang konflik](10-lanjutan-ringan/99-batalkan-cherry-pick-konflik.md): membatalkan cherry-pick macet dengan abort.
- [100 Cheat Sheet Perintah Git Harian](10-lanjutan-ringan/100-cheat-sheet-perintah-git-harian.md): tabel sakti seluruh perintah esensial Git.








