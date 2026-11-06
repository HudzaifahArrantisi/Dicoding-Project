# Prompt master untuk agen FigCraft: prototipe Daisuki Inventory

Salin bagian **Prompt untuk agen** ke FigCraft. Jika FigCraft menerima lampiran, sertakan `apps/web/public/icons/logo.jpg` sebagai logo resmi dan tangkapan layar aplikasi saat ini sebagai referensi. Prompt ini juga dapat dipakai tanpa lampiran.

## Prompt untuk agen

Kamu adalah product designer dan prototyper di FigCraft. Buat **prototipe high fidelity yang dapat diedit dan diklik** untuk aplikasi web responsif **Daisuki Inventory**. Pertahankan identitas visual dan alur bisnis yang dijelaskan di bawah. Hasil akhir harus mencakup sistem desain, semua layar utama, keadaan komponen, dan koneksi antar layar. Jangan hanya membuat satu gambar dashboard.

### 1. Konteks produk dan pengguna

Daisuki Inventory adalah sistem B2B yang menghubungkan Admin Daisuki Pusat dengan Mitra Cabang seperti hotel, kafe, restoran, dan minimarket. Admin memantau stok cabang dan gudang pusat, menyetujui restock per produk, mengirim barang, mengelola mitra, memantau log, notifikasi, dan AI Insights. Mitra melaporkan stok fisik harian, melihat stok pusat, mengajukan restock multi-produk, memantau pesanan, memindai resi saat barang tiba, membaca log, dan memperbarui profil.

Gunakan bahasa Indonesia yang ringkas dan tenang. Pengguna sering bekerja lewat ponsel dan harus bisa membaca status pesanan atau stok sekilas. Nomor, tanggal, dan satuan harus terbaca jelas.

Empat produk resmi yang boleh muncul sebagai contoh: **Seblak Jadul Instan**, **Basreng Daun Jeruk**, **Makaroni Daun Jeruk**, **Keripik Pisang Rasa Coklat**. Jangan tampilkan SKU internal pada antarmuka pengguna.

### 2. Identitas visual dan sistem komponen

- Latar admin: `#f6f7f9`; kartu/surface putih `#ffffff`; garis `#dde1e8`; teks utama `#161a26`; teks sekunder `#5b6272`.
- Latar portal mitra: krem hangat `#faf7f2`; header mitra `#fffdfb`; kartu tetap putih agar data mudah dibaca.
- Tindakan utama dan navigasi: navy `#26336b`, navy gelap `#141b3d`. Aksen brand Ume `#b83a6a` hanya untuk logo, penanda brand, dan ilustrasi. Jangan pakai Ume untuk status atau tombol aksi utama.
- Status stok memakai warna semantik: aman hijau `#1e8e4e`, waspada kuning `#f5b700`, kritis merah `#c62828`, data belum diperbarui abu `#8a91a3`. Sediakan latar badge yang lembut dan teks berkontras tinggi.
- Status pesanan: Diproses navy, Disetujui teal, Dalam Pengiriman biru, Selesai hijau, Ditolak merah, Dibatalkan abu. Warna harus selalu disertai teks status.
- Judul dan angka besar: **Bricolage Grotesque**. Isi, label, input, tombol: **Figtree**. Angka stok, kuantitas, persentase, harga, dan tanggal berulang menggunakan angka tabular.
- Gaya: dashboard operasional yang rapi, datar, dan mudah dipindai. Kartu berbatas halus, sudut sedang, bayangan hanya pada elemen melayang seperti modal, chatbot, dan navigasi mobile. Hindari gradien dekoratif, glow, kaca di semua permukaan, dan ikon/ilustrasi generik yang tidak membantu pekerjaan.
- Buat komponen dan varian: tombol primer/sekunder/destruktif/ikon dengan keadaan normal, hover, fokus, disabled, loading; input teks/angka/cari, textarea, select, kontrol jumlah +/−, tabs, filter chips, badge stok dan pesanan, kartu stok, kartu pesanan, KPI, tabel responsif, kalender log, toast, modal/drawer, state kosong, skeleton loading, dan pesan error dengan aksi coba lagi.
- Semua kontrol penting bisa disentuh pada ukuran minimal 44 × 44 px di portal mitra. Fokus keyboard harus terlihat. Jangan mengandalkan warna saja untuk menjelaskan hasil.

