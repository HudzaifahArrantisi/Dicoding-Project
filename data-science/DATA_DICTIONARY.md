# Kamus Data (Data Dictionary) — Data Science & Analytics Daisuki

Dokumen ini merupakan sumber kebenaran (*single source of truth*) untuk spesifikasi data, kamus fitur, kontrak handoff produksi, serta metodologi pencegahan *data leakage* pada platform **Daisuki B2B Inventory & Order Management System**.

---

## 1. Arsitektur Data & Aliran Kerja

```
[Sumber Data Operasional]
  ├── Database Neon DB (stock_logs, partner_stocks, partners, products)
  └── File Mentah Lokal (data/raw_stock_logs.csv, data/primary_stock_logs.csv)
          │
          ▼
[Pipeline Pembersihan: clean_logs.py]
  ├── Validasi transaksi & debounce (< 60s)
  ├── Klasifikasi Sumber Data (primary_daisuki vs synthetic_seed)
  ├── Time-Based Split (80% Train / 20% Test)
  │       │
  │       ├── data/cleaned_inventory_summary.csv  (Snapshot Penuh)
  │       ├── data/train_inventory_summary.csv    (80% Periode Awal)
  │       └── data/test_inventory_summary.csv     (20% Periode Akhir)
  │
  ▼
[Pipeline Agregasi & Handoff: weekly_analytics_aggregator.py]
  └── reports/runs/<run_id>/
          ├── category_products.json   (Analisis 4 Produk Resmi)
          ├── category_partners.json   (Kesehatan Cabang - Admin Only)
          ├── category_regions.json    (Klaster Spasial Wilayah)
          ├── category_reporting.json  (Kepatuhan Laporan Fisik)
          ├── risk_records.csv         (Evaluasi Risiko Pasokan - Admin Only)
          └── manifest.json            (Audit Trail & Privacy Notice)
  │
  ▼
[Konsumen Produksi: AI Engine & Admin Dashboard]
  ├── Tabel Database: restock_recommendations
  ├── AI Assistant & Tool Calling (Admin Only)
  └── Dashboard Rekomendasi Restock Admin
```

---

## 2. Kamus Data Dataset Eksperimen & Pemodelan

