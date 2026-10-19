# 🍱 Panduan Alur Sistem, Pembagian Role, & Master Prompt Implementasi

Dokumen ini berisi:
1. **Alur Sistem Praktis:** Alur kerja harian untuk **Mitra** (HP) dan **Admin** (Desktop).
2. **Pembagian Role yang Jelas:** Tanggung jawab konkret untuk Fullstack, Data Science, dan AI Engineer.
3. **Data Dummy Siap Pakai:** Dataset awal untuk Neon DB.
4. **Master Prompt Implementasi:** Prompt yang siap di-copy untuk menginstruksikan AI Agent mengeksekusi sistem awal (MVP) secara langsung.

---

## 1. 🔄 Alur Sistem Sederhana (Mitra vs Admin)

```mermaid
flowchart TD
  subgraph ALUR MITRA (Akses via HP)
    M1[1. Login Mitra Cabang] --> M2[2. Halaman Stok Cabang]
    M2 --> M3[3. Lapor Stok Fisik Harian<br/>Input sisa barang / barang keluar]
    M3 --> M4{Stok Menipis?}
    M4 -- Ya --> M5[4. Buat Order Restock Barang]
    M4 -- Tidak --> M6[Selesai Laporan]
    M5 --> M7[Menunggu Pengiriman Admin]
    M7 --> M8[5. Konfirmasi Barang Diterima<br/>Stok otomatis bertambah]
  end

  subgraph SISTEM BACKEND (Elysia API & Neon DB)
    API[ElysiaJS API]
    DB[(Neon PostgreSQL)]
    M3 -. Catat Log Stok .-> API
    M5 -. Catat Pesanan .-> API
    M8 -. Update Jumlah Stok .-> API
    API --> DB
  end

  subgraph ALUR ADMIN (Akses via Desktop)
    A1[1. Login Admin Pusat] --> A2[2. Dashboard Monitoring Stok Cabang]
    A2 --> A3[Tabel Warna: Hijau, Kuning, Merah, Abu]
    A3 --> A4{Ada Stok Kritis / Order Masuk?}
    A4 -- Stok Kritis --> A5[Alert Kritis Muncul & Hubungi Mitra]
    A4 -- Order Baru --> A6[3. Buka Menu Approval Order]
    A6 --> A7[Setujui Qty & Tandai Dikirim]
    A7 --> M7
  end
```

### A. Alur Mitra Cabang (Mobile-First):
1. **Login:** Masuk menggunakan akun cabang masing-masing.
2. **Update Stok Harian:** Tiap sore/malam, mitra memasukkan sisa stok fisik di toko. Sistem langsung menghitung persentase stok terhadap target (*Par Level*).
3. **Order Restock:** Jika stok menipis, mitra memilih produk dan jumlah yang dibutuhkan, lalu klik "Ajukan Restock".
4. **Penerimaan Barang:** Saat barang tiba dari Daisuki pusat, mitra klik "Barang Diterima", dan stok sistem otomatis bertambah.

### B. Alur Admin Pusat (Desktop):
1. **Monitoring Cabang:** Admin melihat satu tabel ringkasan seluruh cabang dengan indikator warna:
   - 🟢 **Aman** (Stok > 50%)
   - 🟡 **Waspada** (Stok 20% – 50%)
   - 🔴 **Kritis** (Stok < 20%) — langsung memicu alert!
   - ⚪ **Belum Update** (> 24 jam belum lapor stok)
2. **Approval Order:** Admin melihat pesanan masuk dari mitra, menyetujui kuantitas barang, dan mengubah status menjadi "Dalam Pengiriman".

---

## 2. 👥 Pembagian Role Tim yang Jelas & Terarah

