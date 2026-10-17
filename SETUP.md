# SETUP.md — Setup Awal Proyek Daisuki Inventory

> **Untuk AI agent:** kerjakan semua tahap di bawah secara berurutan. Ini hanya **setup fondasi** (env, config, struktur, dependensi, file dasar), **bukan implementasi fitur**. Fitur dikerjakan setelah setup selesai, mengikuti `docs/alursistem.md`.

## Aturan kerja

1. OS: **Windows, PowerShell**. Jangan pakai sintaks bash (`mkdir -p`, `cp`, `rm -rf`, `export`).
2. Package manager: **bun**. Jangan pakai npm, yarn, atau pnpm.
3. Path root proyek: `C:\laragon\www\daisuki-inventory`
4. **Jangan mengarang nilai rahasia.** File `.env` dibuat dari `.env.example` dengan nilai placeholder, lalu daftar yang harus diisi manual ditampilkan di akhir.
5. Jangan menghapus file hasil scaffolding TanStack/Elysia kecuali disebut eksplisit.
6. Sebelum mengubah file yang sudah ada, baca dulu isinya. Tambahkan, jangan menimpa konfigurasi bawaan.
7. Setelah setiap tahap, jalankan verifikasi tahap itu. Kalau gagal, perbaiki sebelum lanjut.
8. Dokumen acuan: `docs/design_system.md` dan `docs/alursistem.md`.

## Kondisi saat ini (sudah selesai)

- Monorepo Bun: `apps/web` (TanStack Start, React, Vite, adapter Cloudflare, add-on Query, Shadcn, Form, Table, T3Env) dan `apps/api` (ElysiaJS).
- `apps/api` sudah terpasang: `@elysiajs/cors`, `@elysiajs/cron`, `jose`, `drizzle-orm`, `postgres`, `drizzle-kit`.
- `apps/web` sudah terpasang `concurrently`; `bun run dev` di `apps/web` menjalankan web (:3000) dan API (:3001).
- Project Supabase sudah dibuat dan skema SQL sudah dijalankan (lihat Tahap 8).

## Ringkasan port dan struktur

| Layanan | Port | Folder |
|---|---|---|
| Web (TanStack Start) | 3000 | `apps/web` |
| API (Elysia) | 3001 | `apps/api` |

Struktur target:

```
daisuki-inventory/
├─ .gitignore
├─ package.json
├─ SETUP.md
├─ docs/
│  ├─ design_system.md
│  └─ alursistem.md
├─ supabase/
│  ├─ migrations/0001_init.sql
│  └─ seed.sql
├─ packages/shared/
│  ├─ package.json
│  ├─ tsconfig.json
│  └─ src/index.ts
└─ apps/
   ├─ web/  (.env.example, src/env.ts, src/lib/*, src/styles/app.css)
   └─ api/  (.env.example, src/env.ts, src/index.ts, src/db/client.ts, src/plugins/)
```

---

## Tahap 1 — Root: git, gitignore, workspace

1. Jalankan `git init` di root kalau belum ada folder `.git`.
2. Buat `.gitignore` di root:

```
node_modules
.env
.env.*
!.env.example
dist
.output
.vinxi
.tanstack
.wrangler
*.log
.DS_Store
```

3. Pastikan `package.json` di root berisi (gabungkan, jangan menimpa field lain):

```json
{
  "name": "daisuki-inventory",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "bun run --cwd apps/web dev",
    "dev:web": "bun run --cwd apps/web dev:web",
    "dev:api": "bun run --cwd apps/api dev"
  }
}
```

4. Buat folder yang belum ada: `docs`, `supabase\migrations`, `packages\shared\src`. Pindahkan `design_system.md` dan `alursistem.md` ke `docs\` kalau masih di tempat lain.

**Verifikasi:** `bun install` dari root tidak error.

---

## Tahap 2 — Package shared (`packages/shared`)

Tujuan: aturan status stok dan status order dipakai bersama oleh web dan API.

`packages/shared/package.json`:

```json
{
  "name": "@daisuki/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts"
}
```

`packages/shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

`packages/shared/src/index.ts`:

