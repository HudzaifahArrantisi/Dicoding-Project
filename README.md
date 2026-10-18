# 🍱 Daisuki B2B Inventory & Order Management System

Sistem manajemen inventaris dan pemesanan B2B multi-cabang (Mitra & Admin Daisuki) berbasis monorepo modern menggunakan **TanStack Start**, **ElysiaJS**, dan **Supabase**.

---

## 📌 Daftar Isi

1. [Arsitektur & Tech Stack](#-arsitektur--tech-stack)
2. [Struktur Direktori](#-struktur-direktori)
3. [Prasyarat Sistem (Prerequisites)](#-prasyarat-sistem-prerequisites)
4. [Panduan Setup Langkah Demi Langkah](#-panduan-setup-langkah-demi-langkah)
   - [Langkah 1: Clone Repository](#1-clone-repository)
   - [Langkah 2: Install Dependensi Monorepo](#2-install-dependensi-monorepo)
   - [Langkah 3: Konfigurasi Environment Variables](#3-konfigurasi-environment-variables)
   - [Langkah 4: Setup Database Supabase](#4-setup-database-supabase)
   - [Langkah 5: Jalankan Server Development](#5-jalankan-server-development)
5. [Daftar Perintah (NPM/Bun Scripts)](#-daftar-perintah-scripts)
6. [Alur & Aturan Kolaborasi Tim](#-alur--aturan-kolaborasi-tim)
7. [Troubleshooting & FAQ](#-troubleshooting--faq)
8. [Dokumentasi Lanjutan](#-dokumentasi-lanjutan)

---

## 🏗 Arsitektur & Tech Stack

Proyek ini dibangun menggunakan arsitektur **Monorepo (Bun Workspaces)** dengan pembagian tanggung jawab sebagai berikut:

| Lapisan | Teknologi | Port | Deskripsi |
|---|---|---|---|
| **Web (Frontend)** | [TanStack Start](https://tanstack.com/start), React 19, Tailwind CSS v4, TanStack Query/Form/Table | `3000` | UI Dashboard Admin & Portal Mitra |
| **API (Backend)** | [ElysiaJS](https://elysiajs.com/), Bun, Drizzle ORM, Jose (JWT) | `3001` | Business logic, auth guard, validasi transaksi, cron reminder |
| **Database & Auth** | [Supabase](https://supabase.com/) (PostgreSQL, Auth, Realtime) | Cloud | Penyimpanan data, RLS (Row Level Security), JWT auth provider |
| **Shared Package** | TypeScript Workspace Package (`@daisuki/shared`) | - | Definisi tipe enum status stok, order, dan utilitas bersama |

> **Prinsip Arsitektur:**  
> Frontend **tidak melakukan penulisan langsung** ke tabel database Supabase. Semua mutasi (stok, pesanan, approval) wajib melalui **API Elysia** agar aturan validasi bisnis terpusat. Frontend membaca event realtime secara aman melalui Supabase Realtime dengan proteksi RLS.

---

## 📁 Struktur Direktori

```text
daisuki-inventory/
├── apps/
│   ├── web/                    # Frontend TanStack Start (Port 3000)
│   │   ├── .env.example
│   │   ├── src/
│   │   │   ├── components/     # UI Shadcn & komponen reusable
│   │   │   ├── routes/         # Routing TanStack Router berbasis file
│   │   │   └── styles.css      # Desain sistem & Tailwind CSS v4
│   │   └── package.json
│   └── api/                    # Backend API ElysiaJS (Port 3001)
│       ├── .env.example
│       ├── src/
│       │   ├── db/             # Koneksi database Drizzle/Postgres
│       │   ├── plugins/        # Guard JWT, auth middleware
│       │   └── index.ts        # Entrypoint server & routes
│       └── package.json
├── packages/
│   └── shared/                 # Kode/tipe yang dipakai bersama web & api
│       ├── src/index.ts
│       └── package.json
├── supabase/
│   ├── migrations/             # Skrip SQL skema tabel, fungsi, RLS
│   │   └── 0001_init.sql
│   └── seed.sql                # Data awal untuk testing/development
├── docs/                       # Dokumen spesifikasi teknis proyek
│   ├── alursistem.md           # Flow bisnis, state machine stok & order
│   └── design_system.md        # Aturan warna, tipografi, & komponen UI
├── SETUP.md                    # Catatan teknis setup awal
├── package.json                # Root package.json (Bun workspaces)
└── README.md                   # Panduan kolaborator (file ini)
```

---

## 💻 Prasyarat Sistem (Prerequisites)

Sebelum memulai, pastikan perangkat Anda telah terpasang:

1. **[Bun](https://bun.sh/)** (v1.1 atau terbaru)  
   > ⚠️ **PENTING:** Proyek ini menggunakan **Bun** sebagai runtime dan package manager. **DILARANG** menggunakan `npm`, `yarn`, atau `pnpm` karena dapat merusak file `bun.lock` dan resolusi workspace symlink.
   - Cek instalasi: `bun --version`
2. **[Git](https://git-scm.com/)**
3. **Akun & Project Supabase**:
   - Buat project baru di [supabase.com](https://supabase.com).
   - Siapkan kredensial project (Database Connection String, URL, Anon Key, Service Role Key, JWT Secret).

---

## 🚀 Panduan Setup Langkah Demi Langkah

### 1. Clone Repository

Buka terminal (PowerShell / Command Prompt / Terminal) dan clone repositori ini:

```bash
git clone https://github.com/HudzaifahArrantisi/Dicoding-Project.git daisuki-inventory
cd daisuki-inventory
```

---

### 2. Install Dependensi Monorepo

Jalankan perintah instalasi dari **root direktori**:

```bash
bun install
```

Perintah ini akan secara otomatis menginstall seluruh dependensi untuk `apps/web`, `apps/api`, dan menghubungkan `packages/shared`.

---

### 3. Konfigurasi Environment Variables

Terdapat dua file `.env` yang wajib disiapkan: satu untuk Backend (`apps/api`) dan satu untuk Frontend (`apps/web`).

#### A. Backend API (`apps/api/.env`)
Salin file template `.env.example` ke `.env`:

```bash
# Windows PowerShell
copy apps/api/.env.example apps/api/.env

# Linux / macOS / Git Bash
cp apps/api/.env.example apps/api/.env
```

Buka `apps/api/.env` dan sesuaikan dengan data Supabase Anda:

```env
PORT=3001
# Ambil dari Supabase Dashboard -> Project Settings -> Database -> Connection string (URI mode Transaction / Session pooler port 6543)
DATABASE_URL=postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:6543/postgres

# Ambil dari Project Settings -> API
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh... (Service Role Key / Secret)
SUPABASE_JWT_SECRET=your-jwt-secret (Project Settings -> API -> JWT Secret)

# Origin frontend yang diizinkan untuk CORS
WEB_ORIGIN=http://localhost:3000

# Opsional: Jika ingin menguji fitur kirim email alert
RESEND_API_KEY=
```

#### B. Frontend Web (`apps/web/.env`)
Salin file template `.env.example` ke `.env`:

```bash
# Windows PowerShell
copy apps/web/.env.example apps/web/.env

# Linux / macOS / Git Bash
cp apps/web/.env.example apps/web/.env
```

Buka `apps/web/.env` dan lengkapi:

```env
# Ambil dari Supabase Dashboard -> Project Settings -> API
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh... (Anon / Public Key)

# URL API lokal
VITE_API_URL=http://localhost:3001
```

---

### 4. Setup Database Supabase

1. Masuk ke dashboard project Anda di [supabase.com](https://supabase.com).
2. Buka menu **SQL Editor**.
3. Jalankan migrasi skema tabel:
   - Buka file [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql).
   - Salin seluruh isinya dan jalankan (Run) di SQL Editor.
4. (Opsional tapi disarankan) Jalankan data awal / dummy seeder:
   - Buka file [`supabase/seed.sql`](./supabase/seed.sql).
   - Salin isinya dan jalankan di SQL Editor untuk mengisi produk awal dan role pengguna.
5. Konfigurasi **Supabase Auth**:
   - Di menu **Authentication** -> **URL Configuration**, pastikan **Site URL** diset ke `http://localhost:3000`.

---

### 5. Jalankan Server Development

Cukup jalankan satu perintah dari **root direktori**:

```bash
bun run dev
```

> Skrip ini menggunakan `concurrently` untuk menyalakan frontend dan backend sekaligus:
> - 🌐 **Web App:** [http://localhost:3000](http://localhost:3000)
> - ⚙️ **API Server:** [http://localhost:3001](http://localhost:3001) (Cek health endpoint di `http://localhost:3001/health`)

Jika Anda ingin menjalankan layanan secara terpisah:
- Hanya Web: `bun run dev:web`
- Hanya API: `bun run dev:api`

---

## 📜 Daftar Perintah (Scripts)

| Perintah | Lokasi | Keterangan |
|---|---|---|
| `bun install` | Root | Menginstall semua dependensi workspace |
| `bun run dev` | Root | Menjalankan Frontend (:3000) dan API (:3001) secara bersamaan |
| `bun run dev:web` | Root | Menjalankan server frontend saja |
| `bun run dev:api` | Root | Menjalankan server backend API saja |
| `bun run typecheck` | Root | Memeriksa validasi tipe TypeScript di seluruh proyek |
| `bun run lint` | `apps/web` | Menjalankan ESLint pada frontend |
| `bun run build` | `apps/web` | Membangun bundle produksi frontend |

---

## 🤝 Alur & Aturan Kolaborasi Tim

Demi menjaga kualitas kode dan kerapian repositori bersama, seluruh kolaborator diharapkan mengikuti ketentuan berikut:

### 1. Manajemen Branch
- Jangan push langsung ke branch `main`.
- Buat branch baru dari `main` dengan format penamaan:
  - `feat/nama-fitur` (contoh: `feat/partner-stock-input`)
  - `fix/nama-bug` (contoh: `fix/order-status-update`)
  - `chore/nama-tugas` (contoh: `chore/update-dependencies`)

### 2. Standar Commit Message
Gunakan konvensi [Conventional Commits](https://www.conventionalcommits.org/):
- `feat: tambah halaman input stok mitra`
- `fix: perbaiki validasi token jwt pada middleware`
- `style: perbarui styling kartu statistik dashboard`
- `docs: update panduan setup readme`

### 3. Validasi Sebelum Push / Buat Pull Request
Sebelum melakukan commit dan membuka Pull Request, jalankan perintah ini di root:

```bash
bun run typecheck
```

Pastikan tidak ada error TypeScript. Jika mengerjakan frontend, pastikan juga linting lulus:

```bash
bun --cwd apps/web run lint
```

### 4. Code Review & Merge
- Buka Pull Request (PR) ke branch `main`.
- Jelaskan perubahan yang dilakukan dan sertakan screenshot jika terdapat perubahan UI.
- Minta review dari rekan tim sebelum branch di-merge.

---

## ❓ Troubleshooting & FAQ

#### Q: Mengapa muncul error `Cannot find module '@daisuki/shared'`?
**A:** Pastikan Anda menjalankan `bun install` dari **root folder**, bukan di dalam `apps/web` atau `apps/api`. Bun Workspaces membutuhkan instalasi root untuk melakukan symlink antar paket.

#### Q: API tidak bisa terkoneksi ke Supabase Database (`connection timeout` / `ECONNREFUSED`)?
**A:** Jika menggunakan koneksi pooler Supabase (AWS / IPv4), pastikan menggunakan port `6543` pada connection string `DATABASE_URL` (bukan port default `5432` jika network lokal Anda belum mendukung IPv6 langsung).

#### Q: Muncul peringatan PostCSS `@import`?
**A:** Aturan CSS Tailwind v4 mengharuskan `@import` internal dan stylesheet lokal dikelompokkan sebelum aturan style lainnya. Font Google eksternal dikonfigurasi melalui tag `<link>` pada [`apps/web/src/routes/__root.tsx`](./apps/web/src/routes/__root.tsx).

---

## 📚 Dokumentasi Lanjutan

Untuk memahami logika bisnis dan desain antarmuka secara mendalam, silakan baca dokumentasi di folder `docs/`:

- 📖 [**Alur Sistem & Aturan Bisnis**](./docs/alursistem.md): Berisi diagram state order, status stok aman/kritis, jadwal cron reminder, dan hak akses user.
- 🎨 [**Desain Sistem UI**](./docs/design_system.md): Panduan warna token Tailwind, hierarki font, dan panduan komponen UI.

---

Selamat berkolaborasi! Jika mengalami kendala saat setup, diskusikan melalui GitHub Issues atau grup komunikasi tim. 🚀
