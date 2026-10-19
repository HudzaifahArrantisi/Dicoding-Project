# 🚀 Master Prompt 3 Peran Tim — Terhubung Langsung ke Neon DB PostgreSQL

Dokumen ini berisi panduan dan **Master Prompt Siap Eksekusi** untuk masing-masing peran di proyek **Daisuki Inventory**. Semua peran **100% langsung terhubung ke database Neon DB di Cloud** (tanpa menggunakan file dummy/mock lokal terpisah).

---

## 🌐 Arsitektur Data Terpusat di Neon DB

```mermaid
flowchart TD
  subgraph CLOUD DATABASE (Neon DB PostgreSQL)
    T1[(partner_stocks)]
    T2[(stock_logs)]
    T3[(orders & order_items)]
    T4[(restock_recommendations)]
    T5[(notifications)]
    T6[(partners & products)]
  end

  subgraph 1. FULLSTACK (apps/web & apps/api)
    FS1[Portal Mitra HP] -->|Lapor Stok & Order Restock| T1
    FS1 -->|Baca Rekomendasi AI| T4
    FS2[Dashboard Admin Desktop] -->|Monitoring Warna & Approval| T1
    FS2 -->|Baca Alert & Notifikasi| T5
  end

  subgraph 2. DATA SCIENCE (data-science/)
    DS1[Script Analisis Python] -->|1. SELECT Stok & Produk Riil| T1
    DS1 -->|2. Hitung Safety Stock & ROP| DS2[Model Lead Time 6 Hari]
    DS2 -->|3. INSERT / UPSERT Langsung| T4
  end

  subgraph 3. AI ENGINEER (ai/)
    AI1[Scheduler Job Python/Bun] -->|1. SELECT Stok > 24 Jam Belum Update| T1
    AI1 -->|2. INSERT Alert Reminder Otomatis| T5
    AI2[AI Digest Generator] -->|3. Buat Ringkasan Eksekutif Admin| FS2
  end
```

---

## 1. 💻 Prompt untuk FULLSTACK DEVELOPER

**Anggota:** Frisca Nabilla, Hudzaifah Ar-Rantisi  
**Workspace:** `apps/web/`, `apps/api/`, `packages/shared/`

```text
Halo AI Agent! Anda bertindak sebagai Fullstack Developer untuk proyek Daisuki Inventory.

TUJUAN UTAMA:
Menghubungkan Portal Mitra dan Dashboard Admin dengan tabel `restock_recommendations` dan `notifications` yang diisi langsung oleh tim Data Science dan AI Engineer di Neon DB.

KONEKSI DATABASE:
Gunakan connection string Neon DB yang sudah ada di `apps/api/.env`:
DATABASE_URL=postgresql://<db_user>:<db_password>@<ep-endpoint>-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

TUGAS LANGSUNG:
1. Endpoint API Rekomendasi (apps/api):
   - Pastikan endpoint `GET /stocks/recommendations` aktif dan mengambil data live dari tabel `restock_recommendations` yang di-join dengan tabel `products` dan `partners`.

2. Integrasi ke Portal Mitra (apps/web/src/routes/mitra.tsx):
   - Di tab "Ajukan Restock", tambahkan tombol cepat: "✨ Gunakan Rekomendasi Cerdas AI (Data Science)".
   - Saat diklik, form otomatis mengambil nilai `suggested_qty` terbaru dari tabel `restock_recommendations` di Neon DB dan mengisi kuantitas pemesanan.

3. Integrasi ke Dashboard Admin (apps/web/src/routes/admin.tsx):
   - Di tabel monitoring stok, tampilkan indikator "Rekomendasi Restock: X pcs" dari tabel `restock_recommendations`.
   - Di tab "Alert & Notifikasi", pastikan notifikasi reminder otomatis (type: 'stale_update') dari AI Engineer langsung muncul secara live.

4. Verifikasi:
   - Jalankan `bun run typecheck` dari root repositori dan pastikan 0 error.
```

---

## 2. 📊 Prompt untuk DATA SCIENCE

**Anggota:** Adelia Juliani, Keyla Farrelia  
**Workspace:** `data-science/`