```ts
// ===== Status stok =====
export type StockStatus = "aman" | "waspada" | "kritis";

export const STOCK_THRESHOLDS = { aman: 50, kritis: 20 } as const; // dalam persen

export function stockPercent(qty: number, parLevel: number): number {
  return parLevel > 0 ? (qty / parLevel) * 100 : 0;
}

export function getStockStatus(qty: number, parLevel: number): StockStatus {
  const pct = stockPercent(qty, parLevel);
  if (pct > STOCK_THRESHOLDS.aman) return "aman";
  if (pct >= STOCK_THRESHOLDS.kritis) return "waspada";
  return "kritis";
}

export const STALE_AFTER_HOURS = 24;

export function isStale(updatedAt: Date | string, now = new Date()): boolean {
  const t = typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt;
  return now.getTime() - t.getTime() > STALE_AFTER_HOURS * 60 * 60 * 1000;
}

// ===== Status order =====
export const ORDER_STATUSES = [
  "diproses",
  "disetujui",
  "dalam_pengiriman",
  "selesai",
  "ditolak",
  "dibatalkan",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  diproses: "Menunggu persetujuan",
  disetujui: "Disetujui",
  dalam_pengiriman: "Dalam pengiriman",
  selesai: "Selesai",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
};

// Transisi yang diizinkan: dari -> ke[]
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  diproses: ["disetujui", "ditolak", "dibatalkan"],
  disetujui: ["dalam_pengiriman"],
  dalam_pengiriman: ["selesai"],
  selesai: [],
  ditolak: [],
  dibatalkan: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

// ===== Peran =====
export type UserRole = "admin" | "mitra";
export type PartnerType = "hotel" | "restoran" | "kafe" | "minimarket";
```

Daftarkan sebagai dependensi di kedua app. Tambahkan `"@daisuki/shared": "workspace:*"` ke `dependencies` di `apps/web/package.json` dan `apps/api/package.json`, lalu jalankan `bun install` dari root.

**Verifikasi:** `import { getStockStatus } from "@daisuki/shared"` bisa dipakai di `apps/api` (cek dengan file sementara, lalu hapus).

---

## Tahap 3 — Environment variables

### 3.1 `apps/api/.env.example`

```
PORT=3001
DATABASE_URL=postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
WEB_ORIGIN=http://localhost:3000
RESEND_API_KEY=
```

