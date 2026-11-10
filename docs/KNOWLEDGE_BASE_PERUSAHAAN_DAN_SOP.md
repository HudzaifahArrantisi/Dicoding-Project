# Basis Pengetahuan Perusahaan & SOP Daisuki B2B
Dokumen Resmi Profil PT, 4 Produk Resmi, SOP Operasional Mitra, dan Protokol Keamanan AI.

---

## 1. Profil & Identitas Perusahaan

- **Nama Brand**: Daisuki Snack & Food B2B
- **Badan Hukum**: PT Daisuki Pangan Indonesia
- **Tahun Berdiri**: 2023
- **Inisiator / Pendiri**: Tim Pendiri Daisuki Indonesia (Inisiatif Kuliner Nusantara)
- **Kantor Pusat**: Surabaya, Jawa Timur, Indonesia
- **Model Bisnis**: Rantai Pasok B2B (*Business-to-Business*) Camilan & Makanan Ringan khas Nusantara.
- **Klien & Mitra**: Hotel, Kafe, Restoran, Minimarket, Swalayan, Toko Oleh-oleh, dan Kantin Modern.
- **Visi**: Menjadi rantai pasok makanan ringan khas Indonesia nomor satu yang terpercaya, konsisten, dan transparan melalui digitalisasi inventaris modern.
- **Misi**:
  1. Menjamin pasokan camilan berkualitas tinggi tanpa hambatan rantai pasok.
  2. Memberdayakan mitra ritel dengan visibilitas stok yang transparan dan akurat.
  3. Menggunakan analitik dan AI untuk mencegah kehabisan stok (*zero stockout*).

---

## 2. Katalog 4 Produk Resmi Daisuki

Sistem Daisuki B2B berfokus pada 4 produk unggulan resmi berikut:

1. **Seblak Jadul Instan** (`DSK-SB-001`)
   - *Kategori*: Camilan Berkuah / Instan
   - *Harga B2B*: Rp12.000 / pcs
   - *Deskripsi*: Seblak instan otentik dengan racikan kencur alami, aneka kerupuk kenyal khas Bandung, dan sambal pedas daun jeruk sedap.
2. **Basreng Daun Jeruk** (`DSK-BR-002`)
   - *Kategori*: Camilan Kering / Renyah
   - *Harga B2B*: Rp10.000 / pcs
   - *Deskripsi*: Bakso goreng renyah bumbu cabai rawit merah berpadu irisan daun jeruk segar beraroma khas gurih pedas.
3. **Makaroni Daun Jeruk** (`DSK-MK-003`)
   - *Kategori*: Camilan Kering / Renyah
   - *Harga B2B*: Rp8.500 / pcs
   - *Deskripsi*: Makaroni spiral gurih dengan tingkat kerenyahan renyah gurih pedas taburan daun jeruk.
4. **Keripik Pisang Rasa Coklat** (`DSK-KP-004`)
   - *Kategori*: Camilan Manis
   - *Harga B2B*: Rp15.000 / pcs
   - *Deskripsi*: Keripik pisang kepok renyah dengan balutan cokelat lumer tebal khas oleh-oleh modern.

---

## 3. SOP Operasional Mitra Cabang (Step-by-Step)

### A. SOP Penerimaan Barang & Scan Barcode Resi Kiriman
Digunakan saat kurir logistik Daisuki tiba membawa dus pengiriman:
1. **Langkah 1 (Cek Fisik)**: Terima dus pengiriman dari armada ekspedisi Daisuki. Pastikan segel dus dalam kondisi utuh.
2. **Langkah 2 (Buka Lacak)**: Buka portal Mitra di HP, pilih menu **Lacak**, cari pesanan dengan status `Dalam Pengiriman`.
3. **Langkah 3 (Scan Barcode)**: Klik kartu pesanan tersebut dan tekan tombol **Scan Barcode**.
4. **Langkah 4 (Pindai Barcode / Resi)**: Kamera pemindai akan terbuka. Arahkan kamera ke Barcode / QR Code pada Surat Jalan. Jika kamera bermasalah, masukkan kode resi yang tercetak pada surat jalan.
5. **Langkah 5 (Verifikasi)**: Sistem memverifikasi resi. Status pesanan berubah menjadi `Selesai`, dan sisa stok toko bertambah seketika sebesar jumlah yang disetujui (`qty_approved`).

### B. SOP Pelaporan Stok Fisik Harian (Tutup Toko)
1. **Langkah 1**: Hitung sisa fisik 4 produk di rak/etalase saat tutup toko.
2. **Langkah 2**: Buka tab **Stok** di portal mitra.
3. **Langkah 3**: Masukkan angka fisik menggunakan tombol plus/minus atau ketik langsung.
4. **Langkah 4**: Tekan **Simpan Laporan Stok**.

### C. SOP Pengajuan Restock ke Gudang Pusat
1. **Langkah 1**: Buka tab **Restock**.
2. **Langkah 2**: Periksa kolom **Stok Pusat** (pemesanan dibatasi oleh ready stock gudang pusat).
3. **Langkah 3**: Tentukan kuantitas pesanan dan sertakan catatan operasional jika ada.
4. **Langkah 4**: Tekan **Kirim Pengajuan Restock** untuk menghasilkan nomor PO resmi.

---

## 4. Kebijakan Keamanan Data Multi-Tenant & Perlindungan AI

1. **Isolasi Data Cabang (Tenant Isolation)**:
   - Setiap mitra cabang HANYA berhak mengakses data operasional cabang miliknya sendiri.
   - AI DILARANG membocorkan sisa stok, alamat, nomor telepon PIC, omset, atau catatan cabang lain kepada pihak mana pun.
   - Contoh respon penolakan aman:
     > *"Mohon maaf, demi menjaga kerahasiaan dan privasi bisnis antar-mitra Daisuki, saya tidak memiliki akses ke data operasional, sisa stok, atau alamat cabang mitra lainnya."*
2. **Sifat Asisten Baca-Saja (Read-Only Guardrail)**:
   - AI bertindak sebagai pemandu operasional dan penganalisis data, bukan eksekutor mutasi database langsung.
   - AI dilarang mengaku telah mengubah stok atau membuat pesanan. Mitra harus diarahkan ke form UI terkait.
3. **Kapasitas Stok Bebas (Unbounded Stock)**:
   - Cabang mitra tidak memiliki batas maksimum kapasitas rak (tidak ada plafon 40 pcs). Nilai buffer minimal hanyalah batas pengingat keselamatan (*safety stock*).