| Role | Tanggung Jawab Utama | Hasil Kerja Nyata |
|---|---|---|
| **💻 Fullstack Developer** | **Sistem Web, API & Database** | • Portal Mitra (HP): Form lapor stok sisa harian & ajukan restock.<br>• Dashboard Admin: Tabel warna status stok cabang (Aman/Waspada/Kritis) & approval pengiriman.<br>• Backend & DB: Pencatatan otomatis barang masuk/keluar (`stock_logs`) & status pesanan. |
| **📊 Data Science** | **Analisis Stok & Batas Aman** | • Menghitung konsumsi rata-rata barang per cabang.<br>• Menentukan rumus batas aman stok (*Safety Stock* & *Par Level*) agar cabang tidak kehabisan barang sebelum kiriman pabrik tiba.<br>• Menyiapkan data dummy/sintetis produk dan transaksi untuk testing. |
| **🤖 AI Engineer** | **Otomasi, Alert & Reminder** | • Sistem alert otomatis: Munculkan notifikasi instan ke admin saat stok cabang kritis (< 20%).<br>• Reminder otomatis: Peringatan jika cabang lupa update stok > 24 jam.<br>• Rekomendasi restock otomatis saat mitra buat order.<br>• Asisten chat praktis untuk admin cek ringkasan stok. |

---

## 3. 📦 Data Dummy Siap Pakai di Neon DB

Data awal ini digunakan agar sistem langsung bisa diuji alurnya secara nyata:

### 1. Data Mitra (Cabang)
- `Kafe Sejuk BSD` (Tipe: Kafe, PIC: Rina)
- `Hotel Aruna Jakarta` (Tipe: Hotel, PIC: Budi)
- `Resto Bento Serpong` (Tipe: Restoran, PIC: Siti)

### 2. Akun Demo Login
- **Admin:** `admin@daisuki.test` | Password: `password123`
- **Mitra 1:** `mitra1@daisuki.test` (Kafe Sejuk BSD) | Password: `password123`
- **Mitra 2:** `mitra2@daisuki.test` (Hotel Aruna Jakarta) | Password: `password123`

### 3. Daftar 5 Produk Daisuki
- `DSK-KS-001` - Keripik Singkong Original (Rp 8.000)
- `DSK-BR-002` - Basreng Pedas (Rp 9.500)
- `DSK-KP-003` - Keripik Pisang Coklat (Rp 8.500)
- `DSK-MK-004` - Makaroni Bantet (Rp 7.500)
- `DSK-SB-005` - Seblak Kering (Rp 9.000)

### 4. Skenario Stok Awal (Kafe Sejuk BSD)
- Keripik Singkong: `5 / 40` pcs (🔴 **Kritis** — stok 12.5%, memicu alert!)
- Basreng Pedas: `15 / 40` pcs (🟡 **Waspada** — stok 37.5%)
- Keripik Pisang: `35 / 40` pcs (🟢 **Aman** — stok 87.5%)

---

## 4. 🚀 Master Prompt Implementasi (Tinggal Copy & Jalankan)

Salin teks prompt di dalam kotak berikut dan berikan ke AI Agent untuk mulai eksekusi:

