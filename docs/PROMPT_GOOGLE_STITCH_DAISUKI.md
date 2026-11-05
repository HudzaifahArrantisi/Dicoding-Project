# Prompt Google Stitch untuk Daisuki Inventory

Untuk prototipe lengkap dari enam langkah onboarding sampai seluruh tab Mitra dan Admin, gunakan [prompt seluruh aplikasi](PROMPT_GOOGLE_STITCH_FULL_APP_DAISUKI.md). Dokumen ini tetap berguna untuk memperbaiki satu layar secara terarah.

Prompt FigCraft sebelumnya merangkum fitur proyek, tetapi terlalu banyak meminta layar dalam satu generasi. Dokumen ini dipakai untuk membuat prototipe yang lebih dekat ke UI aplikasi saat ini. Gunakan satu layar per permintaan, lalu iterasi pada hasilnya.

## Bahan yang diberikan ke Stitch

1. Unggah tangkapan layar aplikasi saat ini untuk layar yang akan dikerjakan. Sertakan tampilan desktop dan ponsel bila ada. Screenshot adalah acuan struktur yang paling kuat.
2. Unggah logo resmi dari `apps/web/public/icons/logo.jpg`.
3. Jika Stitch menerima berkas aturan desain, berikan bagian **Aturan desain bersama** di bawah sebagai konteks proyek. Google Stitch mendukung gambar dan berkas desain sebagai konteks serta iterasi lewat percakapan.
4. Mulai dari layar **Mitra: Stok**. Setelah bentuk visualnya disetujui, gunakan hasil itu sebagai referensi saat membuat layar Mitra lain. Lakukan hal yang sama untuk **Admin: Stok cabang** sebelum melanjutkan layar Admin lain.

Tanpa screenshot, prompt ini menjaga warna, komponen, konten, dan alur yang diketahui dari kode. Susunan piksel tetap perlu dibandingkan dengan aplikasi berjalan.

## 1. Aturan desain bersama

Salin prompt ini sebagai konteks awal proyek Stitch:

