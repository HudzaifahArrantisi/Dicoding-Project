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

Skema TypeScript di `apps/api/src/db/schema.ts` adalah mirror untuk Drizzle ORM. Mengubah file tersebut tidak langsung mengubah Neon DB. Setiap perubahan database harus mempunyai file SQL bernomor di `supabase/migrations/`.

Untuk database baru, buka **SQL Editor** di Neon Console dan jalankan migration yang diperlukan sesuai urutan nomor. Periksa isi migration sebelum menjalankannya. Migration role seperti `0003_ds_ai_roles.sql` membutuhkan password role yang sudah diganti dari nilai contoh.

Setelah skema tersedia, isi data development dengan seeder:

```bash
bun --cwd apps/api run seed
```

### Membuat dan menjalankan migration Neon

Gunakan alur berikut setiap kali struktur tabel berubah:

1. Ubah mirror Drizzle di `apps/api/src/db/schema.ts`.
2. Buat file SQL dengan nomor berikutnya, misalnya `supabase/migrations/0007_product_description.sql`.
3. Tulis perubahan schema secara eksplisit di file tersebut.

Contoh migration:

```sql
ALTER TABLE products
ADD COLUMN IF NOT EXISTS description TEXT;
```

Jalankan satu file migration dari root repository menggunakan PowerShell:

```powershell
bun --cwd apps/api -e 'import { sql } from "./src/db/client"; const migration = await Bun.file("../../supabase/migrations/0007_product_description.sql").text(); await sql.begin(async (tx) => { await tx.unsafe(migration); }); await sql.end(); console.log("Migrasi berhasil.");'
```

Bun membaca `DATABASE_URL` dari `apps/api/.env`. Perintah tersebut menjalankan migration di dalam transaksi. Jika salah satu pernyataan SQL gagal, transaksi dibatalkan.

Ganti nama file pada perintah sesuai migration yang ingin dijalankan. Jalankan hanya migration baru dan tetap ikuti urutan nomor file.

Verifikasi kolom yang sudah masuk ke Neon:

```powershell
bun --cwd apps/api -e 'import { sql } from "./src/db/client"; const rows = await sql`select column_name, data_type from information_schema.columns where table_name = ${"products"} order by ordinal_position`; console.table(rows); await sql.end();'
```

Setelah migration selesai, periksa TypeScript:

```bash
bun run typecheck
```

Jangan memakai `drizzle-kit push` atau `drizzle-kit generate`. Riwayat SQL di `supabase/migrations/` adalah sumber utama perubahan schema proyek.

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