### 3.2 `apps/web/.env.example`

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=http://localhost:3001
```

### 3.3 Buat file `.env` dari example

```powershell
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.example apps\web\.env
```

Jangan isi nilai rahasia sendiri. Daftar yang harus diisi user ada di bagian **Checklist manual** di akhir dokumen.

### 3.4 Validasi env di web (T3Env)

Cari file env bawaan add-on T3Env (biasanya `apps/web/src/env.ts`). Baca dulu, lalu tambahkan variabel `VITE_*` ke bagian `client` dan `runtimeEnv`:

```ts
// di bagian client (zod):
VITE_SUPABASE_URL: z.string().url(),
VITE_SUPABASE_ANON_KEY: z.string().min(1),
VITE_API_URL: z.string().url(),
```

Hapus variabel contoh bawaan (`VITE_APP_TITLE` dan sejenisnya) hanya jika tidak dipakai di tempat lain (cek dengan pencarian).

### 3.5 Validasi env di API

`apps/api/src/env.ts`:

```ts
const required = ["DATABASE_URL", "SUPABASE_URL", "WEB_ORIGIN"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Env ${key} belum diisi di apps/api/.env`);
  }
}

export const env = {
  PORT: Number(process.env.PORT ?? 3001),
  DATABASE_URL: process.env.DATABASE_URL!,
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET ?? "",
  WEB_ORIGIN: process.env.WEB_ORIGIN!,
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
};
```

**Verifikasi:** `.env` tidak ter-track git (`git status` tidak menampilkan `.env`, tapi menampilkan `.env.example`).

---

## Tahap 4 — Setup API (`apps/api`)

1. Pastikan `apps/api/package.json` punya:

```json
"scripts": {
  "dev": "bun run --watch src/index.ts",
  "start": "bun run src/index.ts"
}
```

2. Buat `apps/api/src/db/client.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";

// Supabase pooler (transaction mode) tidak mendukung prepared statements
export const sql = postgres(env.DATABASE_URL, { prepare: false, max: 10 });
export const db = drizzle(sql);
```

3. Buat `apps/api/src/db/schema.ts`: definisi Drizzle (`pgTable`, `pgEnum`) yang **mencerminkan persis** skema di `supabase/migrations/0001_init.sql` (tabel `partners`, `profiles`, `products`, `partner_stocks`, `stock_logs`, `orders`, `order_items`, `notifications` beserta enum-nya). SQL migration adalah sumber kebenaran. **Jangan menjalankan `drizzle-kit push` atau `generate`.**

4. Ganti `apps/api/src/index.ts`:

```ts
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { env } from "./env";
import { sql } from "./db/client";

const app = new Elysia()
  .use(cors({ origin: env.WEB_ORIGIN, credentials: true }))
  .get("/health", () => ({ ok: true }))
  .get("/health/db", async () => {
    const [row] = await sql`select now() as now`;
    return { ok: true, now: row.now };
  })
  .listen(env.PORT);

console.log(`API jalan di http://localhost:${app.server?.port}`);

export type App = typeof app;
```

5. Buat folder kosong (dengan file `.gitkeep`) untuk kerangka modul: `src/plugins`, `src/modules/stocks`, `src/modules/orders`, `src/modules/notifications`, `src/modules/admin`, `src/modules/reports`, `src/jobs`.

**Verifikasi:**
- `http://localhost:3001/health` → `{"ok":true}`
- `http://localhost:3001/health/db` → `{"ok":true,"now":"..."}` (butuh `DATABASE_URL` sudah diisi user)

---

## Tahap 5 — Setup Web (`apps/web`)

1. Pasang dependensi kalau belum ada:

```powershell
cd apps\web
bun add @supabase/supabase-js @elysiajs/eden
bun add @fontsource-variable/bricolage-grotesque @fontsource-variable/figtree
```

2. Cek alias import di `apps/web/tsconfig.json` (`paths`). Template TanStack bisa memakai `@/*` atau `#/*`. **Pakai alias yang sudah ada** pada semua file di bawah.

3. `apps/web/src/lib/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
```

4. `apps/web/src/lib/api.ts` (client API type-safe lewat Eden Treaty, token Supabase dikirim otomatis):

```ts
import { treaty } from "@elysiajs/eden";
import type { App } from "../../../api/src/index";
import { env } from "@/env";
import { supabase } from "./supabase";

export const api = treaty<App>(env.VITE_API_URL, {
  async onRequest() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
  },
});
```

> Import `type` lintas package ini hanya mengambil tipe, tidak memasukkan kode API ke bundle web. Kalau TypeScript mengeluh soal path, tambahkan `"../api/src"` ke `include` di `tsconfig.json` web.

5. Design tokens. Buka file CSS global bawaan (biasanya `src/styles.css` atau `src/styles/app.css`). Tambahkan import font dan blok `@theme` dari `docs/design_system.md` **bagian 10** (warna, font, radius, shadow, aturan `.num`, fokus, dan `prefers-reduced-motion`). **Gabungkan** dengan variabel tema shadcn yang sudah ada, jangan menghapusnya.

6. Komponen shadcn. Cek `apps/web/components.json`. Kalau belum ada, jalankan `bunx --bun shadcn@latest init`. Lalu tambah komponen dasar:

```powershell
bunx --bun shadcn@latest add button input label card badge table sheet sonner skeleton tabs
```

7. Pastikan `QueryClientProvider` dari add-on Query sudah membungkus app (biasanya di `src/routes/__root.tsx` atau file integrasi). Kalau belum, tambahkan.

8. Ganti halaman `src/routes/index.tsx` menjadi halaman sementara untuk uji koneksi:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async () => (await api.health.get()).data,
  });

  return (
    <main className="p-6">
      <h1 className="font-display text-2xl font-semibold">Daisuki Inventory</h1>
      <p className="text-muted-foreground">
        API: {health.isLoading ? "memeriksa…" : health.data?.ok ? "terhubung" : "tidak terhubung"}
      </p>
    </main>
  );
}
```

**Verifikasi:** `http://localhost:3000` menampilkan "API: terhubung". Heading memakai font Bricolage Grotesque.

---

## Tahap 6 — Dev script

Pastikan `apps/web/package.json` berisi (script lain jangan diubah):

```json
"dev": "concurrently -n web,api -c cyan,green \"vite dev --port 3000\" \"bun --cwd ../api run dev\"",
"dev:web": "vite dev --port 3000"
```

**Verifikasi:** `bun run dev` dari `apps/web` maupun dari root menjalankan keduanya dengan label `[web]` dan `[api]`.

---

## Tahap 7 — Kualitas kode dasar

1. Pastikan ada skrip `typecheck` di web dan API: `"typecheck": "tsc --noEmit"`. Perbaiki error tipe yang muncul dari file yang dibuat di tahap ini.
2. Tambahkan skrip di root: `"typecheck": "bun run --cwd apps/web typecheck && bun run --cwd apps/api typecheck"`.
3. Pastikan ESLint di web jalan (`bun run lint` kalau ada skripnya) tanpa error baru.