```text
Anda mendesain prototipe Daisuki Inventory, aplikasi operasional B2B untuk Admin Daisuki Pusat dan Mitra Cabang. Gunakan screenshot aplikasi yang saya lampirkan sebagai acuan struktur, hierarki, dan komponen. Pertahankan elemen yang memang ada. Perbaiki kepadatan, keterbacaan, dan ritme visual tanpa mengubah alur bisnis. Kerjakan satu layar yang saya sebutkan per permintaan.

KARAKTER VISUAL
Terasa seperti buku kerja inventaris yang rapi, hangat untuk Mitra dan tegas untuk Admin. Beri ruang lebih besar pada angka stok, nama produk, status, dan tindakan berikutnya. Gunakan identitas logo Daisuki yang saya lampirkan; jangan membuat maskot atau logo pengganti. Daya ekspresi sedang, ritme visual bervariasi sesuai pentingnya informasi, gerak hanya untuk umpan balik ringan.

TOKEN WARNA DAN HURUF
Admin: latar #f6f7f9, permukaan putih #ffffff, garis #dde1e8. Mitra: latar #faf7f2, header #fffdfb, permukaan putih. Teks utama #161a26, teks sekunder #5b6272. Navy #26336b dan #141b3d untuk hierarki dan aksi utama. Ume #b83a6a hanya sebagai aksen brand atau ilustrasi, bukan warna status. Judul dan angka besar memakai Bricolage Grotesque; isi, formulir, dan navigasi memakai Figtree. Semua kuantitas dan persentase memakai angka tabular agar mudah dibandingkan.

Status stok wajib memiliki label teks: Aman #1e8e4e, Waspada #f5b700, Kritis #c62828, Belum diperbarui #8a91a3. Status pesanan juga wajib berlabel: Diproses navy, Disetujui teal, Dalam Pengiriman biru, Selesai hijau, Ditolak merah, Dibatalkan abu. Warna status hanya dipakai untuk data status, bukan dekorasi.

KOMPONEN DAN KOMPOSISI
Gunakan border tipis dan sudut sedang. Bayangan hanya untuk lapisan yang melayang seperti dialog, chatbot, dan navigasi mobile. Tata konten menurut tugas pengguna: apa yang perlu diketahui sekarang, apa yang berubah, lalu tindakan yang bisa dilakukan. Beri satu fokus visual utama pada tiap layar. Kelompokkan informasi yang saling terkait; jangan membuat semua informasi menjadi kartu dengan ukuran seragam. Pakai ikon hanya jika memperjelas tindakan. Tombol memiliki label kerja yang spesifik, keadaan normal, fokus, nonaktif, dan loading. Tampilkan keadaan kosong dan gagal memuat yang masuk akal.

RESPONSIF DAN AKSESIBILITAS
Rancang desktop 1440 px dan ponsel sekitar 390 px sebagai dua komposisi yang benar-benar ditata ulang. Pada ponsel, tumpuk konten sesuai prioritas, jangan mengecilkan tabel desktop. Target sentuh portal Mitra sekurangnya 44 x 44 px. Jangan biarkan chatbot menutup navigasi atau tombol simpan. Pastikan teks, batas input, dan fokus keyboard mudah terlihat. Jangan gunakan warna sebagai satu-satunya penanda status.

ATURAN PRODUK
Empat nama produk resmi: Seblak Jadul Instan, Basreng Daun Jeruk, Makaroni Daun Jeruk, Keripik Pisang Rasa Coklat. Jangan tampilkan SKU internal. Stok Mitra tidak punya batas atas; tampilkan jumlah riil dalam pcs. Jangan tampilkan kapasitas rak, /40 pcs, atau Sisa Stok / Par. Buffer minimal hanya acuan status. Pesanan berjalan Diproses → Disetujui → Dalam Pengiriman → Selesai. Stok Mitra baru bertambah setelah penerimaan barang diverifikasi, sebesar jumlah yang disetujui. Bila butuh angka untuk mockup, beri penanda kecil 'Data contoh' dan jangan menggambarkannya sebagai data nyata.

BATAS KUALITAS
Jangan memakai gradien biru-ungu, glow, efek kaca, orb AI, ikon sparkle, dekorasi emoji, bayangan di setiap kartu, atau kumpulan KPI palsu. Hindari teks pemasaran generik. Semua elemen interaktif harus memiliki fungsi yang bisa dijelaskan. Sebelum selesai, cek apakah layar tetap mudah dipindai dalam 5 detik, baik di desktop maupun ponsel.

Keluaran untuk setiap permintaan: satu layar desktop dan satu layar ponsel dengan gaya yang sama; sebutkan singkat tiga keputusan visual utama dan alasan fungsionalnya. Jangan menghasilkan semua layar sekaligus.
```

## 2. Layar pertama: Mitra Stok

Setelah aturan bersama masuk ke konteks Stitch, salin prompt ini. Lampirkan screenshot halaman Mitra Stok dari aplikasi bila tersedia.

