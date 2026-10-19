# 🤖 Master Prompt Eksekusi Implementasi Sistem (Daisuki Inventory)

Prompt di bawah ini dirancang khusus untuk disalin dan diberikan langsung ke AI Agent (Codex / Claude Code / AI Developer) agar mengeksekusi seluruh rencana fitur yang ada di `docs/RENCANA_FITUR_DAN_ROLE.md`.

---

```markdown
### MASTER PROMPT EKSEKUSI: 4 PRODUK, STOK GUDANG PUSAT, APPROVAL PARSIAL & PERAN TIM

Halo AI Agent! Anda bertindak sebagai Senior Fullstack Engineer yang bertugas mengimplementasikan pembaruan fitur pada proyek "Daisuki B2B Inventory & Order Management System".

Referensi utama spesifikasi alur sistem ada di file:
`docs/RENCANA_FITUR_DAN_ROLE.md`

Database yang digunakan adalah Neon DB PostgreSQL Serverless (`DATABASE_URL` di `apps/api/.env`). Gunakan runtime Bun untuk seluruh operasi JS/TS.

---

### TUGAS EKSEKUSI UTAMA

Implementasikan alur kerja nyata berikut secara end-to-end:
1. Ganti katalog produk menjadi 4 produk resmi Daisuki dengan stok gudang pusat default 1.000 pcs per produk.
2. Sediakan informasi stok gudang pusat secara transparan di portal mitra.
3. Sediakan fitur pengajuan restock multi-item (A, B, C, D sekaligus) oleh mitra saat stok cabang menipis (sisa 10 pcs).
4. Sediakan fitur approval parsial di dashboard admin (admin bisa menentukan kuantitas yang disetujui per produk dan WAJIB/BISA memberikan catatan alasan penyesuaian).
5. Tampilkan status disetujui, rincian barang yang disetujui, dan catatan alasan admin di halaman mitra.
6. Siapkan modul/script praktis untuk tim Data Science (`data-science/`) dan AI Engineer (`ai/`).

---

### LANGKAH-LANGKAH IMPLEMENTASI TEKNIS:

#### Langkah 1: Perbarui Skema Database & Migrasi SQL
1. File `apps/api/src/db/schema.ts`:
   - Pada tabel `products`: tambahkan kolom `central_stock: integer("central_stock").notNull().default(1000)`.
   - Pada tabel `orders`: tambahkan kolom `admin_note: text("admin_note")`.
2. Buat file migrasi `supabase/migrations/0005_central_stock_and_admin_notes.sql`:
   ```sql
   ALTER TABLE products ADD COLUMN IF NOT EXISTS central_stock INTEGER NOT NULL DEFAULT 1000;
   ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_note TEXT;
   ```

#### Langkah 2: Perbarui Seeder Data Dummy (`apps/api/src/db/seed.ts`)
1. Masukkan 4 produk resmi Daisuki:
   - `DSK-SB-001` - "Seblak Jadul Instan" (Rp 12.000, unit: "pcs", central_stock: 1000)
   - `DSK-BR-002` - "Basreng Daun Jeruk" (Rp 10.000, unit: "pcs", central_stock: 1000)
   - `DSK-MK-003` - "Makaroni Daun Jeruk" (Rp 8.500, unit: "pcs", central_stock: 1000)
   - `DSK-KP-004` - "Keripik Pisang Rasa Coklat" (Rp 15.000, unit: "pcs", central_stock: 1000)
2. Buat skenario stok awal untuk Mitra 1 (Kafe Sejuk BSD):
   - Seblak Jadul Instan: sisa 10 pcs (Par Level 40 -> Kritis)
   - Basreng Daun Jeruk: sisa 10 pcs (Par Level 40 -> Kritis)
   - Makaroni Daun Jeruk: sisa 30 pcs (Par Level 40 -> Aman)
   - Keripik Pisang Rasa Coklat: sisa 35 pcs (Par Level 40 -> Aman)
3. Eksekusi script seed: `bun --cwd apps/api seed`.

#### Langkah 3: Sempurnakan Backend API (`apps/api/src/modules/`)
1. `apps/api/src/modules/stocks/index.ts` & `productsModule`:
   - Pastikan query `GET /products` menyertakan kolom `central_stock`.
   - Tambahkan endpoint `PUT /products/:id/central-stock` (Admin only) untuk memperbarui stok gudang pusat Daisuki.
2. `apps/api/src/modules/orders/index.ts`:
   - Di `GET /orders`: sertakan `admin_note` pada respon data pesanan.
   - Di `POST /orders`: dukung pembuatan pesanan multi-item (A, B, C, D).
   - Di `PATCH /orders/:id/status`:
     * Terima `admin_note` dari body request saat admin menyetujui (`status === "disetujui"`).
     * Simpan `admin_note` ke tabel `orders`.
     * Simpan `qty_approved` untuk masing-masing item di tabel `order_items`.
     * Saat status menjadi `"selesai"` (mitra konfirmasi terima):
       - Tambah stok cabang (`partner_stocks`) sesuai `qty_approved`.
       - Kurangi stok gudang pusat (`products.central_stock`) sesuai `qty_approved`.
     * Kirim notifikasi ke mitra yang menyertakan informasi bahwa pesanan telah disetujui beserta catatan dari admin.

#### Langkah 4: Sempurnakan Frontend Web (`apps/web/`)
1. `apps/web/src/lib/inventory-types.ts`:
   - Tambahkan `central_stock: number` pada interface Product/StockItem.
   - Tambahkan `admin_note?: string | null` pada interface Order.
2. Portal Mitra (`apps/web/src/routes/mitra.tsx`):
   - Tampilkan kartu informasi: **"📦 Ketersediaan Stok Gudang Daisuki Pusat"** yang menampilkan stok ke-4 produk (masing-masing 1.000 pcs).
   - Di tab "Pesan": sediakan form pemesanan yang memuat ke-4 produk sekaligus dengan input jumlah pemesanan (misal default 50 pcs untuk Seblak dan Basreng yang kritis).
   - Di tab "Pesanan" (riwayat):
     * Tampilkan badge status "Disetujui".
     * Tampilkan tabel rincian: Jumlah Diminta vs Jumlah Disetujui Admin.
     * Tampilkan kotak pesan "Catatan Admin Pusat" jika `admin_note` terisi.
     * Tombol "Konfirmasi Barang Diterima" saat status `dalam_pengiriman`.
3. Dashboard Admin (`apps/web/src/routes/admin.tsx`):
   - Sediakan panel pemantauan & edit cepat Stok Gudang Pusat Daisuki (1.000 pcs).
   - Di tab "Pesanan" pada pesanan status `diproses`:
     * Tampilkan rincian barang yang diminta oleh mitra (A, B, C, D).
     * Sediakan input kuantitas persetujuan (`qty_approved`) per item (bisa diisi 30, 0, 40, 50, dsb).
     * Sediakan textarea input: **"Catatan / Alasan Penyesuaian Admin"**.
     * Tombol "Setujui Pesanan" yang mengirim kuantitas approval dan catatan admin.

#### Langkah 5: Siapkan Script Sederhana untuk Peran Data Science & AI Engineer
1. Buat script di `data-science/src/inventory_model.py`:
   - Script kalkulasi Reorder Point (ROP), Safety Stock, dan saran restock untuk 4 produk Daisuki dengan lead time 6 hari.
2. Buat script di `ai/jobs/stale_stock_reminder.py`:
   - Script pendeteksi cabang yang belum update stok > 24 jam yang langsung membuat notifikasi ke tabel `notifications`.
3. Buat script di `ai/jobs/emergency_restock_alert.py`:
   - Script pendeteksi produk kritis (stok <= 10 pcs) untuk memicu alert admin.

#### Langkah 6: Verifikasi & Uji Coba
1. Jalankan `bun run typecheck` dari root workspace, pastikan 0 error TypeScript.
2. Jalankan `bun run dev` dan uji alur:
   - Login Mitra 1 ➔ Lihat stok pusat 1.000 pcs ➔ Ajukan restock A, B, C, D.
   - Login Admin ➔ Setujui dengan kuantitas berbeda (A=30, B=0, C=40, D=50) + tulis alasan di catatan admin.
   - Kembali ke Mitra 1 ➔ Lihat status approved, rincian barang, dan alasan admin.
```