---

## Tahap 8 — File SQL di repo

1. Buat `supabase/migrations/0001_init.sql`: salin **seluruh blok SQL** dari `docs/alursistem.md` **bagian 4.1 (skema)** dan **4.2 (RLS + Realtime)**.
2. Buat `supabase/seed.sql`:

```sql
-- Jalankan manual di Supabase SQL Editor SETELAH 0001_init.sql
-- dan SETELAH 3 user dibuat di Authentication > Users.
-- Ganti UUID_ADMIN, UUID_MITRA1, UUID_MITRA2 dengan UUID user asli.

insert into partners (id, name, type, address, pic_name, pic_phone) values
  ('11111111-1111-1111-1111-111111111111', 'Kafe Sejuk BSD', 'kafe', 'BSD, Tangerang Selatan', 'Rina', '081200000001'),
  ('22222222-2222-2222-2222-222222222222', 'Hotel Aruna', 'hotel', 'Jakarta Selatan', 'Budi', '081200000002');

insert into products (sku, name, unit, b2b_price) values
  ('DSK-KS-001', 'Keripik Singkong Original', 'pcs', 8000),
  ('DSK-BR-002', 'Basreng Pedas', 'pcs', 9500),
  ('DSK-KP-003', 'Keripik Pisang Coklat', 'pcs', 8500),
  ('DSK-MK-004', 'Makaroni Bantet', 'pcs', 7500),
  ('DSK-SB-005', 'Seblak Kering', 'pcs', 9000);

insert into profiles (id, role, partner_id, full_name) values
  ('UUID_ADMIN',  'admin', null, 'Admin Daisuki'),
  ('UUID_MITRA1', 'mitra', '11111111-1111-1111-1111-111111111111', 'Rina'),
  ('UUID_MITRA2', 'mitra', '22222222-2222-2222-2222-222222222222', 'Budi');

-- par level 40 hanyalah angka contoh; nilai asli harus dikonfirmasi ke klien
insert into partner_stocks (partner_id, product_id, current_qty, par_level)
select p.id, pr.id, 30, 40 from partners p cross join products pr;
```

Agent **tidak** menjalankan SQL ini ke database. Itu dilakukan user manual (lihat checklist).

---

## Tahap 9 — Commit pertama

```powershell
git add .
git status
```

Pastikan **tidak ada** `.env` di daftar. Lalu:

```powershell
git commit -m "chore: setup awal monorepo web, api, shared, dan sql"
```

---

## Checklist manual (dikerjakan user, bukan agent)

- [ ] Isi `apps/api/.env`: `DATABASE_URL` (Supabase → Connect → pooler, port 6543), `SUPABASE_URL`. `SUPABASE_JWT_SECRET` hanya jika project masih memakai secret HS256. `SUPABASE_SERVICE_ROLE_KEY` untuk fitur buat akun mitra nanti.
- [ ] Isi `apps/web/.env`: `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
- [ ] Jalankan `0001_init.sql` di Supabase SQL Editor (skema dulu, lalu RLS).
- [ ] Buat 3 user di Authentication → Users (centang Auto Confirm User): `admin@daisuki.test`, `mitra1@daisuki.test`, `mitra2@daisuki.test`.
- [ ] Ganti 3 UUID di `supabase/seed.sql`, lalu jalankan di SQL Editor.
- [ ] Konfirmasi ke klien: nilai **par level** per mitra per produk.

## Definisi selesai setup

- [ ] `bun install` dari root bersih, `bun run typecheck` lulus.
- [ ] `bun run dev` menjalankan web (:3000) dan API (:3001) sekaligus.
- [ ] `localhost:3001/health` → `{"ok":true}` dan `localhost:3001/health/db` mengembalikan waktu dari Postgres.
- [ ] `localhost:3000` menampilkan "API: terhubung".
- [ ] Token desain (warna, font) aktif, komponen shadcn dasar terpasang.
- [ ] `.env` tidak masuk git, `.env.example` masuk git.
- [ ] `docs/`, `supabase/`, dan `packages/shared` sesuai struktur target.

## Setelah setup: fitur pertama

Mulai dari Tahap berikut di `docs/alursistem.md` bagian 10 (urutan 2 dan seterusnya): auth guard Elysia (verifikasi JWT Supabase + ambil profil), `GET /me`, `GET /stocks`, `PUT /stocks` dengan log stok dan alert kritis. Jangan mulai sebelum semua centang di "Definisi selesai setup" terpenuhi.
