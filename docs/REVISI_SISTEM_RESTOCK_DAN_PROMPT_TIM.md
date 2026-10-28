# Spesifikasi Revisi Sistem Restock, Resi Barcode/QR Code, dan Master Prompt Tim Monorepo

> **Pembaruan alur stok (28 Oktober 2026):** Permintaan terbaru menggantikan aturan pemotongan stok saat dispatch pada naskah awal di bawah. Input jumlah restock Mitra dimulai kosong, tanpa batas 40/80 pcs; batasnya hanya stok gudang pusat yang tersedia. Saat pengajuan, API mengunci baris produk (`FOR UPDATE`) dan mereservasi `qty_requested` dalam satu transaksi. Penolakan atau pembatalan mengembalikan seluruh reservasi; persetujuan parsial mengembalikan selisih terhadap `qty_approved`. Pengiriman tidak mengurangi stok pusat lagi. Implementasi operasional dijelaskan di [IMPLEMENTASI_RESTOCK_MINGGUAN.md](IMPLEMENTASI_RESTOCK_MINGGUAN.md).

Dokumen ini menggabungkan seluruh notulensi revisi sistem, rekomendasi teknis arsitektur, spesifikasi alur verifikasi resi berbasis pemindaian (Barcode/QR Code), serta pembagian tugas dan Master Prompt terintegrasi untuk 3 peran pengembang: **Fullstack Developer**, **Data Science**, dan **AI Engineer** pada monorepo Daisuki B2B Inventory.

---

## 1. Ringkasan Kebutuhan & Notulensi Revisi

| Poin Kebutuhan | Kondisi Lama | Solusi / Desain Sistem Baru |
| :--- | :--- | :--- |
| **Siklus Restock Mitra** | Harian tanpa agregasi terstruktur | **Laporan & siklus restock mingguan (Weekly Demand Cycle)** untuk efisiensi rantai pasok dan batching gudang pusat. |
| **Batas Maksimal Stok (Cap 40)** | Dibatasi maksimal 40 item per kategori/rak | **Batas kaku dihilangkan**. Mitra dapat mengajukan jumlah restock sesuai kebutuhan riil tanpa terkunci angka 40. |
| **Fleksibilitas Pesanan Mitra** | Pesanan terkunci setelah diajukan | **Fitur Edit & Cancel Restock**: Mitra dapat mengubah kuantitas atau membatalkan pesanan sebelum Admin mengirimkan barang. |
| **Pengurangan Stok Pusat** | Berkurang saat persetujuan (approval) | **Stok pusat Daisuki baru dipotong saat Admin menekan tombol "Kirim Barang"** (`dalam_pengiriman`) dengan row lock transaksi. |
| **Verifikasi Penerimaan Barang** | Tombol manual / upload foto opsional | **Sistem Resi Barcode & QR Code**: Admin mencetak surat jalan/kertas resi ber-QR & Barcode ke dalam box. Mitra **memindai (scan) QR/Barcode** melalui kamera HP untuk konfirmasi instan. |
| **Peran Data Science** | Log pembersihan dasar harian | **Pemodelan demand konsumsi mingguan**, profiling volatilitas stok, dan analisis clustering wilayah/mitra paling laris. |
| **Peran AI Engineer** | Rekomendasi alokasi statis | **Prediksi cerdas kebutuhan restock by demand per periode**, deteksi anomali (Kritis = Laris), dan proyeksi hotspot pasar otomatis. |

---

## 2. Arsitektur & Alur Kerja Sistem Baru (End-to-End Workflow)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. SIKLUS MINGGUAN & PENGAJUAN (MITRA)                                                 │
│    - Mitra mereview stok fisik mingguan tanpa batasan kaku 40 item.                    │
│    - Mengirim draft pengajuan restock.                                                 │
│    - Opsi Edit / Batalkan aktif selama pesanan belum diproses kirim.                   │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. PERSETUJUAN & DISPATCH PENGIRIMAN (ADMIN PUSAT)                                     │
│    - Admin memeriksa pengajuan & menyetujui kuantitas (qty_approved).                  │
│    - Admin menekan tombol "Kirim Barang":                                              │
│      * Database memotong `products.central_stock` secara realtime (FOR UPDATE lock).   │
│      * Sistem mengenerate `delivery_code` & token QR Code unik.                        │
│      * Status berubah menjadi 'dalam_pengiriman'.                                      │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. CETAK RESI FISIK BER-BARCODE & QR CODE (ADMIN)                                      │
│    - Admin mencetak Surat Jalan / Slip Resi dari tombol "Cetak Resi".                  │
│    - Lembar cetak berisi: Daftar Item, Info Cabang, dan QR Code + Barcode verifikasi.  │
│    - Kertas resi dimasukkan ke dalam paket box barang sebelum kurir berangkat.         │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 4. PENERIMAAN & PEMINDAIAN SCANNER (MITRA CABANG)                                      │
│    - Paket box tiba di lokasi mitra cabang.                                            │
│    - Mitra membuka tab 'Dalam Pengiriman' di aplikasi mobile/web Daisuki.              │
│    - Mitra menekan tombol "Scan QR / Barcode Resi" (membuka kamera perangkat).         │
│    - Kamera memindai QR Code di kertas resi (fallback: input kode teks manual).        │
│    - Sistem memvalidasi token:                                                         │
│      * Status pesanan berubah menjadi 'selesai'.                                       │
│      * Stok cabang bertambah otomatis sesuai kuantitas disetujui.                      │
│      * `stock_logs` tercatat otomatis sebagai bukti penerimaan sah.                    │
└───────────────────────────────────┬────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 5. AI & DATA SCIENCE LOOP (OTONOMI SETIAP MINGGU)                                      │
│    - Data Science menghitung profil demand & clustering wilayah paling laku.           │
│    - AI memprediksi kuantitas restock periode berikutnya & memberikan alert dini.      │
│    - Admin melihat proyeksi supply chain & ranking hotspot mitra di tab AI Insights.   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Spesifikasi Teknis & Database Schema Update

