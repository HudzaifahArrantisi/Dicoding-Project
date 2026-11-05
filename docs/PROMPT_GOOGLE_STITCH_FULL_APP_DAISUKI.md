# Prompt Google Stitch: seluruh perjalanan Daisuki Inventory

Dokumen ini untuk membuat prototipe banyak layar dalam **satu proyek Stitch**. Cakupannya: enam langkah onboarding, login, lima tab Mitra, tujuh tab Admin, serta layar detail dan keadaan penting. Setiap layar dibuat dalam versi desktop dan ponsel. Gunakan prompt utama lebih dahulu, lalu prompt kelanjutan jika Stitch berhenti sebelum semua layar selesai.

## Referensi yang sebaiknya dilampirkan

- Tangkapan layar aplikasi berjalan untuk onboarding, login, Mitra, dan Admin. Screenshot menjadi acuan susunan aktual.
- Logo resmi: `apps/web/public/icons/logo.jpg`.
- Jika Stitch dapat membaca berkas proyek, sertakan `apps/web/src/styles.css`, `apps/web/src/components/onboarding-walkthrough.tsx`, `apps/web/src/components/onboarding-motion-scenes.tsx`, `apps/web/src/routes/login.tsx`, `apps/web/src/routes/mitra.tsx`, dan `apps/web/src/routes/admin.tsx` sebagai referensi. Bila hanya menerima gambar, cukup unggah screenshot per tahap.

Catatan sumber: enam layar onboarding aktif didefinisikan di `onboarding-walkthrough.tsx`. `onboarding-motion-scenes.tsx` menyediakan variasi adegan interaktif, tetapi tidak diimpor oleh walkthrough aktif. Gunakan file kedua sebagai inspirasi gerak dan artefak visual, bukan alasan menambah langkah onboarding.

## Prompt utama, salin utuh ke Google Stitch

