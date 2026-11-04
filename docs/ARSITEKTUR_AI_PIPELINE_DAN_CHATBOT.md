# Arsitektur Pipeline AI Terpadu: Weekly Insights, JSON Facts, Retraining Model daisuki.pkl, & Chatbot NLP/ML Mitra Berbasis Data Riil

Dokumen ini adalah spesifikasi arsitektur teknis lengkap untuk siklus kecerdasan buatan (AI) terintegrasi pada **Daisuki B2B Inventory & Order Management System**.

---

## 1. Ikhtisar & Siklus End-to-End

Sistem menghubungkan aktivitas operasional harian, analisis mingguan Admin, penyimpanan fakta operasional terstruktur, pembaruan "otak" model Scikit-Learn, hingga interaksi Chatbot Mitra berbasis data riil:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. DATA OPERASIONAL HARIAN MITRA & ADMIN                                   │
│    - Laporan stok fisik harian mitra (stock_logs: source='manual_update')    │
│    - Pesanan restock & verifikasi barang sampai (orders & order_items)      │
│    - Pembaruan manual stok gudang pusat Daisuki oleh Admin (products)       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼ [Admin menekan "Perbarui Saran / Analisis"]
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. PIPELINE ANALISIS MINGGUAN (apps/api/src/lib/weekly-pipeline.ts)         │
│    1. data-science/src/weekly_demand.py                                     │
│    2. ai/jobs/weekly_restock_predictor.py                                   │
│    3. ai/jobs/market_hotspot_analytics.py                                   │
│    4. ai/jobs/regional_stockout_naive_bayes.py                              │
│    5. ai/jobs/weekly_facts_aggregator.py                                    │
│       └── Menghasilkan: ai/data/weekly_operational_facts.json               │
│    6. ai/retraining/train.py                                                │
│       └── Melatih ulang otak model: ai/retraining/daisuki.pkl               │
└──────────────────┬──────────────────────────────────────┬───────────────────┘
                   │                                      │
                   ▼                                      ▼
