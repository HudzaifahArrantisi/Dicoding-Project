# Daisuki Inventory

Daisuki Inventory adalah aplikasi B2B untuk mengelola stok dan pesanan dari banyak cabang mitra, seperti hotel, restoran, kafe, dan minimarket. Mitra dapat melaporkan stok dan mengajukan restock. Admin dapat memantau kondisi stok, memproses pesanan, dan melihat informasi dari seluruh cabang.

## Gambaran Singkat

Alur utama aplikasi:

1. Mitra memperbarui stok fisik.
2. Mitra mengajukan pesanan restock.
3. Admin memeriksa dan menyetujui pesanan.
4. Sistem menyimpan perubahan stok dan status pesanan.
5. Data dapat dianalisis oleh tim Data Science dan AI untuk membuat rekomendasi restock.

Frontend tidak menulis langsung ke database. Semua perubahan data harus melalui API agar validasi, hak akses, dan transaksi tetap aman.

## Peran Pengguna dan Tim

| Peran | Tanggung jawab |
|---|---|
| Admin | Memantau stok cabang, memproses pesanan, dan mengelola data operasional. |
| Mitra | Memperbarui stok, membuat pesanan restock, dan mengonfirmasi penerimaan. |
| Fullstack Developer | Membangun frontend, API, autentikasi, database, dan integrasi realtime. |
| Data Scientist | Menganalisis pola pemakaian stok, menyiapkan data, dan membuat metrik inventaris. |
| AI Engineer | Membuat prediksi kebutuhan, rekomendasi restock, dan asisten berbasis AI. |

## Teknologi dan Struktur Folder

- `apps/web/`: frontend TanStack Start, React, Tailwind, dan Vite. Berjalan di port `3000`.
- `apps/api/`: backend ElysiaJS, Bun, Drizzle ORM, dan autentikasi JWT. Berjalan di port `3001`.
- `packages/shared/`: tipe dan aturan bisnis yang dipakai web dan API.
- `supabase/`: skrip migration SQL skema database dan data awal (dijalankan di Neon SQL Editor).
- `data-science/`: notebook, analisis, dan model inventaris berbasis Python.
- `ai/`: job AI, asisten, bot, dan evaluasi model berbasis Python.
- `docs/`: alur bisnis dan aturan desain UI.

## Setup Setelah Clone

### 1. Siapkan kebutuhan

Install [Git](https://git-scm.com/), [Bun](https://bun.sh/), dan siapkan akun/project di [Neon DB](https://neon.tech). Gunakan Bun untuk semua perintah JavaScript dan TypeScript. Jangan gunakan npm, yarn, atau pnpm.

### 2. Clone dan install dependency

```bash
git clone https://github.com/HudzaifahArrantisi/Dicoding-Project.git daisuki-inventory
cd daisuki-inventory
bun install
```

### 3. Buat file environment

PowerShell Windows:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

Linux, macOS, atau Git Bash:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Isi file konfigurasi berikut:

- `apps/api/.env`:
  - `DATABASE_URL`: Connection string dari Neon DB Console (menu **Connect**).
  - `WEB_ORIGIN=http://localhost:3000`
- `apps/web/.env`:
  - `VITE_API_URL=http://localhost:3001`

Jangan commit file `.env` atau credential rahasia ke Git.

### 4. Siapkan database

Di Neon Console, buka menu **SQL Editor**, lalu jalankan file skrip SQL untuk membuat skema tabel:

1. Buat tabel utama dari skrip skema database (`partners`, `users`, `products`, `partner_stocks`, `stock_logs`, `orders`, `order_items`, `notifications`).
2. Jalankan `supabase/migrations/0002_restock_recommendations.sql` untuk tabel rekomendasi restock.
3. Jalankan `supabase/seed.sql` jika membutuhkan data awal untuk development.

### 5. Jalankan aplikasi

```bash
bun run dev
```

Buka `http://localhost:3000` untuk web. API berjalan di `http://localhost:3001`. Jika ingin menjalankan satu layanan saja, gunakan `bun run dev:web` atau `bun run dev:api`.

## Perintah Penting

```bash
bun run typecheck              # Cek tipe TypeScript web dan API
bun --cwd apps/web run lint    # Jalankan ESLint frontend
bun --cwd apps/web run build   # Build frontend
bun --cwd apps/web run check   # Cek format Prettier
```

## Aturan Kontribusi

- Buat branch `feat/nama-fitur`, `fix/nama-bug`, atau `chore/nama-tugas`.
- Gunakan Conventional Commits, misalnya `feat: add stock input`.
- Jangan push langsung ke `main`.
- Jalankan typecheck dan lint sebelum membuat Pull Request.
- Sertakan ringkasan perubahan dan screenshot untuk perubahan UI.
- Perubahan schema atau RLS harus dibuat sebagai migration SQL baru. Jangan gunakan `drizzle-kit push` atau `drizzle-kit generate`.

Dokumentasi teknis tambahan tersedia di [docs/alursistem.md](./docs/alursistem.md), [docs/design_system.md](./docs/design_system.md), [ai/README.md](./ai/README.md), dan [data-science/README.md](./data-science/README.md).
