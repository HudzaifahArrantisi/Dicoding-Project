# Daisuki B2B Inventory & Order Management System — AI Agent & Developer Guidelines

## 1. Tentang Proyek & Masalah yang Diselesaikan

**Daisuki Inventory** adalah platform manajemen inventaris dan pemesanan barang B2B (*Business-to-Business*) multi-tenant yang menghubungkan **Admin Daisuki Pusat** dengan **Mitra Cabang** (hotel, kafe, restoran, dan minimarket).

### Masalah Utama yang Diselesaikan:
1. **Blind Stock & Catatan Manual**: Stok di cabang mitra sering habis mendadak karena pencatatan manual via chat/spreadsheet yang tidak sinkron secara realtime.
2. **Koordinasi Lead Time Pabrik**: Produksi dan pengiriman dari pabrik Daisuki membutuhkan waktu (lead time 5–7 hari). Sistem ini memastikan cabang melakukan restock sebelum stok menyentuh batas kritis (*Safety Stock & Reorder Point*).
3. **Visibilitas Stok Gudang Pusat**: Mitra dapat memantau ketersediaan stok gudang pusat secara transparan saat mengajukan restock.
4. **Approval Restock Parsial & Transparan**: Admin pusat dapat menyetujui kuantitas per item sesuai alokasi gudang pusat serta menyertakan catatan penjelasan tertulis jika kuantitas disesuaikan.

### 4 Produk Resmi Daisuki:
1. **Seblak Jadul Instan**
2. **Basreng Daun Jeruk**
3. **Makaroni Daun Jeruk**
4. **Keripik Pisang Rasa Coklat**

---

## 2. Peran Pengguna Sistem (User Roles)

### A. Admin Daisuki Pusat (`role: "admin"`)
- **Monitoring Stok Cabang**: Memantau kesehatan stok seluruh cabang mitra dalam tampilan 1 kartu per cabang dengan modal detail produk dan ringkasan kuantitas sisa stok riil.
- **Monitoring Stok Gudang Pusat**: Memantau ketersediaan ready stock 4 produk di gudang pusat (kapasitas default 1.000 pcs per produk).
- **Approval & Pengiriman Restock**:
  - Tab **Menunggu Persetujuan**: Menyetujui kuantitas restock per produk (bisa disetujui penuh, parsial, atau 0) dan memberikan catatan penjelasan jika kuantitas disesuaikan.
  - Tab **Selesai / Disetujui**: Mengubah status menjadi `dalam_pengiriman` saat barang dikirim oleh ekspedisi/kurir logistik.
  - Tab **Ditolak**: Menolak pesanan dengan menyertakan alasan penolakan.
- **Alert & Notifikasi**: Menerima peringatan otomatis saat ada cabang yang stoknya kritis (< 20%) atau pesanan restock baru masuk.

### B. Mitra Cabang (`role: "mitra"`)
- **Laporan Stok Fisik Harian (Mobile Friendly)**: Mitra menginput sisa stok fisik di rak toko dengan cepat melalui perangkat mobile.
- **Monitoring Stok Gudang Pusat (Realtime)**: Melihat ketersediaan stok gudang pusat Daisuki secara langsung sebelum memesan.
- **Pengajuan Restock Multi-Item**: Mengajukan restock untuk beberapa atau ke-4 produk sekaligus dalam 1 nomor pesanan (`PO-...`).
- **Konfirmasi Penerimaan Barang**: Memindai QR/Barcode resi saat barang tiba (`dalam_pengiriman` ➔ `selesai`). Stok cabang bertambah sebesar `qty_approved`. Stok gudang pusat telah direservasi saat Mitra mengajukan pesanan.

---

## 3. Pembagian Peran Tim Pengembang

Berdasarkan [docs/ALUR_SISTEM_DAN_ROLE.md](docs/ALUR_SISTEM_DAN_ROLE.md):

| Peran Tim | Fokus & Tanggung Jawab | Lokasi Kode |
|---|---|---|
| **Fullstack Developer** | Arsitektur web, API backend, database schema, state management, dan antarmuka UI/UX (Admin & Mitra) | `apps/web/`, `apps/api/`, `packages/shared/` |
| **Data Science** | Analisis pola konsumsi cabang, pemodelan Safety Stock & Reorder Point (ROP), analisis fast-moving vs slow-moving, dan data sintetis | `data-science/` (Python, Pandas, Jupyter) |
| **AI Engineer** | Otomasi alert stok kritis (< 20%), scheduler reminder 24 jam untuk cabang yang belum lapor stok, rekomendasi kuantitas restock otomatis, dan asisten cerdas | `ai/` (Python scripts, cron jobs, LLM integration) |