┌──────────────────────────────────────┐  ┌───────────────────────────────────┐
│ 3. TAB ADMIN AI INSIGHTS             │  │ 4. CHATBOT ASISTEN MITRA NLP/ML   │
│    - Ringkasan KPI Mingguan          │  │    (Grounded on Real Trained Data)│
│    - Tabel Mitra Terlaris (Top Sales)│  │    - Menjawab sapaan layaknya LLM │
│    - Kategori & Produk Paling Laku   │  │    - Menjawab panduan + Tour      │
│    - Peta & Wilayah Defisit / Rawan  │  │    - Menjawab angka stok riil     │
│    - Badge Status Retraining Model   │  │    - Menolak pertanyaan di luar   │
│    - Total Stok Gudang Pusat         │  │      lingkup secara sopan         │
└──────────────────────────────────────┘  └───────────────────────────────────┘
```

---

## 2. Struktur File JSON Fakta Operasional Terpadu (`ai/data/weekly_operational_facts.json`)

File agregasi fakta ini menjadi **Single Source of Truth** mingguan untuk tampilan dashboard Admin dan dasar pengetahuan faktual model NLP Chatbot Mitra:

```json
{
  "metadata": {
    "generated_at": "2026-11-04T10:00:00Z",
    "period_days": 7,
    "model_version": "daisuki-nb-2.1"
  },
  "central_warehouse": {
    "total_stock_units": 15420,
    "products": [
      { "id": "uuid-1", "name": "Basreng Pedas Daun Jeruk", "sku": "BSR-01", "central_stock": 5200, "category": "Snack Gurih" },
      { "id": "uuid-2", "name": "Keripik Kaca Original", "sku": "KPK-01", "central_stock": 4800, "category": "Snack Gurih" },
      { "id": "uuid-3", "name": "Seblak Instan Kencur", "sku": "SBL-01", "central_stock": 5420, "category": "Instant Food" }
    ]
  },
  "network_sales": {
    "total_sold_7d": 1250,
    "total_sold_prev_7d": 1092,
    "sales_growth_percentage": 14.5,
    "restock_fulfillment_rate": 96.2,
    "central_stock_health_days": 86
  },
  "top_performers_partners": [
    { "rank": 1, "partner_name": "Toko Barokah Cicaheum", "region": "Kota Bandung", "weekly_units": 380, "percentage": 30.4 },
    { "rank": 2, "partner_name": "Minimarket Sukajadi Jaya", "region": "Kota Bandung", "weekly_units": 240, "percentage": 19.2 },
    { "rank": 3, "partner_name": "Cafe Cozy Dago", "region": "Kota Bandung", "weekly_units": 190, "percentage": 15.2 }
  ],
  "top_selling_products": [
    { "rank": 1, "product_name": "Basreng Pedas Daun Jeruk", "category": "Snack Gurih", "weekly_units": 540, "share_pct": 43.2 },
    { "rank": 2, "product_name": "Seblak Instan Kencur", "category": "Instant Food", "weekly_units": 410, "share_pct": 32.8 },
    { "rank": 3, "product_name": "Keripik Kaca Original", "category": "Snack Gurih", "weekly_units": 300, "share_pct": 24.0 }
  ],
  "regional_hotspots": [
    { "region": "Kota Bandung", "status": "ZONA_HIJAU", "active_partners": 8, "deficit_units": 0, "urgency": "NORMAL" },
    { "region": "Kabupaten Sumedang", "status": "ZONA_KUNING", "active_partners": 3, "deficit_units": 85, "urgency": "WASPADA" },
    { "region": "Kabupaten Garut", "status": "ZONA_MERAH", "active_partners": 2, "deficit_units": 150, "urgency": "DARURAT" }
  ]
}
```

---

## 3. Retraining Pipeline `@ai/retraining/daisuki.pkl`

Model NLP memanfaatkan Scikit-Learn `Pipeline`:
```python
Pipeline([
    ("vectorizer", CountVectorizer(ngram_range=(1, 2), lowercase=True, strip_accents="unicode")),
    ("classifier", MultinomialNB(alpha=1.0))
])
```

### Klasifikasi Multi-Intent yang Dilatihkan ke `daisuki.pkl`:

1. **`greeting`**:
   - Sampel: *"halo"*, *"hai daisuki"*, *"selamat pagi kak"*, *"assalamualaikum"*, *"hi admin"*
   - Perilaku: Menjawab sapaan secara ramah dan natural layaknya LLM serta menyapa toko mitra.
2. **`central_stock`**:
   - Sampel: *"berapa total stok gudang daisuki saat ini"*, *"stok gudang pusat berapa"*, *"cek ketersediaan barang di pusat"*
   - Perilaku: Mengambil angka riil dari `central_warehouse.total_stock_units` dan per rincian produk pada `weekly_operational_facts.json`.
3. **`top_products`**:
   - Sampel: *"produk apa yang paling laku pekan ini"*, *"makanan terlaris di daisuki"*, *"kategori produk paling laris"*
   - Perilaku: Mengambil data riil urutan produk terlaris (`top_selling_products`) dari fakta mingguan terbaru.
4. **`top_partners`**:
   - Sampel: *"siapa mitra paling laku"*, *"cabang mana penjualan tertinggi"*, *"toko paling aktif"*
   - Perilaku: Menyajikan nama cabang mitra dan volume unit konsumsinya (`top_performers_partners`).
5. **`top_regions`**:
   - Sampel: *"daerah mana paling aktif"*, *"wilayah penjualan tertinggi"*, *"kota mana yang paling ramai"*
   - Perilaku: Menyajikan wilayah paling aktif dan perbandingan distribusi (`regional_hotspots`).
6. **`restock`**:
   - Sampel: *"bagaimana cara restock barang"*, *"mau ajukan pesanan baru"*, *"alur minta stok ke pusat"*
   - Perilaku: Memberikan panduan restock (bebas tanpa batas maksimal 40 pcs) + tombol **`[ 🚀 Mulai Panduan Restock ]`**.
7. **`stock_report`**:
   - Sampel: *"bagaimana cara lapor stok harian"*, *"cara update stok toko saat tutup"*, *"laporan fisik"*
   - Perilaku: Memberikan panduan laporan fisik toko harian + tombol **`[ 🚀 Mulai Panduan Laporan Stok ]`**.
8. **`delivery`**:
   - Sampel: *"cara konfirmasi barang sampai"*, *"scan resi kardus"*, *"verifikasi barcode kurir"*
   - Perilaku: Menjelaskan verifikasi fisik paket tiba + tombol **`[ 🚀 Mulai Panduan Scan Resi ]`**.
9. **`logs`**:
   - Sampel: *"cara cek log mutasi"*, *"melihat riwayat persetujuan pesanan"*, *"catatan admin"*
   - Perilaku: Menjelaskan filter tab riwayat & log + tombol **`[ 🚀 Mulai Panduan Riwayat ]`**.
10. **`profile`**:
    - Sampel: *"cara melengkapi profil cabang"*, *"ubah penanggung jawab dan nomor telepon"*
    - Perilaku: Menjelaskan kelengkapan data wilayah pengiriman + tombol **`[ 🚀 Mulai Panduan Profil ]`**.
11. **`out_of_scope`**:
    - Sampel: *"buatkan resep seblak"*, *"siapa presiden indonesia"*, *"buatkan kode program python"*, *"prediksi cuaca"*
    - Perilaku: Menolak dengan sopan karena sistem khusus didedikasikan untuk ekosistem inventaris Daisuki B2B.

---

## 4. Tampilan Visual Tab Admin AI Insights

Di tab Admin AI Insights (`apps/web/src/routes/admin.tsx`), hasil analisis mingguan terbaru ditampilkan secara terstruktur:

1. **Header & Status Model Training**:
   - Tombol **"Perbarui Saran / Analisis"** dengan animasi spinner saat komputasi berlangsung di server.
   - Badge status: *"Model daisuki.pkl: Terlatih & Sinkron (Waktu: [Tanggal-Jam])"*.
2. **Kartu Metrik KPI 7 Hari**:
   - Total Barang Terjual (`weekly_sales_units`) + tren pertumbuhan terhadap 7 hari sebelumnya.
   - Tingkat Pemenuhan Permintaan Restock (`restock_fulfillment_rate` %).
   - Daya Tahan Stok Pusat (`central_stock_health_days` hari).
3. **Komponen Visualisasi Data**:
   - **Tabel & Diagram Mitra Terlaris**: Bar chart / ranked list 5 mitra dengan konsumsi terbesar.
   - **Tabel Kategori & Produk Paling Laku**: Badge kategori, jumlah unit konsumsi, dan pangsa pasar.
   - **Peta & Analisis Risiko Wilayah**: Segmentasi Zona Merah, Kuning, dan Hijau beserta rekomendasi tindakan alokasi pasokan.

---

## 5. Integrasi Chatbot Mitra Berbasis Data Riil

### Perbedaan Chatbot Daisuki vs Chatbot Konvensional:
| Aspek | Chatbot Statis / Dummy | Chatbot Daisuki Terintegrasi |
|---|---|---|
| **Data Stok Gudang** | Menjawab angka tebakan / template statis | Membaca data riil snapshot mingguan terbaru (misal: 15.420 pcs) |
| **Produk Terlaris** | Menjawab asumsi umum | Membaca urutan real konsumsi 7 hari terakhir dari seluruh cabang |
| **Respon Sapaan** | Kaku dan terbatas | Luwes dan komunikatif layaknya LLM modern |
| **Batas Stok Toko** | Keliru membatasi 40 pcs / rasio par | Patuh aturan bisnis: Stok toko bebas tanpa batas maksimum |
| **Interaktivitas UI** | Hanya teks statis | Terhubung dengan Spotlight Product Tour Controller di layar mitra |

---

## 6. Rencana Implementasi & Eksekusi

1. **Pembuatan Skrip Agregator Fakta**:
   - Buat `ai/jobs/weekly_facts_aggregator.py` untuk mengompilasi data ke `ai/data/weekly_operational_facts.json`.
2. **Pembaruan Pipeline Mingguan**:
   - Tambahkan job aggregator dan `ai/retraining/train.py` ke dalam `apps/api/src/lib/weekly-pipeline.ts`.
3. **Penyempurnaan Worker Inferensi & Training Corpus**:
   - Perluas `ai/retraining/source.py`, `train.py`, dan `inference_worker.py` untuk mendukung klasifikasi intent NLP serta injeksi data fakta riil.
4. **Penyempurnaan Endpoint Chatbot Mitra**:
   - Hubungkan `apps/api/src/modules/assistant/` dengan loader fakta `weekly_operational_facts.json` dan hasil inferensi model.
5. **Verifikasi Antarmuka & Jalur E2E**:
   - Jalankan typecheck, pengujian prompt fakta pada chatbot, dan pastikan visualisasi dashboard Admin AI Insights memuat data dengan sempurna.