### 3.1 Perubahan Database PostgreSQL (`neon/init.sql` & `apps/api/src/db/schema.ts`)
Tambahkan field verifikasi pengiriman pada tabel `orders`:

```sql
-- Penambahan kolom resi pengiriman ber-QR / Barcode
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS delivery_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS delivery_qr_token TEXT,
  ADD COLUMN IF NOT EXISTS delivery_code_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cycle_period VARCHAR(20) DEFAULT 'weekly';

-- Index untuk mempercepat verifikasi scan barcode/QR
CREATE INDEX IF NOT EXISTS idx_orders_delivery_code ON orders (delivery_code);
CREATE INDEX IF NOT EXISTS idx_orders_qr_token ON orders (delivery_qr_token);
```

### 3.2 Aturan Transaksi Pemotongan Stok Pusat (`apps/api/src/modules/orders/`)
Pemotongan stok pusat **HANYA** dieksekusi saat transisi status ke `dalam_pengiriman`:

```typescript
// Saat Admin memicu status 'dalam_pengiriman'
await db.transaction(async (tx) => {
  for (const item of orderItems) {
    const qtyToDeduct = item.qty_approved ?? item.qty_requested;
    
    // Lock baris produk di gudang pusat untuk mencegah race condition
    const [centralProduct] = await tx
      .select({ central_stock: products.central_stock })
      .from(products)
      .where(eq(products.id, item.product_id))
      .for('update');

    if (!centralProduct || centralProduct.central_stock < qtyToDeduct) {
      throw new Error(`Stok pusat untuk produk ${item.product_name} tidak mencukupi`);
    }

    // Potong stok pusat
    await tx
      .update(products)
      .set({ central_stock: sql`${products.central_stock} - ${qtyToDeduct}` })
      .where(eq(products.id, item.product_id));
  }

  // Buat kode resi unik 8 karakter alfanumerik + payload QR token
  const deliveryCode = `DSK-${nanoid(6).toUpperCase()}`;
  const qrToken = Buffer.from(JSON.stringify({ orderId: order.id, code: deliveryCode })).toString('base64url');

  await tx
    .update(orders)
    .set({
      status: 'dalam_pengiriman',
      delivery_code: deliveryCode,
      delivery_qr_token: qrToken,
      updated_at: new Date(),
    })
    .where(eq(orders.id, order.id));
});
```

### 3.3 Verifikasi Scan Resi di Sisi Mitra (`apps/web/src/routes/mitra.tsx`)
1. Mitra menggunakan library scanner berbasis web standar (seperti `html5-qrcode` atau browser BarcodeDetector API).
2. Mitra mengarahkan kamera ke QR Code / Barcode yang tertempel pada box.
3. Payload hasil scan langsung dikirimkan ke endpoint `POST /orders/:id/verify-delivery`.
4. Jika payload valid, stok cabang bertambah dan modal sukses ditampilkan.

---

