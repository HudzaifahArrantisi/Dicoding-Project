# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Daisuki B2B Inventory & Order Management System is a multi-tenant platform for Daisuki central administration and partner branches (hotels, restaurants, cafes, minimarkets). It solves stock visibility, late restock cycles, and factory lead time coordination.

The codebase is organized as a Bun monorepo comprising a web frontend, backend API, shared TypeScript package, database migrations, and Python-based data science and AI workspaces.

---

## Development Commands

### Package Manager
- **Strictly use [Bun](https://bun.sh/)** for all JS/TS operations. Do **not** use `npm`, `yarn`, or `pnpm` (they corrupt [bun.lock](bun.lock) and workspace symlinks).

### Common Commands (Root)
- Install all workspace dependencies:
  ```bash
  bun install
  ```
- Run web frontend (port 3000) and API server (port 3001) concurrently:
  ```bash
  bun run dev
  ```
- Run only the frontend:
  ```bash
  bun run dev:web
  ```
- Run only the backend API:
  ```bash
  bun run dev:api
  ```
- Run TypeScript typecheck across all workspaces:
  ```bash
  bun run typecheck
  ```

### Frontend ([apps/web/](apps/web/))
- Typecheck:
  ```bash
  bun --cwd apps/web run typecheck
  ```
- Linting:
  ```bash
  bun --cwd apps/web run lint
  ```
- Formatting & ESLint auto-fix:
  ```bash
  bun --cwd apps/web run format
  bun --cwd apps/web run check
  ```
- Build production bundle (Vite + Cloudflare):
  ```bash
  bun --cwd apps/web run build
  ```
- Regenerate TanStack router tree:
  ```bash
  bun --cwd apps/web run generate-routes
  ```
- Add a new Shadcn UI component (run inside [apps/web/](apps/web/)):
  ```bash
  bunx --bun shadcn@latest add <component-name>
  ```

### Backend API ([apps/api/](apps/api/))
- Dev server with watch mode:
  ```bash
  bun --cwd apps/api run dev
  ```
- Start production server:
  ```bash
  bun --cwd apps/api run start
  ```
- Typecheck:
  ```bash
  bun --cwd apps/api run typecheck
  ```

### Python Workspaces ([data-science/](data-science/) & [ai/](ai/))
Both workspaces use Python virtual environments. PowerShell setup:
```powershell
cd data-science  # or cd ai
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## High-Level Architecture & Structure

```text
daisuki-inventory/
├── apps/
│   ├── web/           # Frontend: TanStack Start (React 19, Tailwind v4, Vite, Cloudflare)
│   └── api/           # Backend: ElysiaJS, Bun runtime, Drizzle ORM, Jose JWT
├── packages/
│   └── shared/        # Shared package (@daisuki/shared): enums, types, state machines
├── data-science/      # Python workspace: EDA, ROP/safety stock modeling, synthetic data
├── ai/                # Python workspace: batch restock jobs, LLM assistant, Telegram bot
├── neon/
│   └── init.sql       # Authoritative unified SQL schema, constraints, roles, and seed data for Neon DB
└── docs/
    └── ALUR_SISTEM_DAN_ROLE.md # Comprehensive system workflow, role guide, and business rules
```

### Core Architecture Rules

1. **Strict Mutation Boundary**:
   - The frontend **never writes directly** to database tables.
   - All mutations (stock adjustments, restock orders, status updates, approvals) **must** go through the Elysia backend API to ensure business validation and database transactions are centralized.
   - The frontend reads data via Elysia endpoints and client state cache (TanStack Query).

2. **End-to-End Type Safety**:
   - The Elysia app export `type App = typeof app` in [apps/api/src/index.ts](apps/api/src/index.ts) is imported directly by [apps/web/src/lib/api.ts](apps/web/src/lib/api.ts) via `@elysiajs/eden` (`treaty<App>(...)`).
   - Token authentication is handled automatically in the treaty `onRequest` hook using the JWT bearer token stored in localStorage (`daisuki_token`).

3. **Multi-Tenancy & Authorization**:
   - Two main roles: `admin` and `mitra`. Role and tenant linkage are in the `users` table (`role`, `partner_id`).
   - `partner_id` **must always be determined server-side** from the authenticated user's JWT payload in Elysia. Never accept `partner_id` blindly from a client request body.
   - Partner data isolation is enforced at Elysia route guards and schema constraints.

4. **Database & ORM Guidelines**:
   - **Source of Truth**: The unified SQL file in [neon/init.sql](neon/init.sql) is the authoritative database schema and initial seed source of truth.
   - [apps/api/src/db/schema.ts](apps/api/src/db/schema.ts) mirrors the database schema using Drizzle ORM for query building.
   - **Do not run `drizzle-kit push` or `drizzle-kit generate`**.
   - **Neon DB Connection Pooler**: Neon pooled connections work seamlessly with `{ prepare: false }` in [apps/api/src/db/client.ts](apps/api/src/db/client.ts).
   - **Concurrency Safety**: Stock updates in Elysia must wrap operations in transactions and use `SELECT ... FOR UPDATE` row locks to prevent race conditions when writing to `partner_stocks` and `stock_logs`.

5. **Shared Business Logic ([packages/shared/src/index.ts](packages/shared/src/index.ts))**:
   - **Unbounded Partner Stock**: No maximum stock per product, category, or branch. Never use 40 pcs or any other fixed ceiling for stock reports or restock requests. In Admin and Mitra UI, show stock as `{current_qty} pcs` or `Sisa Stok`, without `/40`, `/par`, or `Sisa Stok / Par`. Do not call a branch's stock ceiling `Kapasitas Rak` or `Max Stock`; use `Sisa Stok`, `Buffer Minimal`, or `Saran Pasokan` as appropriate. `par_level` and status thresholds are safety buffers and demand signals, never capacity caps. Restock requests are limited only by `products.central_stock` at transaction time.
   - **Stock Status**: Calculated relative to buffer thresholds:
     - `aman`: > 50%
     - `waspada`: > 20% to 50%
     - `kritis`: <= 20%
     - Stale: `updated_at` older than 24 hours (`isStale()`).
   - **Order State Machine**:
     - Statuses: `diproses` → `disetujui` (or `ditolak` / `dibatalkan`) → `dalam_pengiriman` → `selesai`.
     - Validated using `canTransition(from, to)`.
     - Stock quantities increase only when the partner confirms delivery (`dalam_pengiriman` → `selesai`).

6. **Data Science & AI Integration**:
   - DB Roles: Tim Data Science uses `ds_readonly` (read-only access to core tables), and AI jobs use `ai_job` (read tables, write to `restock_recommendations`). Neither role may use service role keys.
   - AI Assistant operates strictly read-only against Elysia API endpoints (no direct arbitrary SQL execution).

7. **Design System & UI Conventions**:
   - Fonts: Heading and major numerical displays use `Bricolage Grotesque` (`--font-display` / `.font-display`). Body and form elements use `Figtree` (`--font-sans` / `.font-sans`).
   - Tabular Numbers: All stock quantities, prices, and metrics must use `.num` (`tabular-nums`) to maintain vertical alignment.
   - Stock Status Colors: Defined in [apps/web/src/styles.css](apps/web/src/styles.css) as semantic tokens (`--color-ok`, `--color-warn`, `--color-crit`, `--color-stale` and their fg/bg variants).
   - Brand Accent: `Ume` (`#b83a6a`) is reserved for branding, login headers, and illustrations; never use it for buttons or status chips to avoid confusion with critical red.
   - Touch Accessibility: Partner portal is optimized for mobile with touch targets of at least 44px.

8. **Prosedur Otomatis Log Perubahan Harian (Daily Changelog Protocol)**:
   - **Sebelum Bekerja**: Agen/Developer **wajib membaca** [AGENTS.md](AGENTS.md) dan [CLAUDE.md](CLAUDE.md) untuk memahami konteks dan perubahan terbaru.
   - **Setelah Mengubah Kode**: Catat dokumentasi ringkas perubahan ke seksi `## Catatan Perubahan Harian (Daily Changelog)` di [CLAUDE.md](CLAUDE.md) dan [AGENTS.md](AGENTS.md) dengan format tanggal `YYYY-MM-DD`.

---

## Catatan Perubahan Harian (Daily Changelog)

### 2026-11-09
- **Grafik Analisis Python pada Log & Data**: Menambahkan tombol untuk menjalankan pipeline Python dari API admin, progres tiap skrip, grafik garis konsumsi stok fisik harian 14 hari dari log nyata, serta ringkasan klasifikasi risiko `daisuki.pkl` setelah pelatihan. Status pipeline diperbarui selama proses berjalan.
- **Perbaikan Error 42703 pada Daftar Mitra**: Menerapkan migrasi `20261109_partner_type_other.sql` pada database Neon yang dipakai API dan memverifikasi kolom `partners.type_other` tersedia sebagai `text`.
- **Jenis Perusahaan Lainnya Dapat Diisi Manual**: Form Tambah/Ubah Mitra menampilkan input wajib saat kategori `lainnya` dipilih; API memvalidasi dan menyimpan teks pada `partners.type_other`, lalu daftar dan detail mitra menampilkan nilainya. Skema Neon dan migrasi kolom baru turut ditambahkan.
- **Dinamis Button Simpan Profil Mitra**: Mengubah tombol "Simpan profil" di portal Mitra ([apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx)) agar memiliki state dinamis berdasarkan perubahan input form (`hasChanges`). Saat belum ada perubahan data, tombol berstatus nonaktif dengan warna `bg-gray-400 cursor-not-allowed`. Saat terdeteksi perubahan pada nama mitra, PIC, telepon, alamat, wilayah, atau foto profil, tombol otomatis aktif dengan warna hijau `bg-emerald-600 hover:bg-emerald-700 cursor-pointer`.
- **Tab Dalam Pengiriman di Approval dan Pengiriman Admin**: Menambahkan tab baru **"Dalam Pengiriman"** pada sub-navigasi panel *Approval dan pengiriman* (`OrderApprovalPanel`) di [apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx). Memperbarui tipe `OrderCategoryTab` (`'menunggu' | 'dalam_pengiriman' | 'selesai' | 'ditolak'`), memisahkan counter `shippingCount` (`status === 'dalam_pengiriman'`) dan `completedCount` (`['disetujui', 'selesai']`), menyematkan tombol tab bergaya `Truck` icon dengan badge count biru operasional (`bg-blue-600`), menyediakan empty state informatif saat tidak ada barang dalam perjalanan armada logistik, serta menyelaraskan navigasi notifikasi dari alert pesanan baru (`parsed.type === 'new_order'`).
- **Optimalisasi Grid Log Pengiriman Admin di Mobile**: Merefaktor tampilan Log Pengiriman (`ShipmentLogPanel`) di dashboard admin ([apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx)) dari format baris vertikal panjang menjadi **Responsive Card Grid** (`grid-cols-1 md:grid-cols-2`). Di mode mobile (layar HP), informasi teks panjang dipadatkan: tanggal panjang diganti format ringkas (`9 Nov, 14:30 WIB`), daftar rincian nama produk panjang diringkas menjadi ringkasan muatan (`Muatan: X macam produk · Total Y pcs`), badge status logistik dibuat kompak (`Diterima` / `Dikirim`), serta penataan tombol bukti dan navigasi pesanan dirapikan secara horizontal agar kartu tidak memanjang dan nyaman dibaca.

### 2026-11-08
- **AI Insights UI cleanup**: Reworked the four overview cards into compact, accessible summaries with restrained Daisuki colors, simplified the header, kept the detail modals and AI refresh actions, switched charts to 2D donuts, and removed fabricated fallback percentages and regional quantities.
- **Simplifikasi Tab AI Insights Menjadi 4 Grid Kategori & 3D Pie Chart Detail**: Merefaktor antarmuka tab AI Insights admin ([apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx)) yang sebelumnya padat menjadi **4 Grid Card Kategori Utama** responsif (`grid-cols-1 md:grid-cols-2`): (1) *Analisis 4 Produk Paling Laku*, (2) *Analisis Mitra Paling Laku*, (3) *Analisis Wilayah Paling Laku*, dan (4) *Analisis Mitra Paling Aktif Update Stok*. Setiap kartu menampilkan highlight juara #1, metrik operasional kunci, dan pemicu modal. Dibuat komponen modal baru di [apps/web/src/components/inventory/ai-insights-modals.tsx](apps/web/src/components/inventory/ai-insights-modals.tsx) (`ProductSalesDetailModal`, `TopPartnersDetailModal`, `TopRegionsDetailModal`, `ActiveReportingPartnersModal`) yang menyajikan visualisasi **Grafik 3D Pie Chart (`ThreeDPieChart`)** interaktif dan tabel data mendalam. Dokumentasi arsitektur dan prompt instruksi dicatat di [docs/PROMPT_AI_INSIGHTS_4_GRID.md](docs/PROMPT_AI_INSIGHTS_4_GRID.md).
- **Mitra navbar border**: Strengthened the floating navigation outline using translucent `ink-700` border and ring tokens so its capsule remains visible on light backgrounds.
- **Agregasi per Mitra & Modal Detail pada Risiko Stok Cabang AI Insights**: Mengubah tampilan tabel "Risiko stok cabang" di tab AI Insights ([apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx)) dari yang sebelumnya me-loop baris berulang per produk (sehingga mitra yang sama muncul berkali-kali) menjadi **1 baris ringkas per mitra cabang**. Menambahkan komponen modal baru `PartnerDeficitModal` ([apps/web/src/components/inventory/partner-deficit-modal.tsx](apps/web/src/components/inventory/partner-deficit-modal.tsx)) yang terbuka saat baris mitra diklik, menampilkan rincian seluruh produk bermasalah/kategori berisiko, sisa stok, cakupan hari, akar masalah, serta rekomendasi tindakan solusi AI khusus untuk cabang tersebut.
- **Admin AI Insights layout refactor**: Reordered operational metrics, attention table, regional donut, product share, and partner performance; compacted filters, grouped missing locations into a banner, and kept deficit, factory, weekly facts, and AI API flows intact.
- **Perbaikan Input Counter Stok (Eliminasi Leading Zero '010')**: Mengganti input native `type="number"` dengan komponen terkontrol `NumericStockInput` pada Laporan Harian dan Form Restock Mitra ([apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx)). Mengatasi bug browser saat nilai awal `0` diubah menjadi angka lain (seperti `10`) yang sebelumnya memunculkan `010` karena browser tidak memperbarui string teks input jika nilai numeriknya dianggap sama. Kini saat input berfokus pada angka `0`, teks otomatis dikosongkan/diseleksi, input memvalidasi dan memangkas leading zero via regex (`/^0+(?=\d)/`), serta menghilangkan tombol panah stepper bawaan browser yang bertumpuk dengan tombol counter minus/plus.
- **Grid Layout Laporan Harian Stok Mitra**: Mengubah tampilan daftar "Stok Saya" pada Laporan Harian di portal Mitra ([apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx)) dari format baris vertikal (*vertical list divide-y*) menjadi **Grid Card Layout responsif** (`grid-cols-1 sm:grid-cols-2`). Setiap produk kini tampil dalam kartu mandiri berbingkai dengan header status, display sisa stok numerik besar, highlight visual dinamis saat kuantitas diubah, dan tombol counter sentuh (`min-h-11`) yang ringkas dan efisien tanpa memakan ruang vertikal berlebih.
- **Perbaikan Animasi & Clipping Apple Liquid Glass**: Memperbaiki bug animasi tab yang membeku di index awal dan clipping border navbar pada Admin dan Mitra ([apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx), [apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx), [apps/web/src/styles.css](apps/web/src/styles.css)). Memindahkan transform kalkulasi animasi dari inline string Tailwind yang rapuh ke utilitas CSS terkompilasi (`.liquid-pill-active-x`, `.liquid-pill-hover-x`, `.liquid-pill-active-y-48`, `.liquid-pill-hover-y-48`, `.liquid-pill-active-mitra`), menambahkan `overflow-hidden` pada container `nav` agar kapsul aktif melengkung sempurna mengikuti kurva kaca tanpa keluar dari border luar navbar, serta memastikan tab yang aktif (seperti "Mitra") selalu terlapisi kapsul gelap kontras di posisi yang presisi.

### 2026-11-07
- **Apple Liquid Glass Navigation (Mitra & Admin)**: Menerapkan estetika navigasi Apple iOS / iPhone *Liquid Glass* ke portal Mitra dan dashboard Admin ([apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx), [apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx), [apps/web/src/styles.css](apps/web/src/styles.css)). Memperbaiki bug delay/lag saat kursor bergerak atau berpindah antar menu dengan mengisolasi komponen `AdminFloatingNavbar` ke sub-komponen mandiri (sebelumnya state hover berada di root `AdminDashboard` sehingga me-re-render seluruh 3.600 baris dashboard pada setiap gerakan mouse), mengganti kurva overshoot memantul dengan kurva *Apple fluid deceleration* yang mulus (`duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]`), akselerasi perangkat keras GPU (`transform-gpu will-change-transform`), menyelaraskan transisi warna teks (`transition-colors duration-200`), serta penyesuaian token gradient `--color-ink-950` agar warna tab aktif tidak memudar/transparan di sisi kanan.
- **Button Keluar Hover Styling**: Memperbarui efek hover pada tombol "Keluar" di dashboard Admin (header & sidebar) serta portal Mitra (header & tab profil) menggunakan `hover:bg-crit-bg` dan `hover:text-crit-fg` serta penanda `focus-visible:outline-crit` agar transisi interaktif terlihat jelas dan konsisten dengan token tema bahaya/logout ([apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx), [apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx)).
- **Admin Order Rejection**: Menghapus form ganda (*double form*) saat admin menolak pesanan restock di modal persetujuan. Form penolakan kini terisolasi, dilengkapi template alasan cepat, counter karakter, dan tombol aksi terintegrasi ([apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx)).
- **Cetak Surat Jalan & Resi Pengiriman**: Memperbaiki modal cetak resi logistik agar mendukung format resmi **Surat Jalan A4** (lengkap dengan kop resmi, tanda tangan 3 pihak, rincian barang, dan verifikasi QR/Barcode) serta opsi struk thermal 80 mm via isolasi iframe print engine ([apps/web/src/components/inventory/delivery-receipt-modal.tsx](apps/web/src/components/inventory/delivery-receipt-modal.tsx)).
- **Perencanaan Optimasi SSE & Cache**: Membuat rencana teknis [planing.md](planing.md) untuk meniadakan polling berulang dan menerapkan event-driven query cache dengan TanStack Query dan Server-Sent Events (SSE).
- **Protokol Log Perubahan**: Menerapkan aturan wajib baca dan pencatatan log harian otomatis pada [CLAUDE.md](CLAUDE.md) dan [AGENTS.md](AGENTS.md).
