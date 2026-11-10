# Brain Knowledge: Company Knowledge
> **Sumber Dokumen**: `company_knowledge.json`
> **Tipe Dokumen**: Dataset JSON / Knowledge Base
> **Ukuran Asli**: 9,209 bytes
> **Status Ingestion**: Terverifikasi dan siap digunakan oleh Daisuki AI RAG

---

## Isi & Fakta Pengetahuan Terstruktur

- **$Schema**: http://json-schema.org/draft-07/schema#
- **Title**: DaisukiCompanyKnowledgeBase
- **Description**: Basis pengetahuan resmi perusahaan Daisuki, profil, visi, katalog 4 produk resmi, SOP operasional mitra, alur resi/barcode, dan aturan perlindungan data multi-tenant.
## Company Profile

- **Brand Name**: Daisuki Snack & Food B2B
- **Legal Entity**: PT Daisuki Pangan Indonesia
- **Founding Year**: 2023
- **Founder**: Tim Pendiri Daisuki Indonesia (Inisiatif Kuliner Nusantara)
- **Headquarters**: Surabaya, Jawa Timur, Indonesia
- **Business Model**: B2B (Business-to-Business) Food & Beverage Supply Chain
- **Description**: Daisuki adalah produsen dan distributor makanan ringan/camilan khas Indonesia berkualitas premium yang memasok jaringan mitra ritel, hotel, kafe, restoran, minimarket, dan toko oleh-oleh.
- **Vision**: Menjadi rantai pasok makanan ringan khas Indonesia nomor satu yang terpercaya, konsisten, dan transparan melalui digitalisasi inventaris modern.
### Mission

- Menjamin ketersediaan stok camilan berkualitas tinggi tanpa hambatan rantai pasok.
- Mendukung pertumbuhan bisnis mitra ritel dan horeka melalui koordinasi stok cerdas dan terprediksi.
- Mengintegrasikan teknologi AI dan analitik data untuk pencegahan kehabisan stok (zero stockout).
### Operating Hours

- **Office**: Senin - Jumat: 08:00 - 17:00 WIB
- **Warehouse Delivery**: Senin - Sabtu: 07:00 - 16:00 WIB
- **Partner App Support**: Setiap hari (24/7 online)
## Official Products

### Item #1

- **Sku**: DSK-SB-001
- **Name**: Seblak Jadul Instan
- **Category**: Camilan Berkuah / Instan
- **Price B2B**: 12000
- **Description**: Seblak instan otentik dengan racikan kencur alami, aneka kerupuk kenyal khas Bandung, dan sambal pedas daun jeruk sedap.
### Item #2

- **Sku**: DSK-BR-002
- **Name**: Basreng Daun Jeruk
- **Category**: Camilan Kering / Renyah
- **Price B2B**: 10000
- **Description**: Bakso goreng renyah bumbu cabai rawit merah berpadu irisan daun jeruk segar beraroma khas gurih pedas.
### Item #3

- **Sku**: DSK-MK-003
- **Name**: Makaroni Daun Jeruk
- **Category**: Camilan Kering / Renyah
- **Price B2B**: 8500
- **Description**: Makaroni spiral gurih dengan tingkat kerenyahan renyah gurih pedas taburan daun jeruk.
### Item #4

- **Sku**: DSK-KP-004
- **Name**: Keripik Pisang Rasa Coklat
- **Category**: Camilan Manis
- **Price B2B**: 15000
- **Description**: Keripik pisang kepok renyah dengan balutan cokelat lumer tebal khas oleh-oleh modern.
## Sop Procedures

### Scan Barcode Delivery

- **Title**: SOP Penerimaan Barang & Scan Resi Barcode Pengiriman
- **Summary**: Prosedur wajib mitra saat menerima paket dus kiriman logistik Daisuki dari gudang pusat.
#### Steps

##### Item #1

- **Step Number**: 1
- **Name**: Terima Paket Dus & Cek Fisik
- **Action**: Terima dus paket dari kurir logistik Daisuki. Pastikan segel kemasan dan dus dalam kondisi baik tidak rusak atau basah.
##### Item #2

- **Step Number**: 2
- **Name**: Buka Menu Lacak di Portal Mitra
- **Action**: Login ke portal Mitra, buka tab 'Lacak'. Cari pesanan yang berstatus 'Dalam Pengiriman' (ikon truk).
##### Item #3

- **Step Number**: 3
- **Name**: Tekan Tombol Scan Barcode
- **Action**: Klik kartu pesanan terkait, lalu tekan tombol 'Scan Barcode'.
##### Item #4

- **Step Number**: 4
- **Name**: Pindai Barcode / Ketik Nomor Resi
- **Action**: Kamera scanner akan aktif. Arahkan kamera ke Barcode / QR Code pada Surat Jalan. Jika kamera terkendala, ketikkan kode resi yang tertera pada surat jalan di kolom input.
##### Item #5

- **Step Number**: 5
- **Name**: Verifikasi & Stok Bertambah Otomatis
- **Action**: Setelah resi terverifikasi, sistem otomatis mengubah status pesanan menjadi 'Selesai'. Sisa stok fisik toko Anda akan bertambah seketika sebesar jumlah yang disetujui (qty_approved).
#### Important Notes

