# 📋 Panduan Alur Kerja & Master Prompt: Data Science & AI Engineer
**Daisuki B2B Inventory & Order Management System**

Dokumen ini berisi panduan alur estafet kerja nyata, arsitektur data, dan **Master Prompt Siap Eksekusi** untuk peran **Data Science** dan **AI Engineer** dalam mengolah data perkembangan 100 mitra cabang.

---

## 🔄 Alur Estafet Data (End-to-End Pipeline)

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   1. MITRA CABANG (apps/web/src/routes/mitra.tsx)       │
│  - 100 Mitra rutin update sisa stok fisik harian                       │
│    Contoh:                                                             │
│    • Senin  : Seblak diupdate dari 40 -> 35 (konsumsi = 5 pcs)          │
│    • Selasa : Seblak diupdate dari 35 -> 30 (konsumsi = 5 pcs)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ (Tersimpan ke Neon DB)
┌────────────────────────────────────────────────────────────────────────┐
│                   2. TABEL `stock_logs` & `partner_stocks`             │
│  - Menyimpan setiap pergerakan stok: partner_id, product_id,           │
│    qty_before, qty_after, source, created_at                           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ (Diakses di Dashboard Admin)
┌────────────────────────────────────────────────────────────────────────┐
│                   3. TAB DATA SCIENCE (apps/web/src/routes/admin.tsx)  │
│  - Rangkuman Log Mingguan: misal 70 dari 100 mitra aktif update Senin  │
│  - Tombol: [ 📥 Export Raw Log Mitra (CSV) ]                           │
│  - Sekali klik langsung download riwayat transaksi mentah 100 mitra    │
│    (Proses cepat dalam hitungan detik, tidak perlu nunggu 1 minggu)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ (File: `raw_stock_logs.csv`)
┌────────────────────────────────────────────────────────────────────────┐
│                   4. ROLE: DATA SCIENCE (data-science/)                │
│  - Karakteristik data hasil export: MASIH KOTOR (Raw Data)             │
│  - Tugas Cleaning:                                                     │
│    1. Hapus duplikasi input (jika mitra klik simpan 2x berturut-turut) │
│    2. Tangani missing data (mitra yang lupa update di hari tertentu)   │
│    3. Standarisasi format timestamp & grouping per minggu              │
│    4. Hitung Average Daily Usage (ADU) & laju konsumsi mingguan        │
│  - Output: `cleaned_inventory_summary.csv`                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ (Data Bersih Di-oper ke AI)
┌────────────────────────────────────────────────────────────────────────┐
│                   5. ROLE: AI ENGINEER (ai/)                           │
│  - Mengambil data bersih hasil olahan Data Science                     │
│  - Tugas Pemodelan & Otomasi AI:                                       │
│    1. Identifikasi mitra yang sering kehabisan stok (Frequent Stockout)│
│    2. Hitung saran pengiriman barang & alokasi stok dari Gudang Pusat  │
│    3. Rekomendasi kuantitas restock per cabang (Suggested Restock Qty) │
│    4. Tulis hasil ke tabel `restock_recommendations` & notifikasi AI   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ (Muncul Kembali di Aplikasi)
┌────────────────────────────────────────────────────────────────────────┐
│                   6. TAMPIL LIVE DI APLIKASI WEB                       │
│  - Admin: Melihat daftar cabang rawan habis stok & saran alokasi       │
│  - Mitra: Muncul tombol "✨ Gunakan Rekomendasi Pintar AI"              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. 📊 Fitur Tab Data Science di Dashboard Admin (`apps/web/src/routes/admin.tsx`)

Pada halaman Admin, disediakan tab khusus **Data Science & Log Perkembangan**:

1. **Rangkuman Log Mingguan (Weekly Summary Metrics)**:
   - Menampilkan metrik performa 100 mitra:
     * **Total Log Minggu Ini**: Jumlah pembaruan stok yang masuk.
     * **Mitra Aktif**: Mengetahui berapa mitra yang aktif melapor (misal: *70 dari 100 mitra sudah update di hari Senin*).
     * **Rata-rata Konsumsi Harian**: Perkiraan barang keluar per hari dari seluruh cabang.