```text
Halo AI Agent! Anda bertindak sebagai Data Science Engineer untuk proyek Daisuki Inventory.

TUJUAN UTAMA:
Menghubungkan script Python langsung ke Neon DB PostgreSQL (tanpa file mock lokal), menganalisis stok riil mitra, menghitung batas aman (Safety Stock & Reorder Point dengan lead time pabrik 6 hari), dan langsung menyimpan hasil rekomendasi ke tabel `restock_recommendations` di Neon DB.

KONEKSI DATABASE:
Gunakan psycopg untuk koneksi langsung ke Neon DB (ambil kredensial dari .env):
DATABASE_URL="postgresql://<db_user>:<db_password>@<ep-endpoint>-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

TUGAS LANGSUNG YANG HARUS DIIMPLEMENTASIKAN:
1. Setup Script Koneksi Live (data-science/src/db_connect.py):
   - Buat helper koneksi database menggunakan library `psycopg` yang membaca DATABASE_URL dari file .env.

2. Modul Model Safety Stock & ROP (data-science/src/inventory_model.py):
   - Rumus perhitungan inventaris berbasis parameter industri F&B:
     * Lead Time pabrik (L) = 6 hari.
     * Service Level Factor (Z) = 1.65 (95% ketersediaan barang).
     * Safety Stock (SS) = round(Z * std_dev * sqrt(L)).
     * Reorder Point (ROP) = round((ADU * L) + SS).
     * Suggested Restock Qty = max(0, Par Level - Current Stock).
     * Days of Cover = round(Current Stock / ADU, 1) jika ADU > 0.

3. Script Eksekutor Rekomendasi Live ke Neon DB (data-science/src/populate_recommendations.py):
   - Baca langsung data cabang dan produk dari tabel `partner_stocks`, `products`, dan `partners` di Neon DB:
     `SELECT ps.partner_id, ps.product_id, ps.current_qty, ps.par_level, p.name FROM partner_stocks ps JOIN products p ON ps.product_id = p.id;`
   - Hitung nilai rekomendasi untuk setiap produk di tiap cabang.
   - Lakukan penulisan langsung (UPSERT/INSERT) ke tabel `restock_recommendations`:
     `INSERT INTO restock_recommendations (partner_id, product_id, forecast_qty, suggested_qty, days_of_cover, model_version) VALUES (%s, %s, %s, %s, %s, 'v1.0-neon-live');`

4. Output Verifikasi:
   - Jalankan `python src/populate_recommendations.py`.
   - Tampilkan tabel ringkasan di konsol yang membuktikan data berhasil masuk ke Neon DB.
```

---

## 3. 🤖 Prompt untuk AI ENGINEER

**Anggota:** Annura Rizkya Chantika, Reyhan Fawwaz Habibi  
**Workspace:** `ai/`

```text
Halo AI Agent! Anda bertindak sebagai AI & Automation Engineer untuk proyek Daisuki Inventory.

TUJUAN UTAMA:
Membangun background job otomasi yang langsung beroperasi di atas database Neon DB: mendeteksi cabang yang telat lapor stok (> 24 jam) dan langsung mengirim notifikasi reminder ke tabel `notifications`, serta menghasilkan ringkasan inventaris pintar (AI Digest) untuk Admin.

KONEKSI DATABASE:
Gunakan connection string Neon DB yang sama (ambil kredensial dari .env):
DATABASE_URL="postgresql://<db_user>:<db_password>@<ep-endpoint>-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

TUGAS LANGSUNG YANG HARUS DIIMPLEMENTASIKAN:
1. Scheduler Otomasi Reminder 24 Jam (ai/jobs/stale_stock_reminder.py):
   - Query langsung ke Neon DB:
     `SELECT ps.partner_id, p.name, MAX(ps.updated_at) as last_update FROM partner_stocks ps JOIN partners p ON ps.partner_id = p.id GROUP BY ps.partner_id, p.name HAVING MAX(ps.updated_at) < NOW() - INTERVAL '24 hours';`
   - Jika ditemukan cabang yang belum lapor stok > 24 jam, langsung INSERT ke tabel `notifications`:
     * audience: 'admin'
     * type: 'stale_update'
     * title: 'Reminder: Cabang Belum Update Stok Fisik'
     * body: 'Cabang [Nama Cabang] belum melaporkan sisa stok harian lebih dari 24 jam.'

2. Otomasi Rekomendasi Restock Darurat (ai/jobs/emergency_restock_alert.py):
   - Cek tabel `partner_stocks` untuk stok dengan persentase < 20% yang belum memiliki pesanan aktif di tabel `orders`.
   - Buat notifikasi bertipe 'low_stock' ke tabel `notifications` agar Admin langsung menerima reminder untuk memproses pengiriman.

3. Asisten Ringkasan Cerdas Admin (ai/assistant/inventory_digest.py):
   - Query ringkasan status stok dari Neon DB: total cabang, item kritis, pesanan pending.
   - Buat fungsi yang menghasilkan teks ringkasan eksekutif harian:
     * Status ketersediaan stok cabang saat ini.
     * Cabang prioritas yang membutuhkan perhatian khusus.
     * Tindakan yang direkomendasikan untuk Admin hari ini.

4. Output Verifikasi:
   - Jalankan `python jobs/stale_stock_reminder.py` dan `python assistant/inventory_digest.py`.
   - Pastikan notifikasi baru langsung muncul di tabel `notifications` Neon DB dan dapat dilihat di Dashboard Admin web.
```

---

## 🎯 Mengapa Pendekatan Ini 100% Nyata?

1. **Satu Sumber Kebenaran (Single Source of Truth):**  
   Ketiga peran tidak bekerja dengan file CSV lokal yang terpisah-pisah, melainkan **sama-sama membaca dan menulis ke satu Neon DB PostgreSQL yang sama**.
2. **Siklus Tertutup (Closed-Loop System):**  
   - **Mitra** lapor stok riil di web ➔ masuk ke Neon DB.  
   - **Data Science** baca stok riil dari Neon DB ➔ hitung batas aman ➔ tulis rekomendasi ke Neon DB.  
   - **AI Engineer** pantau riwayat di Neon DB ➔ kirim alert & reminder otomatis ke Neon DB.  
   - **Admin & Mitra** langsung melihat alert dan tombol rekomendasi tersebut di web.