---

## 4. Struktur Proyek & Workspace

Proyek ini menggunakan arsitektur **Bun Monorepo**:

```text
daisuki-inventory/
├── apps/
│   ├── web/           # Frontend: TanStack Start (React 19, Tailwind CSS v4, Vite, Cloudflare)
│   └── api/           # Backend: ElysiaJS, Bun runtime, Drizzle ORM, Neon DB, Jose JWT
├── packages/
│   └── shared/        # Shared package (@daisuki/shared): status enums, state machine, helper stok
├── data-science/      # Python workspace: EDA, notebook modeling, data sintetis
├── ai/                # Python workspace: alert jobs, reminder scheduler, bot
├── neon/
│   └── init.sql       # Sumber kebenaran skema SQL & data inisialisasi Neon DB PostgreSQL
└── docs/              # Dokumentasi arsitektur, panduan alur, dan pembagian tugas
```

---

## 5. Aturan Bisnis & State Machine

1. **Stok Cabang Tanpa Batas Atas**:
   - Tidak ada plafon stok per produk, kategori, atau mitra cabang. Angka 40 pcs maupun angka tetap lain tidak boleh menjadi kapasitas maksimum atau batas validasi laporan stok fisik.
   - Di seluruh UI Admin dan Mitra, tampilkan stok sebagai kuantitas riil (`{current_qty} pcs` atau `Sisa Stok`). Jangan tampilkan pembagi kapasitas seperti `/ 40 pcs`, `/ par`, atau `Sisa Stok / Par`.
   - Jangan memakai istilah `Kapasitas Rak` atau `Max Stock` untuk stok cabang. Gunakan `Sisa Stok`, `Buffer Minimal`, atau `Saran Pasokan` sesuai konteks.
   - Form pengajuan restok tidak memiliki plafon tetap. Jumlah yang dapat dipesan dibatasi hanya oleh stok fisik gudang pusat (`products.central_stock`) pada saat transaksi.
   - `par_level`, safety stock, dan threshold status hanya dipakai sebagai buffer pengaman serta analisis laju pemakaian; nilainya bukan kapasitas maksimum.

2. **Kalkulasi Status Stok Cabang**:
   - `aman`: Stok > 50% dari buffer acuan dinamis cabang.
   - `waspada`: Stok > 20% sampai dengan 50% dari buffer acuan dinamis cabang.
   - `kritis`: Stok ≤ 20% dari buffer acuan dinamis cabang.
   - `is_stale`: Cabang belum memperbarui laporan stok fisik dalam waktu > 24 jam.

3. **Siklus Status Pesanan Restock**:
   ```text
   diproses ➔ disetujui (atau ditolak / dibatalkan) ➔ dalam_pengiriman ➔ selesai
   ```
   - Stok cabang **hanya bertambah** saat pesanan berpindah dari `dalam_pengiriman` ke `selesai` melalui konfirmasi penerimaan oleh Mitra.
   - Penambahan stok di cabang menggunakan nilai `qty_approved` (bukan `qty_requested`).
   - Stok gudang pusat berkurang sebesar `qty_requested` saat Mitra mengajukan pesanan dalam transaksi dengan kunci baris produk (`FOR UPDATE`). Pesanan bersamaan tidak boleh memesan melebihi stok yang tersisa.
   - Penolakan atau pembatalan sebelum pengiriman mengembalikan seluruh reservasi. Persetujuan parsial mengembalikan selisih `qty_requested - qty_approved`; revisi persetujuan menyesuaikan selisih terhadap reservasi terakhir. Pengiriman dan penerimaan tidak mengurangi stok pusat lagi.
   - Mitra dapat mengedit pesanan `diproses` dan membatalkan pesanan `diproses` atau `disetujui` sebelum pengiriman.

4. **Batasan Mutasi Database (Strict Mutation Boundary)**:
   - Frontend **tidak boleh** melakukan mutasi atau query langsung ke database.
   - Semua mutasi stok, status pesanan, dan approval **wajib** melalui endpoint Elysia API di `apps/api/`.
   - `partner_id` **selalu ditentukan di sisi server** dari profil JWT pengguna terotentikasi, tidak boleh dipercaya mentah-mentah dari body request client.

---

## 6. Perintah Pengembangan & Eksekusi