```text
Kamu adalah product designer untuk Daisuki Inventory. Buat prototipe HIGH FIDELITY MULTI-SCREEN yang dapat diklik dalam satu proyek Google Stitch. Saya membutuhkan keseluruhan perjalanan aplikasi, bukan satu halaman dashboard. Rancang setiap layar dan setiap tab yang saya daftarkan di bawah. Jika hasil perlu dibuat bertahap, lanjutkan di canvas/proyek yang sama dengan komponen dan aturan visual yang sama sampai daftar layar lengkap.

TUJUAN PRODUK
Daisuki Inventory menghubungkan Admin Daisuki Pusat dan Mitra Cabang. Mitra melaporkan stok fisik, memesan restock, memantau pesanan, menerima kiriman lewat resi, membaca log, dan mengubah profil. Admin memantau stok cabang dan gudang pusat, menyetujui pesanan, mengatur pengiriman, mengelola mitra, membaca log, notifikasi, dan AI Insights. UI harus membantu orang mengambil tindakan operasional dengan cepat.

SUMBER KEBENARAN
Ikuti screenshot aplikasi dan logo yang saya lampirkan. Pertahankan struktur, identitas, istilah, dan alur yang benar-benar ada. Beri peningkatan pada hierarki, jarak, kepadatan, dan keterbacaan tanpa mengarang fitur. Empat produk resmi: Seblak Jadul Instan, Basreng Daun Jeruk, Makaroni Daun Jeruk, Keripik Pisang Rasa Coklat. Jangan tampilkan kode SKU di UI.

SISTEM DESAIN BERSAMA
Admin memakai latar #f6f7f9, permukaan #ffffff, garis #dde1e8, teks #161a26, teks sekunder #5b6272. Mitra memakai latar hangat #faf7f2 dan header #fffdfb. Navy #26336b dan #141b3d memberi hierarki dan aksi utama. Ume #b83a6a untuk identitas brand atau ilustrasi. Status stok memakai Aman hijau #1e8e4e, Waspada kuning #f5b700, Kritis merah #c62828, Belum diperbarui abu #8a91a3. Status pesanan berlabel Diproses, Disetujui, Dalam Pengiriman, Selesai, Ditolak, Dibatalkan. Jangan memakai warna brand sebagai pengganti warna status.

Gunakan Bricolage Grotesque untuk judul dan angka besar, Figtree untuk isi dan kontrol. Angka stok dan persentase harus sejajar dengan tabular numerals. Permukaan operasional memakai border halus, sudut sedang, dan bayangan hanya untuk lapisan melayang. Buat varian komponen yang dipakai ulang: tombol primer/sekunder/destruktif, input, kontrol jumlah, tab, filter, badge status, kartu stok, ringkasan KPI, baris daftar, tabel, dialog, toast, navigasi, chatbot, dan panduan sorot. Tiap layar punya satu tugas utama yang jelas. Variasikan ukuran dan jarak kelompok konten sesuai prioritas, jangan mengulang grid kartu seragam di setiap layar.

PROTOTIPE DAN RESPONSIF
Buat frame desktop sekitar 1440 x 900 dan mobile sekitar 390 x 844 untuk SETIAP layar utama yang terdaftar. Desktop dan ponsel adalah dua tata letak yang dirancang, bukan hasil mengecilkan satu frame. Pada ponsel, konten penting tetap terlihat sebelum gulir jauh; tabel menjadi daftar yang mudah dibaca; target sentuh minimal 44 x 44 px. Pastikan tidak ada teks terpotong, scroll horizontal tak sengaja, atau tombol tertutup nav/chat. Tunjukkan keadaan normal, kosong, loading, error, dan hasil aksi pada alur yang memerlukannya. Semua angka mockup diberi label 'Data contoh'.

ATURAN BISNIS
Stok Mitra tidak punya batas atas. Tampilkan 'Sisa Stok: [jumlah] pcs', tanpa 'kapasitas rak', '/40 pcs', atau 'Sisa Stok / Par'. Buffer minimal hanya ambang pengaman. Alur pesanan: Diproses → Disetujui → Dalam Pengiriman → Selesai, dengan kemungkinan Ditolak atau Dibatalkan. Stok fisik Mitra bertambah hanya setelah resi kiriman diverifikasi, sebesar jumlah yang disetujui. Kuantitas restock dibatasi oleh stok gudang pusat yang tersedia, bukan batas tetap. Mitra dan Admin tetap memiliki izin berbeda; prototipe boleh mendemonstrasikan dua jalur login tanpa menambahkan tombol pindah role di dalam aplikasi.

DAFTAR LAYAR WAJIB, BUAT SEMUANYA

GRUP A: ONBOARDING, ENAM FRAME BERURUTAN
O1 Selamat datang: komposisi editorial besar 'Selamat datang di Daisuki Inventory' dan janji 'Stok toko terpantau. Pasokan lebih terencana.' Tanpa ilustrasi hero generik. Ada 'Lewati', kontrol kembali/lanjut, indikator 1/6.
O2 Catat stok: judul 'Catat sisa stok rak, tanpa ribet.' Artefak rak produk Daisuki dan simulasi tombol kurang/tambah jumlah stok. Perlihatkan bahwa laporan fisik dicatat saat tutup toko.
O3 Cek & pesan: judul 'Cek stok pusat, pesan multi-item.' Artefak katalog stok pusat dan draft satu pesanan berisi lebih dari satu produk. Aksi simulasi ajukan pesanan.
O4 Kirim armada: judul 'Admin verifikasi, kurir meluncur.' Visual perjalanan pasokan dari gudang pusat ke cabang, dengan aksi simulasi pengiriman yang jelas.
O5 Pindai kardus: judul 'Pindai kiriman saat kurir tiba.' Visual ponsel memindai barcode/QR pada kardus atau resi, dengan keadaan sebelum dan sesudah verifikasi.
O6 Stok bertambah: judul 'Terima kiriman admin, stok otomatis bertambah.' Visual perpindahan barang yang sudah diverifikasi ke stok toko, jumlah stok berubah hanya setelah konfirmasi. Tombol akhir mengarah ke Login.
Semua enam langkah memakai kanvas, tipografi, posisi kontrol, indikator langkah, dan pola ilustrasi yang konsisten. Gerak hanya pada artefak yang memperjelas aksi, misalnya angka berubah, pesanan terkirim, truk bergerak, pemindaian, dan stok masuk. Hormati reduced motion. Jangan mengganti artefak Daisuki dengan blob atau orb abstrak.

GRUP B: LOGIN, SATU FRAME UTAMA DAN VARIAN KEADAAN
L1 Login: desktop dua kolom. Panel kiri merah brand #a9000c dengan logo resmi dan judul 'Stok cabang dan restock, lebih mudah diikuti.' Panel kanan putih berisi judul Masuk, tautan Lihat Panduan Sistem, pilihan isi cepat akun demo, Email atau username, Kata sandi, tampil/sembunyikan kata sandi, tombol Masuk, dan area install app bila tersedia. Di ponsel panel brand ditumpuk di atas formulir. Buat varian kesalahan kredensial dan sedang masuk. Prototipe harus punya dua tautan alur login berbasis akun demo: akun Mitra menuju M1; akun Admin menuju A1. Ini adalah alur demonstrasi, bukan pilihan role bebas bagi pengguna aplikasi.

GRUP C: PORTAL MITRA, LIMA TAB LENGKAP
Shell Mitra: header dengan foto atau ikon toko, nama cabang dan PIC, Profil, Keluar. Desktop memakai tab horizontal untuk Stok, Restock/Pesan, Riwayat, Log; Profil lewat header. Ponsel memakai navigasi bawah melayang dengan lima tujuan: Stok, Restock/Pesan, Riwayat, Log, Profil. Konten terpusat dan nyaman dibaca; tombol chatbot melayang tidak menutup aksi.
M1 Stok: stok gudang pusat empat produk serta laporan stok fisik harian. Daftar produk menunjukkan nama, sisa stok riil, status berlabel, dan kontrol kurang/input angka/tambah. Tombol Simpan Laporan Stok serta varian perubahan belum disimpan, sukses simpan, stok kritis, data belum diperbarui, dan gagal memuat.
M2 Restock/Pesan: pilih beberapa produk dalam satu PO, lihat stok pusat yang tersedia, masukkan jumlah tiap produk, catatan opsional, ringkasan, dan Kirim Permintaan Restock. Buat varian validasi jumlah melebihi stok pusat dan varian sukses yang menghasilkan PO berstatus Diproses.
M3 Riwayat: daftar PO dengan filter status dan detail tiap pesanan. Tunjukkan item diminta/disetujui, catatan Admin, Edit atau Batalkan jika status mengizinkan. Untuk status Dalam Pengiriman tampilkan Konfirmasi Barang Sampai dan alur scan resi dengan alternatif kode manual. Buat varian scan gagal dan scan berhasil; stok Mitra berubah pada varian berhasil saja.
M4 Log: ringkasan perubahan stok, kalender atau linimasa, filter produk/tanggal/aktivitas, serta detail sebelum dan sesudah perubahan. Buat keadaan kosong bila belum ada log.
M5 Profil: foto toko, nama cabang, PIC, telepon, alamat, pilihan wilayah bertingkat, dan tombol Simpan perubahan. Buat varian edit dan sukses simpan.
M6 Lapisan Chatbot AI Mitra: dari salah satu tab, buka panel chat berisi sapaan, input, pertanyaan cepat seputar inventaris Daisuki, bubble percakapan, loading, umpan balik jawaban, dan Hapus riwayat dengan konfirmasi. Pada jawaban panduan muncul tombol 'Mulai Panduan Langsung'.
M7 Lapisan tur produk: setelah menekan tombol panduan, tutup panel chat, buka tab yang tepat, dan sorot kontrol yang relevan dengan tombol Kembali, Lanjut, Selesai, Tutup. Perlihatkan satu contoh tur laporan stok dan akses ke tur restock, penerimaan, log, serta profil.

GRUP D: PORTAL ADMIN, TUJUH TAB LENGKAP
Shell Admin: desktop memakai sidebar yang dapat dipadatkan, topbar judul halaman, notifikasi, akun Admin, dan Keluar. Ponsel memakai navigasi ringkas dengan akses yang tetap jelas ke tujuh tujuan. Jaga kepadatan informasi yang berguna; angka dan status mudah dibandingkan.
A1 Stok cabang: ringkasan total cabang, cabang kritis, pesanan menunggu; satu entri/kartu per cabang dengan nama, wilayah, status, dan sisa stok riil; pencarian/filter; detail stok per produk. Tampilkan terpisah stok gudang pusat empat produk dan kontrol pembaruan Admin. Buat varian detail cabang serta satu cabang kritis.
A2 Persetujuan pesanan: tiga kategori Menunggu Persetujuan, Setelah Persetujuan/Selesai, Ditolak. Daftar PO dan rincian mitra, produk, jumlah diminta, jumlah disetujui. Admin dapat setujui penuh/parsial/nol tiap item; catatan wajib jika jumlah berubah; Tolak memerlukan alasan; pesanan Disetujui dapat dikirim hingga status Dalam Pengiriman. Buat varian form persetujuan parsial, dialog penolakan, dan konfirmasi kirim.
A3 Log pengiriman: daftar pengiriman dengan nomor PO, mitra, waktu, status, kuantitas yang disetujui, rincian resi/QR atau barcode, dan akses buka/cetak ulang resi jika tersedia.
A4 Manajemen mitra: daftar cabang, cari/filter, rincian profil dan stok, form tambah/ubah mitra, dan dialog konfirmasi penonaktifan. Jelaskan akibat penonaktifan tanpa membuat data riwayat hilang.
A5 Log & Data: ringkasan data operasional, filter tanggal/mitra/produk/sumber, kalender atau linimasa log, detail mutasi, dan ekspor. Berikan tampilan data yang dapat dibandingkan tanpa membuat grafik dekoratif yang tidak menjawab pertanyaan.
A6 Notifikasi: daftar alert stok kritis, pesanan baru, dan kejadian pengiriman; status dibaca/belum dibaca, filter waktu/status, aksi Tandai dibaca, dan navigasi ke objek terkait.
A7 AI Insights: ringkasan mingguan, KPI konsumsi 7 hari, perubahan terhadap pekan sebelumnya, pemenuhan restock, ketahanan stok pusat; daftar/peringkat mitra dan produk terlaris; aktivitas dan risiko wilayah; tab Wilayah, Risiko cabang, Produk terlaris, Pasokan pusat; status dan waktu sinkronisasi model daisuki.pkl. Jika data tidak tersedia, tampilkan keadaan kosong yang jujur, bukan angka rekaan.

KONEKSI PROTOTIPE WAJIB
O1 → O2 → O3 → O4 → O5 → O6 → L1. Tombol Lewati di setiap onboarding → L1. L1 dengan akun demo Mitra → M1. L1 dengan akun demo Admin → A1. Tautan Lihat Panduan Sistem → O1. M1 → M2 → M3 → alur scan resi → M1 dengan stok bertambah. M1 → M6 → M7 → tab yang sesuai. Semua tab Mitra saling dapat dibuka lewat navigasi. A1 → A2 → persetujuan parsial → kirim → A3. Semua tab Admin saling dapat dibuka lewat navigasi. Keluar dari Mitra/Admin → L1. Semua detail, dialog, kembali, batal, dan simpan yang terlihat harus terhubung.

BATAS KUALITAS ANTISLOP
Jangan membuat semua halaman berupa headline + empat KPI + grid kartu identik. Pilih komposisi sesuai pekerjaan masing-masing layar. Hindari gradien biru-ungu, glow, kaca berulang, orb AI, ikon sparkle, emoji dekoratif, bayangan berat pada semua kartu, statistik palsu, dan teks pemasaran generik. Ikon, warna, animasi, dan ruang kosong harus punya alasan fungsional. Kontras teks dan fokus keyboard jelas. Kartu atau tabel tidak boleh kehilangan label saat mobile. Sebelum menyatakan selesai, audit seluruh frame: navigasi konsisten, informasi utama terlihat cepat, angka diberi satuan, status berlabel, alur bisnis benar, semua layar A–D ada.

HASIL YANG HARUS KAMU SERAHKAN
Satu proyek prototipe dengan kelompok frame 01 Onboarding (O1–O6), 02 Login (L1), 03 Mitra (M1–M7), 04 Admin (A1–A7), dan 05 Komponen/varian. Setiap layar utama punya desktop dan mobile. Namai frame dengan ID di atas agar saya bisa memeriksa kelengkapannya. Sertakan peta alur interaksi. Jika kapasitas satu generasi habis, jangan berhenti pada dashboard: beri daftar ID yang sudah dibuat dan lanjutkan sisa ID dalam proyek yang sama ketika saya menulis 'lanjutkan'.
```