### 3. Frame dan navigasi

Buat frame desktop 1440 × 900, tablet 768 × 1024, dan mobile 390 × 844 untuk layar utama. Tunjukkan perilaku responsif, bukan sekadar mengecilkan desktop: tabel padat menjadi kartu atau daftar yang dapat dibaca, formulir menjadi satu kolom, dan modal tidak melewati layar.

Alur awal terdiri dari walkthrough singkat tentang laporan stok, restock, persetujuan/pengiriman, dan pindai resi; ada tombol **Lewati** serta **Lanjutkan**. Layar login punya panel brand Daisuki dengan logo/mascot resmi, judul “Stok cabang dan restock, lebih mudah diikuti.”, formulir email/username dan kata sandi, tombol tampil/sembunyikan kata sandi, opsi akun demo, tautan panduan, dan keadaan salah kredensial/loading.

Portal Admin memakai sidebar desktop yang bisa ditutup, topbar berisi judul tab, notifikasi, identitas admin, dan Keluar. Di mobile gunakan navigasi bawah yang jelas; berikan akses ke semua tujuh tab tanpa membuat label terpotong. Tab Admin: **Stok cabang**, **Persetujuan pesanan**, **Log pengiriman**, **Manajemen mitra**, **Log & Data**, **Notifikasi**, **AI Insights**.

Portal Mitra memakai header dengan nama cabang, PIC, Profil, dan Keluar. Di desktop gunakan tab horizontal; di mobile gunakan navigasi bawah melayang dengan lima tab: **Stok**, **Restock/Pesan**, **Riwayat**, **Log**, **Profil**. Chatbot melayang di kanan bawah tetapi tidak menutupi navigasi atau tombol simpan.

### 4. Layar Admin yang harus dibuat

1. **Stok cabang:** ringkasan jumlah cabang, cabang kritis, dan pesanan menunggu; daftar satu kartu per cabang dengan nama, lokasi, status, jumlah stok fisik per produk, pencarian dan filter. Klik kartu membuka detail cabang. Tampilkan juga stok gudang pusat empat produk dan kontrol admin untuk memperbaruinya.
2. **Persetujuan pesanan:** tab Menunggu Persetujuan, Disetujui/Selesai, Ditolak. Kartu pesanan menampilkan nomor PO, mitra, waktu, status, dan daftar produk. Dalam detail, admin dapat mengubah `qty_approved` tiap item menjadi penuh, parsial, atau nol; catatan admin wajib jika jumlah disesuaikan. Sediakan alur Setujui, Tolak dengan alasan, dan Kirim Sekarang dengan konfirmasi saat logistik siap.
3. **Log pengiriman:** daftar pesanan yang dikirim dengan tanggal, nomor PO, mitra, kuantitas disetujui, detail, dan resi QR/barcode yang dapat dicetak atau dibuka ulang.
4. **Manajemen mitra:** daftar/cari/filter cabang, detail stok dan profil, modal tambah/ubah data mitra, serta konfirmasi sebelum menonaktifkan cabang.
5. **Log & Data:** ringkasan laporan mingguan, kalender atau linimasa aktivitas, log per mitra, filter tanggal/produk/sumber, dan aksi ekspor data.
6. **Notifikasi:** daftar alert stok kritis, pesanan baru, serta kejadian pengiriman. Ada filter waktu/status, tanda belum dibaca, aksi Tandai dibaca, dan tautan menuju pesanan atau stok terkait.
7. **AI Insights:** tombol Perbarui saran dengan keadaan berjalan/berhasil/gagal; badge waktu sinkronisasi model; KPI konsumsi 7 hari, perubahan terhadap periode sebelumnya, tingkat pemenuhan restock, ketahanan stok pusat; grafik atau ranked list mitra dan produk terlaris; zona risiko wilayah dengan peta/daftar; rekomendasi pasokan yang tetap perlu ditinjau admin. Jika data belum ada, tampilkan keadaan kosong yang jujur.

### 5. Layar Mitra yang harus dibuat

