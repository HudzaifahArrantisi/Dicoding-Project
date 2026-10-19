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
- **Monitoring Stok Cabang**: Memantau kesehatan stok seluruh cabang mitra dalam tampilan 1 kartu per cabang dengan accordion detail produk dan progress bar kapasitas rak (`RakBar`).
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
- **Konfirmasi Penerimaan Barang**: Mengonfirmasi saat barang kiriman tiba di cabang (`dalam_pengiriman` ➔ `selesai`). Begitu dikonfirmasi, stok cabang bertambah sebesar jumlah yang disetujui (`qty_approved`) dan stok gudang pusat berkurang otomatis.

---

## 3. Pembagian Peran Tim Pengembang

Berdasarkan [docs/PEMBAGIAN_TUGAS.md](docs/PEMBAGIAN_TUGAS.md):

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
├── supabase/
│   ├── migrations/    # Sumber kebenaran skema SQL Neon DB PostgreSQL
│   └── seed.sql       # Data inisialisasi pengembangan
└── docs/              # Dokumentasi arsitektur, panduan alur, dan pembagian tugas
```

---

## 5. Aturan Bisnis & State Machine

1. **Kalkulasi Status Stok Cabang**:
   - `aman`: Stok > 50% dari kapasitas rak (`par_level`).
   - `waspada`: Stok antara 20% s.d. 50%.
   - `kritis`: Stok < 20% (atau sisa ≤ 10 pcs).
   - `is_stale`: Cabang belum memperbarui laporan stok fisik dalam waktu > 24 jam.

2. **Siklus Status Pesanan Restock**:
   ```text
   diproses ➔ disetujui (atau ditolak / dibatalkan) ➔ dalam_pengiriman ➔ selesai
   ```
   - Stok cabang **hanya bertambah** saat pesanan berpindah dari `dalam_pengiriman` ke `selesai` melalui konfirmasi penerimaan oleh Mitra.
   - Penambahan stok di cabang menggunakan nilai `qty_approved` (bukan `qty_requested`).

3. **Batasan Mutasi Database (Strict Mutation Boundary)**:
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