2. **Tabel Log Perkembangan Real-Time**:
   - Memantau riwayat perubahan stok per cabang:
     * *Nama Cabang* (misal: Kafe Sejuk BSD).
     * *Nama Produk* (Seblak Jadul, Basreng, Makaroni, Keripik Pisang).
     * *Stok Sebelum* (40 pcs).
     * *Stok Sesudah* (35 pcs).
     * *Perubahan/Konsumsi* (-5 pcs).
     * *Waktu Update* (Senin, 09:30 WIB).
3. **Tombol "Export Raw Log Mitra"**:
   - Berfungsi mengunduh seluruh data `stock_logs` dari 100 mitra dalam format CSV mentah secara instan.
   - **Karakteristik Data Mentah (Kotor)**:
     * Masih berisi duplikasi log saat mitra menekan tombol simpan berulang kali.
     * Terdapat nilai kosong/null jika ada mitra yang tidak melaporkan stok di hari tertentu.
     * Format timestamp yang belum seragam.
     * Campuran antara pengurangan konsumsi fisik (`manual_update`) dan penambahan barang datang (`order_received`).

---

## 2. 📝 MASTER PROMPT: ROLE DATA SCIENCE

> **Petunjuk:** Salin seluruh teks di dalam blok di bawah ini dan berikan ke anggota tim atau AI Agent yang berperan sebagai **Data Science**.

```text
Halo Data Science Engineer! Anda bertanggung jawab atas pengolahan data riil dan pembersihan log perkembangan 100 mitra cabang di proyek Daisuki B2B Inventory.

FOLDER KERJA:
data-science/

LATAR BELAKANG BISNIS:
Mitra cabang (total 100 mitra) mengupdate sisa stok fisik harian di web.
Contoh:
- Senin  : Mitra Kafe Sejuk update Seblak dari 40 -> 35 (terjual 5 pcs)
- Selasa : Update lagi dari 35 -> 30 (terjual 5 pcs)
Data ini diexport oleh Admin dari tab Data Science di web menjadi file raw CSV ('raw_stock_logs.csv') atau dibaca langsung via koneksi database Neon DB.

MASALAH YANG HARUS ANDA SELESAIKAN:
Data hasil export ini adalah DATA KOTOR (Raw Data) yang memiliki masalah:
1. Duplikasi input (mitra salah klik simpan 2x dalam hitungan detik).
2. Missing values (ada mitra yang tidak update di hari tertentu).
3. Campuran transaksi (harus dipisahkan antara barang terjual/konsumsi dan barang kiriman baru yang masuk).
4. Inkonsistensi format waktu dan outlier angka (misal salah input angka negatif atau melebihi par level).

TUGAS ANDA:
1. Buat script pembersih data: `data-science/src/clean_logs.py`
   - Membaca file 'raw_stock_logs.csv' (atau query tabel stock_logs di Neon DB).
   - Cleaning Pipeline:
     * Drop duplicate logs dalam rentang waktu < 1 menit untuk mitra & produk yang sama.
     * Pisahkan source: ambil hanya source = 'manual_update' untuk analisis konsumsi murni.
     * Hitung Delta Konsumsi Harian: consumption = qty_before - qty_after.
     * Imputasi data: jika ada hari yang kosong, gunakan forward fill atau interpolasi rata-rata konsumsi harian toko tersebut.
     * Agregasi mingguan: hitung Total Konsumsi 7 Hari per mitra per produk.

2. Hitung Metrik Stok & Titik Kritis:
   - Average Daily Usage (ADU): Total Konsumsi 7 Hari / 7.
   - Lead Time pabrik (L) = 6 hari pengiriman.
   - Safety Stock (SS) = round(1.65 * std_dev * sqrt(L)).
   - Reorder Point (ROP) = round((ADU * L) + SS).
   - Days of Cover: current_qty / ADU (estimasi berapa hari lagi barang habis).

3. Oper Data Bersih ke Tim AI:
   - Simpan dataset bersih ke: `data-science/data/cleaned_inventory_summary.csv`
   - Format kolom data bersih:
     [partner_id, partner_name, product_id, product_name, current_qty, par_level, weekly_consumption, adu, safety_stock, rop, days_of_cover, is_critical]

4. Output Verifikasi:
   - Jalankan `python src/clean_logs.py`.
   - Tampilkan statistik ringkasan: jumlah data sebelum cleaning vs setelah cleaning, serta 5 mitra dengan konsumsi tertinggi.
```

---

## 3. 🤖 MASTER PROMPT: ROLE AI ENGINEER