1. **Stok:** kartu stok gudang pusat per produk; area laporan harian yang menampilkan sisa stok fisik toko, badge Aman/Waspada/Kritis/Belum Update, kontrol −, angka yang bisa diketik, kontrol +, dan tombol Simpan Laporan Stok. Tampilkan perubahan belum disimpan dan sukses simpan.
2. **Restock/Pesan:** pilih satu atau beberapa dari empat produk, lihat stok pusat tersedia, isi jumlah kebutuhan per produk, tambahkan/hapus item, catatan cabang opsional, ringkasan pesanan, dan tombol Kirim Permintaan Restock. Tampilkan validasi jika jumlah melebihi stok gudang pusat yang tersedia.
3. **Riwayat:** daftar PO dengan filter status, detail item dan catatan admin, aksi Edit/Batalkan hanya saat status mengizinkan, serta tombol Konfirmasi Barang Sampai untuk pesanan Dalam Pengiriman. Alur penerimaan membuka pemindai QR/barcode dengan alternatif unggah foto resi atau ketik kode manual. Setelah verifikasi sukses, status menjadi Selesai dan stok fisik bertambah.
4. **Log:** ringkasan perubahan stok, kalender atau timeline, cari/filter produk dan tipe aktivitas, detail sebelum/sesudah untuk laporan fisik dan penerimaan barang.
5. **Profil:** foto toko, nama cabang/PIC, nomor telepon, alamat, pemilih wilayah bertingkat provinsi–kabupaten/kota–kecamatan–desa/kelurahan, dan tombol Simpan perubahan.
6. **Chatbot AI Mitra:** tombol melayang; panel percakapan dengan sapaan, bubble mitra/asisten, input pertanyaan, pertanyaan cepat, indikator menjawab, tombol suka/tidak suka pada jawaban, dan konfirmasi Hapus riwayat. Untuk jawaban panduan, tampilkan tombol **Mulai Panduan Langsung**. Klik tombol ini menutup panel chat, pindah ke tab terkait, lalu memulai sorotan langkah demi langkah dengan Mundur, Lanjut, Selesai, dan Tutup. Buat contoh tur untuk laporan stok, restock, penerimaan, log, dan profil. Tampilkan penolakan ramah untuk topik di luar inventaris Daisuki.

### 6. Aturan perilaku yang harus tampak di prototipe

- **Stok mitra tidak memiliki batas maksimum.** Jangan pernah menampilkan “kapasitas rak”, pembagi `/40 pcs`, atau `/par`. Tampilkan `Sisa Stok: {jumlah} pcs`. Buffer minimal hanya acuan status dan saran.
- Alur status pesanan: **Diproses → Disetujui → Dalam Pengiriman → Selesai**; cabang dapat melihat Ditolak atau Dibatalkan jika terjadi. Stok fisik mitra bertambah hanya setelah resi kiriman diverifikasi pada transisi Dalam Pengiriman → Selesai, memakai jumlah yang disetujui.
- Data dalam prototipe boleh berupa **contoh yang diberi label “Data contoh prototipe”**. Jangan menyajikan angka contoh sebagai data operasional nyata. Pertahankan empat nama produk resmi.
- Buat keadaan penting selain keadaan ideal: kosong, loading, gagal memuat, validasi formulir, tombol nonaktif, stok pusat habis, persetujuan parsial, scan gagal/izin kamera ditolak, dan konfirmasi tindakan berisiko.

### 7. Koneksi prototipe dan hasil kerja

Hubungkan setidaknya alur klik berikut: onboarding → login → admin/mitra; mitra ubah laporan stok → simpan; mitra buat restock multi-item → lihat PO Diproses; admin buka PO → setujui parsial dengan catatan → kirim → buka/cetak resi; mitra buka Riwayat → pindai/ketik resi → PO Selesai dan stok bertambah; mitra buka chatbot → pilih pertanyaan cepat → Mulai Panduan Langsung → sorotan berpindah langkah dan tab; admin buka AI Insights → Perbarui saran → status proses/sukses.

Susun file FigCraft dengan halaman **Design System**, **Onboarding & Login**, **Admin Desktop**, **Admin Mobile**, **Mitra Desktop**, **Mitra Mobile**, dan **Prototype Flows**. Gunakan komponen bersama dan varian agar dapat diedit. Beri nama frame dan komponen sesuai fitur. Sertakan catatan singkat untuk perilaku yang tidak bisa disimulasikan di prototipe. Setelah selesai, periksa konsistensi warna/status, hierarki teks, keterbacaan mobile, ukuran target sentuh, keadaan kosong/error, dan semua koneksi tombol penting.
