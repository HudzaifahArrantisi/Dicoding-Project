# Brain Knowledge: Company Knowledge
> **Sumber Dokumen**: `company_knowledge.json`
> **Tipe Dokumen**: Dataset JSON / Knowledge Base (Publik)
> **Ukuran Asli**: 9,209 bytes
> **Status Ingestion**: Terverifikasi dan siap digunakan oleh Daisuki AI RAG

---

## 1. Company Profile
- **Brand Name**: Daisuki Snack & Food B2B
- **Legal Entity**: PT Daisuki Pangan Indonesia
- **Founding Year**: 2023
- **Founder**: Tim Pendiri Daisuki Indonesia (Inisiatif Kuliner Nusantara)
- **Headquarters**: Surabaya, Jawa Timur, Indonesia
- **Business Model**: B2B (Business-to-Business) Food & Beverage Supply Chain
- **Description**: Daisuki adalah produsen dan distributor makanan ringan/camilan khas Indonesia berkualitas premium yang memasok jaringan mitra ritel, hotel, kafe, restoran, minimarket, dan toko oleh-oleh.
- **Vision**: Menjadi rantai pasok makanan ringan khas Indonesia nomor satu yang terpercaya, konsisten, dan transparan melalui digitalisasi inventaris modern.
- **Mission**:
  1. Menjamin ketersediaan stok camilan berkualitas tinggi tanpa hambatan rantai pasok.
  2. Mendukung pertumbuhan bisnis mitra ritel dan horeka melalui koordinasi stok cerdas dan terprediksi.
  3. Mengintegrasikan teknologi AI dan analitik data untuk pencegahan kehabisan stok (zero stockout).
- **Operating Hours**:
  - Kantor: Senin - Jumat: 08:00 - 17:00 WIB
  - Gudang & Pengiriman: Senin - Sabtu: 07:00 - 16:00 WIB
  - Dukungan Aplikasi Mitra: Setiap hari (24/7 online)

---

## 2. 4 Official Products
1. **Seblak Jadul Instan** (`DSK-SB-001`): Rp12.000 / pcs, camilan berkuah instan racikan kencur alami dan aneka kerupuk kenyal khas Bandung pedas daun jeruk.
2. **Basreng Daun Jeruk** (`DSK-BR-002`): Rp10.000 / pcs, bakso goreng renyah bumbu cabai rawit merah berpadu irisan daun jeruk segar gurih pedas.
3. **Makaroni Daun Jeruk** (`DSK-MK-003`): Rp8.500 / pcs, makaroni spiral renyah gurih pedas taburan daun jeruk.
4. **Keripik Pisang Rasa Coklat** (`DSK-KP-004`): Rp15.000 / pcs, keripik pisang kepok renyah dengan balutan cokelat lumer tebal.

---

## 3. SOP Operasional Mitra
- **SOP Scan Barcode / Resi Kiriman**: Buka Lacak -> Pesanan Dalam Pengiriman -> Scan Barcode -> Arahkan kamera ke Barcode / QR Code pada Surat Jalan -> Stok toko bertambah seketika sebesar `qty_approved`.
- **SOP Lapor Stok Harian**: Buka Stok Saya -> Masukkan hitungan sisa fisik di etalase/rak -> Simpan Laporan Stok. Buffer minimal hanya batas peringatan dini, tanpa plafon kapasitas rak.
- **SOP Pengajuan Restock**: Buka Restock -> Periksa ready stock Gudang Pusat -> Masukkan kuantitas dan catatan -> Kirim Pengajuan Restock untuk menghasilkan nomor PO resmi.
- **SOP Profil Toko**: Buka Profil -> Lengkapi nama PIC, no WhatsApp, dan hierarki wilayah -> Simpan profil.