## 4. Matriks Pembagian Tugas 3 Role Monorepo

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   MONOREPO RESPONSIBILITY                              │
├─────────────────────────┬──────────────────────────────┬───────────────────────────────┤
│    FULLSTACK DEVELOPER  │       DATA SCIENCE           │         AI ENGINEER           │
│  (apps/web & apps/api)  │      (data-science/)         │            (ai/)              │
├─────────────────────────┼──────────────────────────────┼───────────────────────────────┤
│ 1. Hapus batasan max 40 │ 1. Analisis pola laju        │ 1. Engine prediksi demand     │
│    pada UI/schema input │    konsumsi mingguan (AWC)   │    mingguan per produk        │
│ 2. Logika Edit & Batal  │ 2. Identifikasi clustering   │ 2. Deteksi otomatis cabang    │
│    pesanan status awal  │    wilayah & mitra terlaris  │    dan area laku keras        │
│ 3. Pemotongan stok pusat│ 3. Formula ROP & safety      │ 3. Cron pipeline otomatis     │
│    saat dispatch kirim  │    stock dinamis             │    untuk update rekomendasi   │
│ 4. Fitur Cetak Resi     │ 4. Pembersihan dataset log   │ 4. Executive AI Digest pada   │
│    (Print Barcode & QR) │    penjualan per periode     │    Dashboard Admin            │
│ 5. Scanner kamera QR di │                              │                               │
│    portal mitra cabang  │                              │                               │
└─────────────────────────┴──────────────────────────────┴───────────────────────────────┘
```

---

## 5. Master Prompt Terpadu (Single Prompt untuk Seluruh Tim / Agen)

*Gunakan prompt di bawah ini untuk memulai eksekusi pengembangan sistem:*

```markdown
PROMPT: IMPLEMENTASI SISTEM RESTOCK MINGGUAN, VERIFIKASI RESI BARCODE/QR CODE, DAN PREDIKSI DEMAND AI (DAISUKI INVENTORY)

Halo Tim Pengembang (Fullstack, Data Science, AI Engineer),
Kita akan melakukan pembaruan besar pada sistem rantai pasok Daisuki B2B Inventory dengan mengimplementasikan siklus restock mingguan, verifikasi penerimaan barang fisik berbasis pemindaian Barcode/QR Code, pemotongan stok pusat saat barang diberangkatkan, serta penguatan analitik AI berbasis demand wilayah.

Seluruh tugas dijalankan pada monorepo Daisuki (`apps/web`, `apps/api`, `packages/shared`, `data-science`, `ai`). Berikut instruksi detail untuk masing-masing role:

================================================================================
BAGIAN 1: TUGAS FULLSTACK DEVELOPER (apps/web, apps/api, packages/shared)
================================================================================
1. Hapus Limit Maksimal Stok (Max 40 Item):
   - Hapus pembatasan `max={stock.par_level}` dan validasi yang mengunci kuantitas maksimal 40 pada `apps/web/src/routes/mitra.tsx` dan schema API.
   - Izinkan mitra memesan sesuai kapasitas dan estimasi kebutuhan mingguan mereka.

2. Fitur Edit dan Cancel Pengajuan Restock oleh Mitra:
   - Tambahkan tombol "Edit Pengajuan" dan "Batalkan Pesanan" di Portal Mitra jika pesanan masih berstatus 'diproses' (sebelum disetujui/dikirim admin).
   - Buat endpoint `PUT /orders/:id` (edit kuantitas item) dan `PATCH /orders/:id/cancel` dengan validasi kepemilikan tenant mitra.

3. Logika Pemotongan Stok Pusat Daisuki Saat Dispatch:
   - Ubah logika `PATCH /orders/:id/status` di `apps/api/src/modules/orders/`:
     * Stok gudang pusat (`products.central_stock`) TIDAK LAGI berkurang saat disetujui, melainkan HANYA berkurang saat Admin mengklik tombol "Kirim Sekarang" (transisi ke 'dalam_pengiriman').
     * Wajib menggunakan database transaction dengan `SELECT ... FOR UPDATE` untuk mencegah stok minus akibat race condition.
     * Buat kode resi unik alfanumerik (`delivery_code`) dan token QR (`delivery_qr_token`) pada pesanan tersebut.

4. Halaman Cetak Resi Pengiriman (Barcode & QR Code) untuk Admin:
   - Pada panel Admin (`apps/web/src/routes/admin.tsx`), di kartu pesanan yang siap dikirim/dalam pengiriman, tambahkan tombol "Cetak Resi / Surat Jalan".
   - Tampilkan tampilan print modal / printable document berstandar ukuran thermal/A5 berisi:
     * Header Daisuki Central Supply, Nomor Pesanan (PO), Nama Mitra, dan Alamat Tujuan.
     * Tabel rincian barang dan kuantitas disetujui.
     * Visualisasi BARCODE (Code128) dan QR CODE yang memuat kode verifikasi pengiriman.
     * Instruksi: "Kertas ini wajib dimasukkan ke dalam kardus pengiriman untuk discan oleh Mitra saat paket diterima."