> **Petunjuk:** Salin seluruh teks di dalam blok di bawah ini dan berikan ke anggota tim atau AI Agent yang berperan sebagai **AI Engineer**.

```text
Halo AI Engineer! Anda bertanggung jawab membangun sistem rekomendasi cerdas, deteksi mitra yang sering kehabisan barang, dan saran pengiriman di proyek Daisuki B2B Inventory.

FOLDER KERJA:
ai/

INPUT DATA ANDA:
Anda menerima dataset bersih ('cleaned_inventory_summary.csv') yang telah disiapkan oleh tim Data Science (atau query langsung ke tabel agregat di Neon DB).

TUGAS ANDA:
1. Deteksi Mitra Sering Kehabisan Barang (Frequent Stockout Pattern):
   - Buat modul: `ai/jobs/analyze_stockouts.py`
   - Analisis pola:
     * Cari mitra yang memiliki Days of Cover < 2 hari.
     * Cari mitra yang sisa stoknya < 20% par level atau sering menyentuh level kritis.
     * Klasifikasikan 100 mitra ke dalam 3 level risiko:
       a. 'HIGH_STOCKOUT_RISK' (Sering kehabisan barang, butuh suplai darurat).
       b. 'MODERATE_RISK' (Stok waspada, perlu dijadwalkan).
       c. 'SAFE' (Konsumsi stabil, stok mencukupi).

2. Sistem Rekomendasi Alokasi & Saran Pengiriman:
   - Buat modul: `ai/jobs/smart_allocation.py`
   - Logika Rekomendasi:
     * Suggested Restock Qty = max(0, Par Level - Current Qty + Safety Stock).
     * Jika stok gudang pusat terbatas (misal sisa 1000 pcs sedangkan total kebutuhan 1500 pcs), buat algoritma alokasi prioritas untuk cabang dengan status HIGH_STOCKOUT_RISK terlebih dahulu.
   - Tulis rekomendasi kuantitas ini langsung ke tabel `restock_recommendations` di Neon DB:
     INSERT / UPSERT ke kolom:
     (partner_id, product_id, forecast_qty, suggested_qty, days_of_cover, model_version)
     Gunakan model_version = 'v1.0-ai-smart-allocation'.

3. Generator Notifikasi Alarm & Ringkasan Eksekutif (AI Digest):
   - Jika cabang masuk kategori HIGH_STOCKOUT_RISK, buat notifikasi otomatis ke tabel `notifications`:
     * audience: 'admin'
     * type: 'emergency_restock'
     * title: 'Prioritas Kirim: [Nama Cabang]'
     * body: '[Nama Cabang] sering kehabisan [Nama Produk]. Sisa stok hanya cukup untuk [Days of Cover] hari. Disarankan kirim [Suggested Qty] pcs.'
   - Buat script ringkasan harian untuk Admin:
     "Hari ini terdapat 15 mitra kategori High Stockout Risk. Saran alokasi: prioritaskan pengiriman Seblak dan Basreng ke Kafe Sejuk dan Resto Rasa."

4. Output Verifikasi:
   - Jalankan `python jobs/analyze_stockouts.py` dan `python jobs/smart_allocation.py`.
   - Pastikan data berhasil masuk ke tabel `restock_recommendations` dan `notifications` di Neon DB, sehingga otomatis muncul di Dashboard Admin dan Portal Mitra.
```

---

## 4. 🔗 Hubungan Antar-Role dalam Repositori

| Role | Input | Proses Utama | Output yang Diberikan |
|---|---|---|---|
| **Fullstack Web** | Input klik mitra di web | Menyimpan log harian ke database & menyediakan tombol Export | File mentah `raw_stock_logs.csv` & API Endpoint |
| **Data Science** | File mentah `raw_stock_logs.csv` dari web | Data Cleaning, hilangkan duplikat, hitung ADU mingguan & batas ROP | Dataset Bersih `cleaned_inventory_summary.csv` |
| **AI Engineer** | Dataset Bersih dari Data Science | Analisis mitra sering kehabisan stok, kalkulasi alokasi pengiriman | Rekomendasi restock di Neon DB & Alarm darurat Admin |

Dengan dokumen alur ini, masing-masing peran memiliki batasan tugas yang jelas, saling terhubung tanpa menunggu lama, dan seluruh hasilnya dapat langsung dinikmati oleh Admin dan Mitra di antarmuka web.