```text
Halo! Tolong implementasikan sistem MVP awal untuk Daisuki B2B Inventory Management System.

Sistem ini menggunakan monorepo Bun (apps/web untuk frontend TanStack Start, apps/api untuk backend ElysiaJS, dan Neon DB PostgreSQL sebagai database yang sudah terhubung di apps/api/.env).

FOKUS UTAMA:
Bangun sistem dasar yang fungsional (bukan teori) menggunakan data dummy yang realistis, mencakup alur lengkap Mitra dan Admin.

INSTRUKSI EKSEKUSI LANGKAH DEMI LANGKAH:

Langkah 1: Seed Data Dummy ke Neon DB
1. Buat script seeder (apps/api/src/db/seed.ts) menggunakan Drizzle ORM yang mengisi data awal:
   - 3 Mitra: "Kafe Sejuk BSD", "Hotel Aruna Jakarta", "Resto Bento Serpong".
   - 3 User login demo:
     * admin@daisuki.test (Role: admin, Nama: Admin Daisuki Pusat)
     * mitra1@daisuki.test (Role: mitra, Cabang: Kafe Sejuk BSD)
     * mitra2@daisuki.test (Role: mitra, Cabang: Hotel Aruna Jakarta)
     * Password hash untuk password default: "password123"
   - 5 Produk Daisuki (Keripik Singkong, Basreng Pedas, Keripik Pisang, Makaroni, Seblak).
   - partner_stocks awal dengan variasi status:
     * Kafe Sejuk BSD punya Keripik Singkong (5/40 pcs - Kritis), Basreng (15/40 pcs - Waspada), Pisang (35/40 pcs - Aman).
2. Jalankan script seeder tersebut agar data langsung masuk ke Neon DB.

Langkah 2: Backend REST API (apps/api)
1. Auth API:
   - POST /auth/login: Menerima email dan password, memvalidasi user, dan mengembalikan token JWT serta data user (role, partner_id, full_name).
   - GET /me: Mengambil profil user yang sedang login via Authorization Bearer token.
2. Stock API:
   - GET /stocks: Mengambil stok cabang mitra saat ini (dilengkapi nilai persentase dan status: aman, waspada, kritis, stale).
   - PUT /stocks: Mengupdate sisa stok fisik cabang + mencatat riwayat ke tabel stock_logs + otomatis membuat notifikasi alert jika status produk berubah menjadi kritis (< 20%).
3. Order API:
   - GET /orders: Mengambil daftar pesanan restock (filter berdasarkan mitra untuk user mitra, atau semua mitra untuk admin).
   - POST /orders: Mitra mengajukan pesanan restock baru (status awal: 'diproses').
   - PATCH /orders/:id/status: Mengupdate status pesanan ('disetujui', 'dalam_pengiriman', 'selesai'). Jika status menjadi 'selesai', stok partner_stocks otomatis bertambah sebesar qty yang disetujui.
4. Notifications API:
   - GET /notifications: Mengambil alert stok kritis dan pesanan baru.

Langkah 3: Frontend Web (apps/web)
1. Halaman Login (/login):
   - Form input email & password + sediakan tombol cepat "Login Demo Admin" dan "Login Demo Mitra" untuk memudahkan testing langsung.
2. Portal Mitra (/mitra):
   - Kartu info cabang & sisa stok produk.
   - Form cepat update stok fisik harian dengan tombol simpan.
   - Form pengajuan pesanan restock barang.
   - Daftar pesanan aktif dengan tombol "Konfirmasi Barang Diterima".
3. Dashboard Admin (/admin):
   - Kartu ringkasan metrik: Total Cabang, Cabang Kritis, Pesanan Butuh Approval.
   - Tabel monitoring stok semua cabang dengan warna status (Hijau/Kuning/Merah/Abu-abu).
   - Panel Approval Pesanan Mitra: Admin bisa menyetujui kuantitas dan mengubah status ke "Dalam Pengiriman".

Langkah 4: Pengujian & Verifikasi
- Pastikan bun run typecheck lulus tanpa error.
- Uji alur: Mitra lapor stok kritis -> Muncul alert di Admin -> Mitra buat order restock -> Admin approve -> Mitra konfirmasi terima barang.
```

---

## 5. ✅ Checklist Verifikasi Selesai

- [ ] Data dummy berhasil masuk ke Neon DB (tabel `partners`, `users`, `products`, `partner_stocks`).
- [ ] Tombol login demo berhasil mengarahkan Admin ke `/admin` dan Mitra ke `/mitra`.
- [ ] Mengubah stok Keripik Singkong menjadi `5` memunculkan badge merah **Kritis** dan alert di admin.
- [ ] Alur order restock dapat diselesaikan dari pengajuan hingga barang diterima (stok otomatis bertambah).
- [ ] Perintah `bun run typecheck` dari root berhasil tanpa error.