Dataset eksperimen disimpan di `data-science/data/` dan dihasilkan oleh script [clean_logs.py](file:///C:/daisuki-inventory/data-science/src/clean_logs.py). Format kolom pada ketiga file ([cleaned_inventory_summary.csv](file:///C:/daisuki-inventory/data-science/data/cleaned_inventory_summary.csv), [train_inventory_summary.csv](file:///C:/daisuki-inventory/data-science/data/train_inventory_summary.csv), dan [test_inventory_summary.csv](file:///C:/daisuki-inventory/data-science/data/test_inventory_summary.csv)) identik.

| No | Nama Kolom | Tipe Data | Contoh Nilai | Keterangan & Rumus Bisnis |
|---|---|---|---|---|
| 1 | `partner_id` | UUID (String) | `372ce392-cf3c-4119-8b47-ce94e47052d8` | Pengenal unik cabang mitra di database. |
| 2 | `partner_name` | String | `kopken cijeruk`, `Hotel Mentari Solo` | Nama resmi cabang mitra (hotel, resto, kafe, minimarket). |
| 3 | `product_id` | UUID (String) | `aed53bdf-07d0-4054-bf45-36be0a913a38` | Pengenal unik salah satu dari 4 produk resmi Daisuki. |
| 4 | `product_name` | String | `Basreng Daun Jeruk` | Nama resmi makanan ringan Daisuki (tanpa SKU internal). |
| 5 | `current_qty` | Integer | `15` | Sisa kuantitas stok fisik riil di rak cabang saat ini (satuan: pcs). |
| 6 | `par_level` | Integer | `60` | Buffer acuan dinamis/pengaman cabang (bukan kapasitas maksimum rak). |
| 7 | `weekly_consumption` | Float | `24.50` | Akumulasi unit yang terjual/berkurang selama 7 hari observasi. |
| 8 | `adu` | Float | `3.500` | *Average Daily Usage*: Rata-rata konsumsi harian ($\text{weekly\_consumption} / 7$). |
| 9 | `safety_stock` | Integer | `8` | Cadangan stok pengaman terhadap variabilitas pemakaian: $1.65 \times \sigma_{\text{daily}} \times \sqrt{L}$ ($L=6$ hari). |
| 10 | `rop` | Integer | `29` | *Reorder Point*: Ambang batas restok ($\text{ADU} \times L + \text{Safety Stock}$). |
| 11 | `days_of_cover` | Float | `4.3` (atau `999.0`) | Estimasi ketahanan stok dalam hari ($\text{current\_qty} / \text{ADU}$). Jika $\text{ADU}=0$, diberi sentinel `999.0`. |
| 12 | `is_critical` | Boolean | `True` / `False` | Bernilai `True` jika $\text{days\_of\_cover} < 2$ hari atau $\text{current\_qty} < 20\%$ dari par level. |
| 13 | `data_source` | String | `primary_daisuki`, `synthetic_seed` | Label eksplisit asal baris data (mitra riil Daisuki vs generator sintetis). |
| 14 | `is_synthetic` | Boolean | `True` / `False` | `True` jika baris berasal dari seed demo; `False` jika data primer lapangan. |

### Dataset Fitur Lanjutan: `featured_partner_metrics.csv` (Tiket #2)
Dihasilkan oleh modul reusable [feature_engineering.py](file:///C:/daisuki-inventory/data-science/src/feature_engineering.py) untuk keperluan pemodelan lanjutan, clustering profil mitra (Tipe A/B/C), dan deteksi kecepatan penyerapan stok:

| Kategori Fitur | Nama Kolom | Tipe Data | Keterangan & Rumus Matematis |
|---|---|---|---|
| **Kecepatan & Tren** | `absorption_rate` | Float | Rasio penyerapan stok mingguan terhadap ketersediaan: $\frac{\text{weekly\_consumption}}{\text{current\_qty} + \text{weekly\_consumption}}$ (0.0 jika pembagi 0). |
| | `buffer_absorption_rate` | Float | Rasio pemakaian terhadap target buffer: $\frac{\text{weekly\_consumption}}{\text{par\_level}}$. |
| | `wow_growth_rate` | Float | Pertumbuhan konsumsi Week-over-Week: $\frac{C_{\text{curr}} - C_{\text{prev}}}{C_{\text{prev}}}$ (1.0 jika baru ada konsumsi; 0.0 jika tidak ada perubahan). |
| | `prev_weekly_consumption` | Float | Akumulasi konsumsi pada minggu sebelumnya (hari ke-8 hingga ke-14). |
| **Pola Waktu Transaksi** | `weekend_share` | Float | Proporsi konsumsi hari Sabtu & Minggu (Indikator Tipe A: Ramai Akhir Pekan). |
| | `midweek_share` | Float | Proporsi konsumsi hari Rabu & Kamis (Indikator Tipe C: Lonjakan Tengah Minggu). |
| | `weekday_base_share` | Float | Proporsi konsumsi hari Senin, Selasa, dan Jumat. |
| | `daily_cv` | Float | Koefisien Variasi konsumsi harian ($\sigma / \mu$, Indikator Tipe B: Stabil Harian). |
| **Utilisasi & Kepatuhan** | `stock_utilization_ratio` | Float | Rasio sisa stok fisik terhadap buffer acuan: $\frac{\text{current\_qty}}{\text{par\_level}}$. |
| | `hours_since_last_report` | Float | Jeda waktu (jam) sejak laporan stok fisik terakhir dari pasangan item tersebut (sentinel `999.0` jika belum pernah). |
| | `item_profile_type` | String | Profil pola transaksi item (`Tipe A`, `Tipe B`, `Tipe C`, `Tipe Campuran`, atau `Inaktif`). |
| **Agregat Toko (Partner)** | `partner_total_stock` | Integer | Total sisa stok fisik seluruh produk di toko cabang. |
| | `partner_total_weekly_consumption` | Float | Total volume konsumsi mingguan seluruh produk di toko cabang. |
| | `partner_stock_utilization_ratio` | Float | Rasio utilisasi total stok toko terhadap total buffer par level. |
| | `partner_weekend_share` | Float | Proporsi transaksi akhir pekan toko secara menyeluruh. |
| | `partner_midweek_share` | Float | Proporsi transaksi tengah minggu toko secara menyeluruh. |
| | `partner_weekday_base_share` | Float | Proporsi transaksi hari dasar (Senin, Selasa, Jumat) toko secara menyeluruh. |
| | `partner_daily_cv` | Float | Koefisien variasi konsumsi harian di tingkat toko cabang. |
| | `partner_hours_since_last_report` | Float | Jeda waktu (jam) sejak laporan fisik terakhir toko cabang. |
| | `partner_profile_type` | String | Profil dominan toko cabang untuk clustering strategi distribusi (`Tipe A`, `Tipe B`, `Tipe C`, `Tipe Campuran`, `Inaktif`). |

---

## 3. Kamus Data Kontrak Handoff Produksi

Pipeline [weekly_analytics_aggregator.py](file:///C:/daisuki-inventory/data-science/src/weekly_analytics_aggregator.py) mengekspor artifak hasil analisis ke folder terisolasi berstempel waktu: `reports/runs/<run_id>/`. Artifak ini dikonsumsi oleh tim AI Engineer dan API backend.

### A. `manifest.json` (Audit Trail & Tata Kelola Privasi)
Berisi metadata proses eksekusi, versi model, audit jumlah data, dan instruksi penegakan privasi multi-tenant.
```json
{
  "run_id": "run_20261118_072745",
  "generated_at": "2026-11-18T07:27:45.123456Z",
  "source_dataset": "cleaned_inventory_summary.csv",
  "model_version": "v2.0-ds-weekly-aggregator",
  "total_partners_evaluated": 106,
  "total_products_evaluated": 4,
  "total_records": 424,
  "artifacts_generated": [
    {"file": "category_products.json", "records": 4, "audience": "admin_and_public"},
    {"file": "category_partners.json", "records": 106, "audience": "admin_only_sensitive"},
    {"file": "category_regions.json", "records": 28, "audience": "admin_and_production_planning"},
    {"file": "category_reporting.json", "records": 1, "audience": "admin_monitoring"},
    {"file": "risk_records.csv", "records": 424, "audience": "admin_only_sensitive"}
  ],
  "privacy_compliance": {
    "strict_tenant_isolation": true,
    "rag_chatbot_mitra_export_allowed": false,
    "privacy_notice": "risk_records.csv dan category_partners.json memuat identitas cabang dan penilaian risiko stok. Dilarang menyuntikkan dokumen ini ke basis pengetahuan RAG chatbot mitra untuk mencegah kebocoran informasi antar cabang."
  }
}
```

### B. `category_products.json` (Analisis 4 Produk Resmi)
Digunakan oleh Admin Pusat dan perencanaan pabrik untuk melihat perputaran produk secara makro.
* `product_name` (String): Nama resmi produk (Seblak Jadul Instan, Basreng Daun Jeruk, Makaroni Daun Jeruk, Keripik Pisang Rasa Coklat).
* `product_id` (UUID): ID produk di tabel database.
* `total_branches_carrying` (Integer): Jumlah cabang yang menyediakan produk ini.
* `total_weekly_consumption` (Float): Total unit terjual di seluruh cabang dalam 7 hari.
* `mean_adu` (Float): Rata-rata laju pemakaian harian per cabang.
* `total_branch_stock` (Integer): Total sisa stok fisik yang tersebar di rak-rak cabang.
* `critical_branches_count` (Integer): Jumlah cabang yang status stok produk ini kritis (< 2 hari).
* `high_risk_branches_count` (Integer): Cabang dengan tingkat risiko kehabisan stok tinggi.
* `total_suggested_restock_units` (Integer): Total kebutuhan pasokan baru yang direkomendasikan.
* `demand_trend` (String): `FAST_MOVING` atau `MODERATE_MOVING`.

### C. `category_partners.json` (Kesehatan Cabang — ADMIN ONLY / SENSITIF)
Digunakan untuk memonitor kesehatan operasional setiap cabang mitra dalam 1 kartu ringkas.
* `partner_id` (UUID): ID cabang mitra.
* `partner_name` (String): Nama cabang mitra.
* `data_source` (String): `primary_daisuki` atau `synthetic_seed`.
* `is_synthetic` (Boolean): Flag penanda data sintetis.
* `total_stock_on_shelf` (Integer): Akumulasi sisa stok seluruh produk di toko.
* `critical_products_count` (Integer): Jumlah produk yang berada pada batas kritis.
* `total_products_tracked` (Integer): Jumlah produk aktif yang dipantau (default 4).
* `weekly_consumption_sum` (Float): Total konsumsi seluruh produk cabang dalam 7 hari.
* `health_status` (String): `aman` (stok cukup), `waspada` (1 produk kritis), atau `kritis` ($\ge 2$ produk kritis / total stok $\le 20$ pcs).

### D. `category_regions.json` (Klaster Wilayah & Logistik)
Digunakan untuk merencanakan rute distribusi logistik dan mendeteksi hotspot konsumsi per kota.
* `region` (String): Nama kabupaten/kota atau klaster logistik (misal: "Jakarta Selatan", "Bandung", "Surabaya").
* `partner_count` (Integer): Jumlah mitra cabang di wilayah tersebut.
* `total_weekly_consumption` (Float): Volume konsumsi mingguan regional.
* `critical_items_count` (Integer): Jumlah item berstatus kritis di wilayah tersebut.
* `suggested_replenishment_units` (Integer): Total estimasi pasokan yang harus dikirim ke wilayah tersebut.
* `risk_density` (Float): Rasio item kritis per mitra di wilayah bersangkutan.

### E. `category_reporting.json` (Kepatuhan Laporan Stok Fisik)
Digunakan oleh Admin untuk memicu scheduler pengingat cabang yang pasif.
* `total_active_partners` (Integer): Jumlah seluruh mitra aktif terdaftar.
* `reporting_active_last_7d` (Integer): Mitra yang melakukan pembaruan stok dalam 7 hari terakhir.
* `stale_unreported_last_7d` (Integer): Mitra yang belum lapor (potensi *blind stock*).
* `compliance_rate_percent` (Float): Persentase kepatuhan mitra dalam menginput stok fisik.
* `threshold_stale_hours` (Integer): Nilai batas status *stale* (24 jam).

### F. `risk_records.csv` (Evaluasi Risiko Granular — ADMIN ONLY / SENSITIF)
File CSV yang memuat penilaian risiko per pasangan cabang-produk:
```text
partner_id, partner_name, product_id, product_name, current_qty, par_level,
weekly_consumption, adu, safety_stock, rop, days_of_cover, is_critical,
risk_level, suggested_restock_units, data_source, is_synthetic
```
* `risk_level` (Enum String):
  * `HIGH_STOCKOUT_RISK`: $\text{days\_of\_cover} < 2.0$ atau $\text{current\_qty} \le 10$ atau $\text{current\_qty} < \text{par\_level} \times 0.2$.
  * `MODERATE_RISK`: $\text{days\_of\_cover} \le 4.0$ atau $\text{current\_qty} < \text{par\_level} \times 0.5$.
  * `SAFE`: Stok aman untuk $\ge 5$ hari konsumsi.

### G. Skema Database PostgreSQL: `restock_recommendations`
Tabel target penyimpanan inferensi model Data Science / AI di Neon DB ([neon/init.sql](file:///C:/daisuki-inventory/neon/init.sql#L221-L232)):
```sql
create table if not exists restock_recommendations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  forecast_qty integer not null,
  suggested_qty integer not null,
  days_of_cover numeric(5, 1),
  model_version text not null,
  metadata jsonb,
  generated_at timestamptz not null default now(),
  constraint restock_recommendations_partner_product_key unique (partner_id, product_id)
);
```

---

## 4. Aturan Privasi & Keamanan Multi-Tenant (Tenant Isolation)

> [!CAUTION]
> **ATURAN PRIVASI MUTLAK: ISOLASI DATA ANTAR-CABANG MITRA**
> 1. File **`risk_records.csv`** dan **`category_partners.json`** adalah data rahasia operasional internal Admin Pusat Daisuki.
> 2. **DILARANG KERAS** memasukkan atau mengekspor `risk_records.csv` dan `category_partners.json` ke dalam basis pengetahuan (*knowledge base*) atau *vector database* RAG chatbot yang diakses oleh pengguna Mitra Cabang.
> 3. Pengguna mitra cabang hanya berhak melihat status inventaris miliknya sendiri. Penyuntikan data per-cabang ke chatbot mitra akan memicu kebocoran data kompetitif (*cross-tenant data breach*).
> 4. Asisten AI mitra hanya boleh mengakses endpoint API yang telah diamankan dengan filter `partner_id` dari token sesi JWT pengguna terotentikasi.

---

## 5. Metodologi Sumber Data & Pencegahan Data Leakage

### A. Pemisahan Data Primer vs Data Sintetis
1. **Data Primer Daisuki (`primary_daisuki`)**:
   * Merupakan data transaksi operasional riil dari toko mitra fisik Daisuki di lapangan (contoh: *kopken cijeruk*, akun terdaftar di aplikasi produksi).
   * Memiliki pola penurunan stok asli sesuai dinamika penjualan riil dan hari libur/akhir pekan.
2. **Data Sintetis Seeding (`synthetic_seed`)**:
   * Merupakan data simulasi yang dibuat oleh script [seed-mitra.ts](file:///C:/daisuki-inventory/apps/api/src/db/seed-mitra.ts) (100 cabang sintetis: kombinasi 25 brand fiktif $\times$ 4 kategori toko di 25 kota) serta 3 mitra demo [init.sql](file:///C:/daisuki-inventory/neon/init.sql).
   * **Keterbatasan Data Sintetis**: Data sintetis mengasumsikan pola konsumsi acak seragam, tidak memiliki efek musiman riil (*seasonality*), dan dibuat untuk kebutuhan pengujian beban antarmuka serta simulasi alokasi pasokan. Model yang dilatih khusus pada data sintetis tidak boleh dijadikan acuan final untuk belanja bahan baku pabrik tanpa kalibrasi data primer.

### B. Time-Based Train-Test Split (Anti Data Leakage)
* **Mengapa Random Train-Test Split Dilarang**:
  Dalam data inventaris berurutan waktu (*time-series*), penggunaan random split (*shuffle split*) atau k-fold biasa akan menyebabkan **data leakage temporal**. Model akan "melihat" konsumsi masa depan untuk memprediksi stok masa lalu, sehingga menghasilkan evaluasi akurasi semu yang tidak realistis saat diterapkan di dunia nyata.
* **Mekanisme Time-Based Split (80/20)**:
  * Seluruh baris log transaksi diurutkan secara strictly ascending berdasarkan `created_at`.
  * **Train Set (80% awal)**: Periode historis 19 Oktober 2026 s/d 09 November 2026 (76 log transaksi valid) disimpan ke [train_inventory_summary.csv](file:///C:/daisuki-inventory/data-science/data/train_inventory_summary.csv).
  * **Test Set (20% akhir)**: Periode evaluasi terbaru 09 November 2026 s/d 17 November 2026 (19 log transaksi valid) disimpan ke [test_inventory_summary.csv](file:///C:/daisuki-inventory/data-science/data/test_inventory_summary.csv).
  * Perhitungan metrik mingguan pada train set dihitung strictly relatif terhadap batas akhir periode train, sehingga tidak ada informasi dari periode test yang bocor ke dalam data pelatihan.

---

## 6. Catatan Domain Bisnis & Asumsi Operasional Daisuki

1. **Konsumsi Berasal dari Laporan Fisik (Bukan Mesin Kasir POS)**:
   * Daisuki tidak terintegrasi dengan software kasir POS mitra cabang.
   * Nilai konsumsi dihitung secara murni dari selisih penurunan stok fisik yang dilaporkan mitra di rak toko:
     $$\text{Konsumsi} = \text{qty\_before} - \text{qty\_after}$$
     hanya untuk transaksi bertipe `source = 'manual_update'` di mana $\text{qty\_before} \ge \text{qty\_after}$.
   * Kenaikan stok akibat penerimaan barang (`source = 'order_received'`) tidak dihitung sebagai penjualan konsumsi.
2. **Lead Time Produksi Pabrik & Pengiriman Cabang**:
   * **Lead time produksi pabrik Daisuki**: 5–7 hari kerja untuk memproduksi batch baru di gudang pusat.
   * **Lead time logistik/ekspedisi ke cabang**: Default $L = 6$ hari kerja.
   * Perhitungan *Safety Stock* dan *Reorder Point* mengacu pada lead time 6 hari untuk memastikan cabang tidak kehabisan stok saat barang dalam perjalanan ekspedisi.
3. **Prinsip Stok Cabang Tanpa Batas Atas (No Upper Ceiling)**:
   * Sesuai aturan bisnis Daisuki, tidak ada batas maksimal kapasitas rak cabang (tidak ada batasan kaku seperti 40 pcs). Nilai `par_level` adalah buffer minimal pengaman dan laju evaluasi pemakaian, bukan pembagi plafon kapasitas.
4. **Siklus Reservasi & Approval Restock**:
   * Stok gudang pusat (`products.central_stock`) direservasi otomatis sebesar `qty_requested` saat Mitra mengajukan PO restok.
   * Stok fisik cabang hanya bertambah saat pesanan tiba dan dikonfirmasi penerimaannya oleh Mitra (`selesai`), bertambah sebesar `qty_approved` (bukan `qty_requested`).