```text
Buat hanya layar portal Mitra pada tab Stok, versi desktop dan ponsel. Gunakan aturan desain bersama dan screenshot terlampir.

Struktur yang harus dipertahankan: header dengan identitas cabang dan PIC; navigasi Mitra berisi Stok, Restock/Pesan, Riwayat, Log, Profil; area utama untuk stok gudang pusat dan laporan stok fisik harian; tombol bantuan chatbot yang tidak menutup kontrol penting. Di desktop, navigasi berupa tab horizontal di bawah header. Di ponsel, navigasi menjadi bilah bawah melayang dan konten utama satu kolom.

Jadikan laporan stok fisik sebagai fokus utama. Tampilkan empat produk resmi dalam daftar yang mudah dipindai. Setiap produk memperlihatkan nama, sisa stok riil dalam pcs, status berlabel, serta kontrol kurangi, input angka, dan tambah. Tampilkan keadaan ada perubahan belum disimpan dan tombol 'Simpan Laporan Stok' yang jelas. Ketersediaan gudang pusat menjadi bagian pendukung yang tetap mudah ditemukan. Angka di mockup diberi label 'Data contoh'.

Perbaiki hierarki dengan judul singkat, satu ringkasan yang benar-benar membantu, pemisah halus, dan ruang antar kelompok yang berbeda sesuai prioritas. Hindari empat kartu besar identik yang membuat pengguna harus menggulir terlalu jauh. Pada ponsel, letakkan tombol simpan di posisi yang mudah dijangkau tanpa menutupi bilah navigasi. Jangan tampilkan batas maksimum stok Mitra.

Hasil akhir harus tampak sebagai layar aplikasi operasional Daisuki yang siap dipakai, bukan halaman pemasaran atau dashboard generik.
```

## 3. Layar berikutnya: Admin Stok cabang

Gunakan hasil Mitra Stok sebagai acuan identitas, lalu lampirkan screenshot Admin Stok cabang.

```text
Buat hanya layar Admin pada tab Stok cabang, versi desktop dan ponsel. Pertahankan identitas Daisuki dari konteks dan ikuti screenshot terlampir.

Di desktop, gunakan sidebar Admin yang dapat dipadatkan, topbar, serta area kerja dengan ringkasan kondisi cabang dan stok gudang pusat. Sidebar memuat Stok cabang, Persetujuan pesanan, Log pengiriman, Manajemen mitra, Log & Data, Notifikasi, AI Insights. Di ponsel, gunakan navigasi yang menampilkan tujuan penting tanpa label terpotong dan berikan akses jelas ke menu lain.

Tugas utama admin adalah menemukan cabang yang memerlukan perhatian. Tampilkan ringkasan jumlah cabang, cabang kritis, dan pesanan menunggu. Di bawahnya, daftar satu entri atau kartu per cabang: nama, lokasi, status berlabel, serta ringkasan jumlah stok riil. Sediakan pencarian atau filter dan akses ke rincian cabang. Stok gudang pusat untuk empat produk resmi tampil terpisah secara jelas.

Atur kepadatan agar data lebih cepat dibandingkan: nama cabang dan status menonjol, angka sejajar, keterangan tambahan lebih tenang. Jangan mengubah status menjadi angka /par atau kapasitas rak. Semua angka mockup diberi label 'Data contoh'. Tampilkan juga keadaan satu cabang kritis tanpa menjadikan seluruh halaman merah.
```

## 4. Prompt lanjutan per layar

Setelah dua layar dasar bagus, pakai kerangka berikut untuk setiap layar berikutnya. Ganti isi `[NAMA LAYAR]`, `[TUGAS UTAMA]`, dan `[ELEMEN NYATA]` berdasarkan daftar di bawah. Lampirkan screenshot layar tersebut setiap kali tersedia.

```text
Lanjutkan proyek Daisuki yang sama. Buat hanya [NAMA LAYAR], desktop dan ponsel. Gunakan aturan desain dan komponen dari layar yang sudah disetujui. Tugas utama pengguna di layar ini adalah [TUGAS UTAMA]. Pertahankan [ELEMEN NYATA]. Tampilkan keadaan normal, kosong atau error yang relevan, dan satu keadaan aksi utama. Jaga label serta aturan bisnis Daisuki. Jangan membuat fitur atau angka baru yang tidak tercantum dalam konteks. Periksa ulang kepadatan mobile dan konsistensi navigasi sebelum selesai.
```

