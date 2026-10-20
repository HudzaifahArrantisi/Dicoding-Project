# Daisuki Inventory — B2B Inventory & Order Management

Platform manajemen inventaris dan pemesanan restock multi-tenant B2B antara **Admin Daisuki Pusat** dan **Mitra Cabang** (hotel, kafe, restoran, dan minimarket).

---

## ⚡ Panduan Setup Cepat (Mulai dari Nol)

Pastikan sudah menginstal **[Git](https://git-scm.com/)** dan **[Bun](https://bun.sh/)** di komputer Anda.  
*(Wajib menggunakan runtime **Bun**. Jangan gunakan npm, yarn, atau pnpm).*

### 1. Clone Repository & Masuk ke Folder
```bash
git clone https://github.com/HudzaifahArrantisi/Dicoding-Project.git daisuki-inventory
cd daisuki-inventory
```

### 2. Install Dependensi
Jalankan perintah ini di root folder untuk menginstal seluruh dependensi workspace:
```bash
bun install
```

### 3. Konfigurasi File Environment (.env)

Salin template file `.env.example` ke `.env`:

**Windows (PowerShell):**
```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

**Linux / macOS / Git Bash:**
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Buka dan sesuaikan file berikut:
- **`apps/api/.env`**:
  ```env
  PORT=3001
  DATABASE_URL=postgresql://<user>:<password>@<host-neon>/neondb?sslmode=require
  WEB_ORIGIN=http://localhost:3000
  JWT_SECRET=daisuki-super-secret-key-min-32-characters-change-in-production
  ```
  *(Ambil connection string `DATABASE_URL` dari dashboard [Neon DB](https://neon.tech) pada menu **Connect**).*

- **`apps/web/.env`**:
  ```env
  VITE_API_URL=http://localhost:3001
  ```

---

### 4. Setup Database & Data Demo

1. **Buat Tabel Database**:  
   Buka menu **SQL Editor** di console database Anda ([Neon DB](https://neon.tech)), lalu salin dan jalankan seluruh isi file skema database terbaru:  
   👉 **`neon/migrations/0001_init.sql`**

2. **Isi Data Awal (Seeding)**:  
   Setelah tabel berhasil dibuat, isi data awal demo (cabang, 4 produk resmi, dan akun demo) dengan perintah:
   ```bash
   bun --cwd apps/api run seed
   ```

---

### 5. Jalankan Aplikasi

Jalankan frontend web dan backend API sekaligus:
```bash
bun run dev
```

Aplikasi siap diakses di browser:
- **Web Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:3001`
- **Cek Koneksi Database**: `http://localhost:3001/health/db`

---

## 🔑 Akun Login Demo

Setelah proses *seed* selesai, Anda bisa langsung masuk ke sistem menggunakan akun bawaan:

| Peran | Email | Kata Sandi | Akses & Fitur |
|---|---|---|---|
| **Admin Pusat** | `admin@daisuki.test` | `password123` | Monitoring stok cabang, approval restock, alokasi gudang pusat |
| **Mitra 1** | `mitra1@daisuki.test` | `password123` | Portal Cabang Kafe Sejuk (lapor stok harian & pengajuan restock) |
| **Mitra 2** | `mitra2@daisuki.test` | `password123` | Portal Cabang Hotel Aruna |

---

## 🛠️ Perintah Pengembangan Harian

| Perintah | Keterangan |
|---|---|
| `bun run dev` | Menjalankan Web (port 3000) & API (port 3001) secara bersamaan |
| `bun run dev:web` | Menjalankan hanya Frontend web |
| `bun run dev:api` | Menjalankan hanya Backend API |
| `bun run typecheck` | Pemeriksaan tipe TypeScript di seluruh workspace |
| `bun --cwd apps/web run lint` | Menjalankan ESLint pada frontend |
| `bun --cwd apps/web run build` | Build production frontend |
| `bun --cwd apps/api run seed` | Menjalankan ulang pengisian data demo database |

---

## 🐍 Setup Modul Python (Data Science & AI) — *Opsional*

Khusus anggota tim yang mengerjakan modul analisis atau model cerdas di `data-science/` atau `ai/`:

```bash
cd data-science   # atau: cd ai
python -m venv .venv

# Aktivasi virtual environment:
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate

pip install -r requirements.txt
```