5. Fitur Pemindai (Scanner) Barcode/QR Code di Portal Mitra:
   - Di `apps/web/src/routes/mitra.tsx` pada tab pesanan berstatus 'dalam_pengiriman':
     * Sediakan tombol "📷 Pindai QR / Barcode Resi".
     * Integrasikan pembaca kamera web/mobile (HTML5 QR Scanner) untuk membaca kode QR atau barcode pada kertas resi fisik di dalam box.
     * Sediakan opsi alternatif input kode alfanumerik jika kamera mengalami kendala.
     * Buat endpoint `POST /orders/:id/verify-delivery` yang memvalidasi token resi. Jika token valid:
       - Status pesanan berubah menjadi 'selesai'.
       - Stok mitra (`partner_stocks.current_qty`) bertambah otomatis sesuai `qty_approved`.
       - Catat `stock_logs` bertipe penerimaan barang resmi (`order_received`).

================================================================================
BAGIAN 2: TUGAS DATA SCIENCE (data-science/)
================================================================================
1. Pemodelan Demand Mingguan (Weekly Demand Profiling):
   - Buat skrip di `data-science/src/weekly_demand.py` untuk mengagregasi data transaksi dan log konsumsi dalam jendela mingguan (7 hari).
   - Hitung Average Weekly Consumption (AWC) dan koefisien variansi untuk setiap produk (DSK-SB-001 s/d DSK-KP-004).

2. Pemetaan & Analisis Prediksi Wilayah dan Mitra Paling Laku:
   - Kelompokkan performa konsumsi berdasarkan wilayah (Provinsi, Kota/Kabupaten, Kecamatan) dan tipe mitra (hotel, restoran, kafe, minimarket).
   - Identifikasi pola "Kritis = Laris": Cabang yang sering berstatus stok kritis karena perputaran barang tinggi (Fast-Moving Velocity), bukan karena kelalaian.
   - Hasilkan dataset bersih `data-science/data/weekly_market_hotspots.csv` yang memetakan wilayah dengan permintaan tertinggi.

3. Formulasi Reorder Point (ROP) & Safety Stock Dinamis:
   - Gantikan formula par level statis 40/60/80 dengan formula dinamis:
     ROP = (AWC_Harian * Lead_Time_Pusat) + Safety_Stock_Dinamis
     di mana Safety Stock dihitung berdasarkan standar deviasi fluktuasi konsumsi mingguan.

================================================================================
BAGIAN 3: TUGAS AI ENGINEER (ai/)
================================================================================
1. Pipeline Prediksi Rekomendasi Restock by Demand (Per Periode Mingguan):
   - Buat modul otonom di `ai/jobs/weekly_restock_predictor.py`.
   - Mengambil histori konsumsi dari PostgreSQL Neon dan menghitung rekomendasi kuantitas restock optimal untuk 7 hari ke depan bagi 100 mitra.
   - Tulis rekomendasi ke tabel `restock_recommendations` dengan metadata JSON:
     * `predicted_demand_units`: angka proyeksi konsumsi minggu depan.
     * `recommended_qty`: saran kuantitas restock yang aman.
     * `urgency`: status prioritas ('CRITICAL', 'WARNING', 'NORMAL').
     * `reasoning`: narasi analitik otomatis (misal: "Tren konsumsi Seblak di Bandung naik 40% menjelang akhir pekan").

2. AI Market Hotspot & Executive Digest:
   - Buat skrip di `ai/jobs/market_hotspot_analytics.py` yang mengekstrak rangkuman eksekutif:
     * 5 Mitra Terlaris (Top Performers).
     * 3 Wilayah Hotspot dengan potensi kekurangan pasokan terbesar.
     * Saran batch produksi ke pabrik Daisuki berdasarkan total defisit mitra.

3. Integrasi Penjadwalan Otomatis (Cron Job):
   - Daftarkan cron job berkala di `apps/api/src/index.ts` menggunakan `@elysiajs/cron` (misal: berjalan setiap Senin pukul 05:00 WIB) untuk memperbarui data analitik AI secara otonom tanpa intervensi manual.
   - Sediakan tombol manual trigger "⚡ Jalankan Analisis AI Sekarang" di tab AI Insights Admin untuk evaluasi on-demand.

================================================================================
STANDAR & ATURAN MONOREPO:
================================================================================
- Gunakan Bun secara konsisten (`bun run dev`, `bun run typecheck`).
- Semua mutasi database dilakukan via Elysia API (tidak ada query langsung dari UI).
- Gunakan Eden Treaty untuk end-to-end type safety antara frontend dan backend.
- UI menggunakan Tailwind CSS v4 dengan prinsip Antislop (clean, modern glassmorphism, mobile touch target minimal 44px, tidak menggunakan balok gelap kontras kaku).
```

---

## 6. Lokasi File & Langkah Tindak Lanjut

File ini disimpan secara permanen di repositori pada:
`c:\laragon\www\daisuki-inventory\docs\REVISI_SISTEM_RESTOCK_DAN_PROMPT_TIM.md`

Anda dapat langsung membagikan file ini atau menyalin bagian **Bagian 5 (Master Prompt)** kepada tim developer atau AI assistant untuk mengeksekusi fitur-fitur tersebut secara bertahap.