| Layar | Tugas utama | Elemen nyata yang perlu ada |
|---|---|---|
| Mitra Restock/Pesan | Mengajukan satu PO multi-produk | Stok pusat tersedia, kuantitas per produk, catatan, ringkasan, kirim permintaan |
| Mitra Riwayat | Memantau dan menindaklanjuti PO | Filter status, nomor PO, rincian, edit/batal saat diizinkan, konfirmasi penerimaan dengan resi |
| Mitra Log | Memeriksa perubahan stok | Kalender atau linimasa, filter, rincian perubahan |
| Mitra Profil | Memperbarui data cabang | Foto, PIC, telepon, alamat, wilayah bertingkat, simpan |
| Mitra Chatbot & tur | Bertanya tentang inventaris dan membuka panduan | Percakapan, pertanyaan cepat, input, umpan balik, Mulai Panduan Langsung, sorotan langkah |
| Admin Persetujuan pesanan | Menyetujui jumlah per item | Tab status, rincian PO, jumlah diminta/disetujui, catatan bila berbeda, tolak dengan alasan |
| Admin Log pengiriman | Menemukan pengiriman dan resi | Daftar PO dikirim, tanggal, mitra, jumlah disetujui, detail resi |
| Admin Manajemen mitra | Mencari dan mengelola cabang | Pencarian, daftar cabang, formulir tambah/ubah, konfirmasi penonaktifan |
| Admin Log & Data | Menelusuri perubahan stok | Filter tanggal/mitra/produk, kalender atau linimasa, rincian log, ekspor |
| Admin Notifikasi | Menangani alert dan pesanan baru | Belum dibaca, jenis kejadian, waktu, tautan ke objek, tandai dibaca |
| Admin AI Insights | Membaca ringkasan mingguan | KPI 7 hari, produk dan mitra terlaris, zona risiko, waktu sinkronisasi model |
| Login | Masuk sebagai Admin atau Mitra | Panel brand merah resmi, logo, formulir, lihat kata sandi, akun demo, keadaan error/loading |

## 5. Prompt untuk merapikan hasil Stitch yang masih berantakan

Pakai pada layar terpilih, bukan seluruh proyek sekaligus. Sertakan gambar hasil yang ingin diperbaiki.

```text
Rapikan layar terpilih ini tanpa mengubah fitur dan isi utamanya. Pertahankan identitas Daisuki, logo, warna, tipografi, dan navigasi dari aturan proyek. Benahi lima masalah paling nyata pada hierarki, jarak, kepadatan, alignment angka, dan perilaku ponsel. Jadikan satu tugas utama paling jelas. Gabungkan kartu yang hanya memecah informasi terkait, kurangi dekorasi yang tidak menjelaskan data, dan buat ruang kosong terasa sengaja. Periksa kontras, ukuran sentuh, label status, keadaan fokus, dan tombol yang tertutup elemen melayang. Tunjukkan hasil revisi desktop dan ponsel, lalu jelaskan singkat perubahan yang dibuat dan manfaatnya bagi pengguna.
```

## Pemeriksaan sebelum menerima hasil

- Dalam lima detik, pengguna dapat menemukan status stok atau pesanan dan tindakan berikutnya.
- Desktop dan ponsel punya komposisi yang masuk akal; tidak ada teks atau kontrol yang terpotong.
- Warna status konsisten dan selalu disertai label. Ume tetap aksen brand.
- Empat produk, istilah status, dan aturan stok sesuai aplikasi.
- Semua angka contoh ditandai sebagai contoh; tidak ada data bisnis yang dikarang seolah nyata.
- Semua kontrol yang tampak punya aksi atau keadaan yang jelas.

## Acuan kode proyek

- Token dan gaya: `apps/web/src/styles.css`
- Portal Mitra: `apps/web/src/routes/mitra.tsx`
- Portal Admin: `apps/web/src/routes/admin.tsx`
- Login: `apps/web/src/routes/login.tsx`
- Logo: `apps/web/public/icons/logo.jpg`
- Aturan bisnis: `CLAUDE.md` dan `AGENTS.md`