- Stok toko tidak akan bertambah sebelum resi kurir discan dan diverifikasi.
- Kuantitas yang masuk ke stok toko adalah qty_approved dari admin pusat, bukan qty awal yang diminta jika ada penyesuaian alokasi gudang.
### Daily Stock Reporting

- **Title**: SOP Pelaporan Stok Fisik Harian (Tutup Toko)
- **Summary**: Prosedur penghitungan dan input sisa stok harian untuk mendeteksi laju konsumsi dan mencegah stok kritis.
#### Steps

##### Item #1

- **Step Number**: 1
- **Name**: Hitung Sisa Fisik di Rak Toko
- **Action**: Saat toko tutup atau pergantian shift sore, hitung sisa fisik 4 produk resmi yang ada di rak dan etalase toko.
##### Item #2

- **Step Number**: 2
- **Name**: Buka Menu Stok Saya di Portal Mitra
- **Action**: Buka tab 'Stok Saya' pada aplikasi portal mitra.
##### Item #3

- **Step Number**: 3
- **Name**: Masukkan Angka Sisa Fisik
- **Action**: Gunakan tombol counter minus/plus atau ketik langsung angka sisa fisik pada kartu masing-masing produk.
##### Item #4

- **Step Number**: 4
- **Name**: Simpan Laporan Stok
- **Action**: Tekan tombol 'Simpan Laporan Stok Fisik'. Laporan akan memperbarui log mutasi dan status kesehatan stok.
#### Important Notes

- Cabang mitra tidak memiliki batas maksimum stok. Buffer minimal hanya ambang peringatan dini.
- Laporan yang tidak diperbarui lebih dari 24 jam akan diberi status 'Belum Update' (Stale).
### Restock Order Submission

- **Title**: SOP Pengajuan Pesanan Restock ke Gudang Pusat
- **Summary**: Prosedur pemesanan pasokan tambahan ketika stok mendekati batas buffer minimal.
#### Steps

##### Item #1

- **Step Number**: 1
- **Name**: Buka Menu Restock
- **Action**: Pilih tab menu 'Restock' pada portal mitra.
##### Item #2

- **Step Number**: 2
- **Name**: Cek Stok Gudang Pusat
- **Action**: Perhatikan kolom 'Stok Pusat'. Pemesanan dibatasi oleh ready stock yang tersedia di gudang pusat saat transaksi.
##### Item #3

- **Step Number**: 3
- **Name**: Pilih Kuantitas & Catatan
- **Action**: Tentukan jumlah pcs per produk yang ingin dipesan. Tambahkan catatan bila ada permintaan khusus (misal: pengiriman hari Sabtu).
##### Item #4

- **Step Number**: 4
- **Name**: Kirim Pengajuan (Generate PO)
- **Action**: Tekan tombol 'Kirim Pengajuan Restock'. Sistem akan membuat nomor pesanan resmi dengan status 'Diproses'.
#### Important Notes

- Admin pusat akan mereview PO dan dapat menyetujui penuh atau menyetujui parsial tergantung alokasi logistik.
- Stok gudang pusat direservasi saat mitra mengajukan pesanan. Persetujuan parsial mengembalikan selisih yang tidak disetujui.
### Profile Update

- **Title**: SOP Pembaruan Profil Cabang & PIC
- **Summary**: Prosedur melengkapi data penanggung jawab dan alamat kirim armada.
#### Steps

##### Item #1

- **Step Number**: 1
- **Name**: Buka Menu Profil
- **Action**: Klik tab 'Profil' di navigasi portal mitra.
##### Item #2

- **Step Number**: 2
- **Name**: Lengkapi Data PIC & Alamat Wilayah
- **Action**: Pastikan Nama Toko, Nama PIC, No Telepon WhatsApp aktif, Alamat Jalan, Provinsi, Kota/Kabupaten, Kecamatan, dan Kelurahan terisi lengkap.
##### Item #3

- **Step Number**: 3
- **Name**: Simpan Perubahan
- **Action**: Tombol 'Simpan profil' akan aktif hijau saat terdeteksi perubahan. Klik tombol untuk menyimpan.
## Security And Tenant Boundary

### Rules

#### Item #1

- **Id**: SEC-01
- **Name**: Isolasi Data Antar Mitra (Tenant Isolation)
- **Principle**: Mitra HANYA boleh mengakses data cabang sendiri.
##### Prohibited Actions

- Menanyakan sisa stok cabang mitra lain (contoh: 'berapa stok mitra 3?')
- Menanyakan alamat, nama PIC, no telepon mitra cabang lain
- Meminta perbandingan penjualan atau omset cabang tertentu
- **System Response Policy**: Tolak secara tegas dan profesional dengan menyatakan bahwa data operasional antar cabang bersifat rahasia dan dilindungi oleh kebijakan privasi perusahaan.
#### Item #2

- **Id**: SEC-02
- **Name**: Asisten Bersifat Baca Saja (Read-Only AI)
- **Principle**: AI tidak boleh mengeksekusi mutasi langsung pada database.
##### Prohibited Actions

- Mengklaim sudah mengubah angka stok
- Mengklaim sudah membuatkan pesanan PO
- Mengklaim sudah membatalkan pesanan
- **System Response Policy**: Berikan panduan langkah-langkah ke form UI terkait agar mitra melakukan aksi secara resmi lewat antarmuka.

---
*Catatan Sistem: File ini digenerate secara otomatis oleh pipeline training Daisuki Mainbrain. Jangan mengubah format header.*