Gunakan **strictly [Bun](https://bun.sh/)** untuk semua operasi JS/TS (jangan gunakan npm/yarn/pnpm):

```bash
bun install                 # Pasang seluruh dependensi workspace
bun run dev                 # Jalankan Web (port 3000) dan API (port 3001) bersamaan
bun run dev:web             # Jalankan hanya frontend web
bun run dev:api             # Jalankan hanya backend API
bun run typecheck           # Pemeriksaan tipe TypeScript di seluruh workspace
bun --cwd apps/web run lint # Linting frontend web
bun --cwd apps/web run build# Build production bundle frontend
```

### Setup Python Virtual Environment (`data-science/` & `ai/`):
```bash
cd data-science  # atau cd ai
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## 7. Standar Kode & Konvensi UI

1. **Tipografi & Desain**:
   - Judul & angka numerik besar: Font `Bricolage Grotesque` (`--font-display`).
   - Body & elemen formulir: Font `Figtree` (`--font-sans`).
   - Angka stok, harga, dan persentase: Wajib menggunakan `tabular-nums` (`.num`) agar angka sejajar secara vertikal.
   - Token status warna: Menggunakan semantic token (`--color-ok`, `--color-warn`, `--color-crit`, `--color-stale`).
   - Aksesibilitas Touch Mobile: Target sentuh di portal mitra minimal 44px.
2. **Kategori & Nama Produk**:
   - Di antarmuka pengguna frontend, tampilkan nama makanan resmi secara bersih tanpa menampilkan kode SKU internal.

---

<!-- antislop:start -->

## antislop

For UI, copy, people, mobile layout, or code comments work, read `antislop.md` (core) and then the skill for the task:

- UI / visual: `skills/antislop-ui/SKILL.md`
- Copy & text: `skills/antislop-copywriting/SKILL.md`
- People: `skills/antislop-human/SKILL.md`
- Mobile / responsive: `skills/antislop-layoutmobile/SKILL.md`
- Code comments: `skills/antislop-code/SKILL.md`

Before starting, ask the user when antislop applies: during the work, or after it is done.
<!-- antislop:end -->

---

## 8. Protokol Dokumentasi & Log Perubahan Harian (Daily Changelog Protocol)

1. **Wajib Baca Sebelum Bekerja**:
   - Seluruh AI Agent dan developer wajib membaca [AGENTS.md](AGENTS.md) dan [CLAUDE.md](CLAUDE.md) sebelum melakukan tindakan perubahan untuk memastikan konsistensi dan tidak melanggar aturan arsitektur.
2. **Auto-Catat Perubahan Harian**:
   - Setiap kali selesai melakukan perbaikan bug, penambahan fitur, atau refaktor kode, catat ringkasan perubahannya ke seksi ini di [AGENTS.md](AGENTS.md) dan [CLAUDE.md](CLAUDE.md) dengan tanggal hari pengerjaan (`YYYY-MM-DD`).

### Catatan Perubahan Harian (Daily Changelog)

#### 2026-11-09
- **Perbaikan Error 42703 pada Daftar Mitra**: Menerapkan migrasi `20261109_partner_type_other.sql` pada database Neon yang dipakai API dan memverifikasi kolom `partners.type_other` tersedia sebagai `text`.
- **Jenis Perusahaan Lainnya Dapat Diisi Manual**: Form Tambah/Ubah Mitra menampilkan input wajib saat kategori `lainnya` dipilih; API memvalidasi dan menyimpan teks pada `partners.type_other`, lalu daftar dan detail mitra menampilkan nilainya. Skema Neon dan migrasi kolom baru turut ditambahkan.
- **Dinamis Button Simpan Profil Mitra**: Mengubah tombol "Simpan profil" di portal Mitra ([apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx)) agar memiliki state dinamis berdasarkan perubahan input form (`hasChanges`). Saat belum ada perubahan data, tombol berstatus nonaktif dengan warna `bg-gray-400 cursor-not-allowed`. Saat terdeteksi perubahan pada nama mitra, PIC, telepon, alamat, wilayah, atau foto profil, tombol otomatis aktif dengan warna hijau `bg-emerald-600 hover:bg-emerald-700 cursor-pointer`.
- **Tab Dalam Pengiriman di Approval dan Pengiriman Admin**: Menambahkan tab baru **"Dalam Pengiriman"** pada sub-navigasi panel *Approval dan pengiriman* (`OrderApprovalPanel`) di [apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx). Memperbarui tipe `OrderCategoryTab` (`'menunggu' | 'dalam_pengiriman' | 'selesai' | 'ditolak'`), memisahkan counter `shippingCount` (`status === 'dalam_pengiriman'`) dan `completedCount` (`['disetujui', 'selesai']`), menyematkan tombol tab bergaya `Truck` icon dengan badge count biru operasional (`bg-blue-600`), menyediakan empty state informatif saat tidak ada barang dalam perjalanan armada logistik, serta menyelaraskan navigasi notifikasi dari alert pesanan baru (`parsed.type === 'new_order'`).
- **Optimalisasi Grid Log Pengiriman Admin di Mobile**: Merefaktor tampilan Log Pengiriman (`ShipmentLogPanel`) di dashboard admin ([apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx)) dari format baris vertikal panjang menjadi **Responsive Card Grid** (`grid-cols-1 md:grid-cols-2`). Di mode mobile (layar HP), informasi teks panjang dipadatkan: tanggal panjang diganti format ringkas (`9 Nov, 14:30 WIB`), daftar rincian nama produk panjang diringkas menjadi ringkasan muatan (`Muatan: X macam produk · Total Y pcs`), badge status logistik dibuat kompak (`Diterima` / `Dikirim`), serta penataan tombol bukti dan navigasi pesanan dirapikan secara horizontal agar kartu tidak memanjang dan nyaman dibaca.

#### 2026-11-08
- **Penyederhanaan UI AI Insights**: Mengganti empat kartu analisis yang tinggi dan berwarna berbeda menjadi ringkasan ringkas berpalet Daisuki dengan satu temuan utama, metrik pendukung, dan akses rincian yang jelas. Header dipadatkan, status model dan tombol persetujuan tetap terlihat, modal memakai donut 2D, serta angka pangsa dan aktivitas wilayah hanya berasal dari data analitik nyata.
- **Simplifikasi Tab AI Insights Menjadi 4 Grid Kategori & 3D Pie Chart Detail**: Merefaktor antarmuka tab AI Insights admin ([apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx)) yang sebelumnya padat menjadi **4 Grid Card Kategori Utama** responsif (`grid-cols-1 md:grid-cols-2`): (1) *Analisis 4 Produk Paling Laku*, (2) *Analisis Mitra Paling Laku*, (3) *Analisis Wilayah Paling Laku*, dan (4) *Analisis Mitra Paling Aktif Update Stok*. Setiap kartu menampilkan highlight juara #1, metrik operasional kunci, dan pemicu modal. Dibuat komponen modal baru di [apps/web/src/components/inventory/ai-insights-modals.tsx](apps/web/src/components/inventory/ai-insights-modals.tsx) (`ProductSalesDetailModal`, `TopPartnersDetailModal`, `TopRegionsDetailModal`, `ActiveReportingPartnersModal`) yang menyajikan visualisasi **Grafik 3D Pie Chart (`ThreeDPieChart`)** interaktif dan tabel data mendalam. Dokumentasi arsitektur dan prompt instruksi dicatat di [docs/PROMPT_AI_INSIGHTS_4_GRID.md](docs/PROMPT_AI_INSIGHTS_4_GRID.md).
- **Border Navbar Mitra**: Mempertegas garis tepi navbar mengambang portal Mitra dengan token `ink-700` transparan pada border dan ring agar kontur kapsul terlihat di atas latar terang, tanpa mengubah animasi atau posisi menu.
- **Agregasi per Mitra & Modal Detail pada Risiko Stok Cabang AI Insights**: Mengubah tampilan tabel "Risiko stok cabang" di tab AI Insights ([apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx)) dari yang sebelumnya me-loop baris berulang per produk (sehingga mitra yang sama muncul berkali-kali) menjadi **1 baris ringkas per mitra cabang**. Menambahkan komponen modal baru `PartnerDeficitModal` ([apps/web/src/components/inventory/partner-deficit-modal.tsx](apps/web/src/components/inventory/partner-deficit-modal.tsx)) yang terbuka saat baris mitra diklik, menampilkan rincian seluruh produk bermasalah/kategori berisiko, sisa stok, cakupan hari, akar masalah, serta rekomendasi tindakan solusi AI khusus untuk cabang tersebut.
- **Refaktor AI Insights Admin**: Merangkum metrik operasional di bawah header, menempatkan tabel mitra perlu perhatian sebelum diagram wilayah, menyatukan performa mitra dan pangsa 4 produk resmi, serta menghapus panduan statis dan toggle 3D pada visual wilayah. Filter wilayah dipadatkan, mitra tanpa lokasi ditampilkan sebagai banner, dan analisis defisit, pasokan pabrik, fakta mingguan, serta API AI tetap tersedia.
- **Perbaikan Input Counter Stok (Eliminasi Leading Zero '010')**: Mengganti input native `type="number"` dengan komponen terkontrol `NumericStockInput` pada Laporan Harian dan Form Restock Mitra ([apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx)). Mengatasi bug browser saat nilai awal `0` diubah menjadi angka lain (seperti `10`) yang sebelumnya memunculkan `010` karena browser tidak memperbarui string teks input jika nilai numeriknya dianggap sama. Kini saat input berfokus pada angka `0`, teks otomatis dikosongkan/diseleksi, input memvalidasi dan memangkas leading zero via regex (`/^0+(?=\d)/`), serta menghilangkan tombol panah stepper bawaan browser yang bertumpuk dengan tombol counter minus/plus.
- **Grid Layout Laporan Harian Stok Mitra**: Mengubah tampilan daftar "Stok Saya" pada Laporan Harian di portal Mitra ([apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx)) dari format baris vertikal (*vertical list divide-y*) menjadi **Grid Card Layout responsif** (`grid-cols-1 sm:grid-cols-2`). Setiap produk kini tampil dalam kartu mandiri berbingkai dengan header status, display sisa stok numerik besar, highlight visual dinamis saat kuantitas diubah, dan tombol counter sentuh (`min-h-11`) yang ringkas dan efisien tanpa memakan ruang vertikal berlebih.
- **Perbaikan Animasi & Clipping Apple Liquid Glass**: Memperbaiki bug animasi tab yang membeku di index awal dan clipping border navbar pada Admin dan Mitra ([apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx), [apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx), [apps/web/src/styles.css](apps/web/src/styles.css)). Memindahkan transform kalkulasi animasi dari inline string Tailwind yang rapuh ke utilitas CSS terkompilasi (`.liquid-pill-active-x`, `.liquid-pill-hover-x`, `.liquid-pill-active-y-48`, `.liquid-pill-hover-y-48`, `.liquid-pill-active-mitra`), menambahkan `overflow-hidden` pada container `nav` agar kapsul aktif melengkung sempurna mengikuti kurva kaca tanpa keluar dari border luar navbar, serta memastikan tab yang aktif (seperti "Mitra") selalu terlapisi kapsul gelap kontras di posisi yang presisi.

#### 2026-11-07
- **Apple Liquid Glass Navigation (Mitra & Admin)**: Menerapkan estetika navigasi Apple iOS / iPhone *Liquid Glass* ke portal Mitra dan dashboard Admin ([apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx), [apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx), [apps/web/src/styles.css](apps/web/src/styles.css)). Memperbaiki bug delay/lag saat kursor bergerak atau berpindah antar menu dengan mengisolasi komponen `AdminFloatingNavbar` ke sub-komponen mandiri (sebelumnya state hover berada di root `AdminDashboard` sehingga me-re-render seluruh 3.600 baris dashboard pada setiap gerakan mouse), mengganti kurva overshoot memantul dengan kurva *Apple fluid deceleration* yang mulus (`duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]`), akselerasi perangkat keras GPU (`transform-gpu will-change-transform`), menyelaraskan transisi warna teks (`transition-colors duration-200`), serta penyesuaian token gradient `--color-ink-950` agar warna tab aktif tidak memudar/transparan di sisi kanan.
- **Button Keluar Hover Styling**: Memperbarui efek hover pada tombol "Keluar" di dashboard Admin (header & sidebar) serta portal Mitra (header & tab profil) menggunakan `hover:bg-crit-bg` dan `hover:text-crit-fg` serta penanda `focus-visible:outline-crit` agar transisi interaktif terlihat jelas dan konsisten dengan token tema bahaya/logout ([apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx), [apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx)).
- **Admin Approval Modal**: Memperbaiki alur penolakan restock agar form catatan admin dan form penolakan tidak bertumpuk/ganda (*double form*), dilengkapi template cepat dan validasi terisolasi ([apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx)).
- **Cetak Surat Jalan & Resi**: Mengganti modal cetak resi menjadi dukungan penuh **Surat Jalan A4 Standar** (kop resmi Daisuki, tanda tangan 3 pihak, rincian produk, dan verifikasi QR/Barcode) serta opsi thermal 80 mm via isolasi iframe print engine ([apps/web/src/components/inventory/delivery-receipt-modal.tsx](apps/web/src/components/inventory/delivery-receipt-modal.tsx)).
- **Perencanaan Optimasi SSE & Cache**: Membuat arsitektur [planing.md](planing.md) untuk efisiensi request dan eliminasi polling manual dengan TanStack Query + SSE.
- **Protokol Log Perubahan Harian**: Menambahkan aturan wajib baca dan pencatatan log harian otomatis di [AGENTS.md](AGENTS.md) dan [CLAUDE.md](CLAUDE.md).