## Jika Stitch berhenti setelah sebagian layar

Kirim prompt ini pada proyek dan canvas yang sama. Ganti `[ID YANG BELUM ADA]` dengan ID dari daftar di atas.

```text
Lanjutkan prototipe Daisuki Inventory pada canvas yang sama. Pertahankan semua komponen, warna, tipografi, dan pola navigasi yang sudah dibuat. Frame yang masih belum ada: [ID YANG BELUM ADA]. Buat seluruh frame tersebut dalam versi desktop dan mobile, dengan isi serta keadaan sesuai prompt utama. Hubungkan frame baru ke alur yang sudah ada. Jangan membuat ulang frame yang sudah selesai. Setelah selesai, tampilkan daftar O1–O6, L1, M1–M7, A1–A7 dan tandai mana yang sudah tersedia.
```

## Jika visual masih terasa berantakan

```text
Audit seluruh proyek Daisuki ini sebelum membuat varian baru. Pilih tiga layar yang paling lemah dari Onboarding, Mitra, dan Admin. Pada tiap layar, rapikan hierarki informasi, alignment, jarak, kepadatan, dan susunan mobile. Pertahankan fitur dan isi sesuai prompt utama. Kurangi dekorasi yang tidak membantu keputusan pengguna, tetapi jaga karakter visual Daisuki. Terapkan perbaikan komponen yang sama ke semua frame terkait. Berikan daftar perubahan konkret per layar dan periksa bahwa alur prototipe tetap terhubung.
```

## Catatan verifikasi

Prompt ini disusun dari struktur komponen dan route proyek. Saya belum melihat screenshot hasil Google Stitch milikmu, sehingga kesamaan piksel hasil Stitch perlu diperiksa setelah generasi. Tidak perlu menjalankan pengujian aplikasi karena dokumen ini tidak mengubah kode aplikasi.
