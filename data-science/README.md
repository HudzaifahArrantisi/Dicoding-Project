# 📦 Data Science — Daisuki B2B Inventory & Order Management System

Workspace ini memuat seluruh pipeline analitik, rekayasa fitur (*feature engineering*), pemodelan prediktif risiko kehabisan stok (*stockout*), segmentasi profil mitra (*partner clustering*), serta kontrak handoff produksi ke dashboard Admin dan AI Assistant.

---

## 1. Konteks Bisnis & Masalah yang Diselesaikan

Daisuki memproduksi dan mendistribusikan 4 produk resmi:
1. **Seblak Jadul Instan**
2. **Basreng Daun Jeruk**
3. **Makaroni Daun Jeruk**
4. **Keripik Pisang Rasa Coklat**

### Tantangan Rantai Pasok Utama:
1. **Lead Time Pabrik 5–7 Hari:** Pengiriman dan siklus produksi pabrik membutuhkan waktu 5–7 hari kalender. Cabang yang kehabisan stok (*stockout*) akan mengalami rak kosong selama hampir sepekan jika tidak memesan tepat waktu.
2. **Stok Cabang Tanpa Batas Atas:** Tidak ada kapasitas plafon buatan (seperti 40 pcs) pada cabang mitra. Analisis risiko dan buffer stok acuan bersifat dinamis mengacu pada laju konsumsi riil (*Average Daily Usage* / ADU).
3. **Kebutuhan Pengiriman Terjadwal:** Armada logistik pabrik membutuhkan jadwal pengiriman teratur yang disesuaikan dengan pola hari lonjakan masing-masing cabang (akhir pekan, tengah minggu, atau harian stabil).

---

## 2. Struktur Direktori Workspace

```text
data-science/
├── notebooks/                     # Jupyter Notebooks untuk Eksperimen & Laporan Rubrik
│   ├── 01_eda_and_baseline.ipynb          # EDA & Pemodelan Baseline Permintaan
│   ├── 02_stockout_risk_modeling.ipynb    # Modeling Risiko Stockout & Regresi Sisa Hari
│   └── 03_partner_clustering.ipynb        # Segmentasi Mitra Tipe A/B/C & Evaluasi K-Means
├── src/                           # Modul Produksi Python yang Reusable
│   ├── clean_logs.py                      # Pembersihan Log & Time-Based Split (80/20)
│   ├── feature_engineering.py             # Rekayasa Fitur Kecepatan & Pola Hari
│   ├── stockout_model.py                  # Model Klasifikasi Risiko & Proyeksi Sisa Hari
│   ├── partner_clustering.py              # Clustering Mitra & Rekomendasi Pengiriman
│   ├── weekly_analytics_aggregator.py     # Agregator Handoff Produksi Mingguan
│   └── inventory_model.py                 # Helper Model Stok & Buffer
├── data/                          # Dataset Mentah & Olahan (Git Ignored)
│   ├── raw_stock_logs.csv                 # Log mentah mutasi stok fisik
│   ├── cleaned_inventory_summary.csv      # Ringkasan inventaris bersih (424 baris)
│   ├── train_inventory_summary.csv        # Train set (80% periode historis awal)
│   ├── test_inventory_summary.csv         # Test set (20% periode terbaru)
│   ├── featured_partner_metrics.csv       # Dataset kaya dengan 30 fitur rekayasa
│   ├── stockout_risk_predictions.csv      # Prediksi risiko & hari sisa pada Test Set
│   └── partner_clusters.csv               # Hasil segmentasi 106 cabang mitra
├── models/                        # Artefak Model Terlatih (Git Ignored)
│   ├── stockout_model.joblib              # Pipeline Random Forest Classifier & Regressor
│   └── partner_clustering.joblib          # Pipeline K-Means & StandardScaler Mitra
├── reports/                       # Laporan Evaluasi JSON & Run Mingguan (Git Ignored)
│   ├── stockout_model_evaluation.json     # Metrik komparasi Test Set (F1, MAE, WAPE)
│   ├── partner_clustering_evaluation.json # Evaluasi Elbow & Silhouette Score
│   └── runs/<run_id>/                     # Artefak Handoff Mingguan ke Tim AI
├── requirements.txt               # Dependensi Python terpusat
├── DATA_DICTIONARY.md             # Kamus data lengkap seluruh fitur & kontrak handoff
└── README.md                      # Panduan utama eksekusi & arsitektur (dokumen ini)
```

---

## 3. Setup Lingkungan Pengembangan

Gunakan virtual environment Python lokal di folder `data-science/`:

```powershell
# 1. Pindah ke direktori data-science
cd data-science

# 2. Buat virtual environment
python -m venv .venv

# 3. Aktivasi virtual environment (Windows PowerShell)
.venv\Scripts\Activate.ps1

# 4. Pasang dependensi
pip install -r requirements.txt

# 5. Siapkan konfigurasi environment (opsional untuk koneksi database)
Copy-Item .env.example .env
```

> **Catatan Eksekusi PowerShell:**  
> Jika script aktivasi diblokir, jalankan:  
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

---

## 4. Panduan Menjalankan Seluruh Pipeline Data Science (Berurutan)

Jalankan seluruh modul secara berurutan dari root repositori menggunakan virtual environment:

### Langkah 1: Pembersihan Log & Time-Based Split
```powershell
data-science\.venv\Scripts\python.exe data-science\src\clean_logs.py
```
- **Fungsi:** Membersihkan log transaksi, mendeteksi sumber data (`primary_daisuki` vs `synthetic_seed`), menghitung `adu`, `safety_stock`, `rop`, dan `days_of_cover`.
- **Pencegahan Leakage:** Membagi data secara time-based (80% periode historis awal untuk train, 20% periode akhir untuk test).
- **Output:** `cleaned_inventory_summary.csv`, `train_inventory_summary.csv`, `test_inventory_summary.csv`.

### Langkah 2: Rekayasa Fitur (*Feature Engineering*)
```powershell
data-science\.venv\Scripts\python.exe data-science\src\feature_engineering.py
```
- **Fungsi:** Menghitung kecepatan penyerapan stok (`absorption_rate`), pertumbuhan konsumsi mingguan (`wow_growth_rate`), proporsi hari transaksi (`weekend_share`, `midweek_share`, `weekday_base_share`), volatilitas harian (`daily_cv`), serta utilisasi stok cabang (`stock_utilization_ratio`).
- **Output:** `data-science/data/featured_partner_metrics.csv` (30 fitur per pasangan produk-mitra dan tingkat cabang).

### Langkah 3: Modeling Analitik Risiko Stockout & Proyeksi Sisa Hari
```powershell
data-science\.venv\Scripts\python.exe data-science\src\stockout_model.py
```
- **Fungsi:**
  - Melatih dan membandingkan 3 pendekatan klasifikasi risiko: *(a) Rule-Based Heuristic Baseline*, *(b) Gaussian Naive Bayes*, dan *(c) Random Forest Classifier (Balanced)* pada Test Set tanpa *target leakage*.
  - Melatih Random Forest Regressor untuk memproyeksikan sisa hari menuju kehabisan stok (`predicted_days_to_stockout`) dengan evaluasi MAE & WAPE.
  - Memasang flag otomatis deteksi pelanggaran batas lead time pabrik 5–7 hari (`urgency_lead_time_breached`).
- **Output:**
  - `data-science/models/stockout_model.joblib`
  - `data-science/reports/stockout_model_evaluation.json`
  - `data-science/data/stockout_risk_predictions.csv`

### Langkah 4: Segmentasi & Clustering Mitra (Tipe A/B/C)
```powershell
data-science\.venv\Scripts\python.exe data-science\src\partner_clustering.py
```
- **Fungsi:**
  - Memisahkan cabang aktif ber-riwayat dari cabang inaktif/baru (0 konsumsi).
  - Melakukan penskalaan `StandardScaler` dan pengujian K-Means ($k=2, 3, 4$) dengan evaluasi Elbow Method dan Silhouette Score.
  - Memetakan 106 cabang ke dalam 4 segmen operasional (Tipe A, Tipe B, Tipe C, Inaktif) lengkap dengan rekomendasi jadwal pengiriman armada logistik.
- **Output:**
  - `data-science/models/partner_clustering.joblib`
  - `data-science/reports/partner_clustering_evaluation.json`
  - `data-science/data/partner_clusters.csv`

### Langkah 5 (Rutin Mingguan): Handoff Agregasi ke Dashboard & AI
```powershell
data-science\.venv\Scripts\python.exe data-science\src\weekly_analytics_aggregator.py
```
- **Fungsi:** Membentuk folder bertanggal `data-science/reports/runs/<run_id>/` berisi ringkasan performa 4 produk, kesehatan cabang, analisis wilayah, kepatuhan laporan, dan manifest SHA-256 untuk dikonsumsi oleh dashboard Admin dan asisten AI.

---

## 5. Dokumentasi 3 Jupyter Notebooks

| Notebook | Fokus & Tujuan Analisis | Visualisasi & Temuan Kunci |
|---|---|---|
| [01_eda_and_baseline.ipynb](file:///C:/daisuki-inventory/data-science/notebooks/01_eda_and_baseline.ipynb) | **EDA & Baseline Forecasting**<br>Membedah distribusi konsumsi 4 produk resmi dan membandingkan baseline moving average. | - Histogram sebaran konsumsi per kategori produk.<br>- Simulasi buffer dinamis (*Safety Stock & ROP*) terhadap lead time 5–7 hari.<br>- Analisis kepatuhan pelaporan fisik harian cabang. |
| [02_stockout_risk_modeling.ipynb](file:///C:/daisuki-inventory/data-science/notebooks/02_stockout_risk_modeling.ipynb) | **Modeling Analitik Risiko Stockout**<br>Membandingkan 3 model klasifikasi risiko (*Aman*, *Waspada*, *Kritis*) dan regresi sisa hari. | - Perbandingan performa pada Test Set (Accuracy, F1, Recall Kritis).<br>- Visualisasi Confusion Matrix 3 model.<br>- *Feature Importance* (Top: `stock_utilization_ratio` 51.26%, `current_qty` 41.90%).<br>- *Ablation Study* dampak feature engineering.<br>- Scatter plot aktual vs prediksi dengan garis ambang lead time pabrik 7 hari. |
| [03_partner_clustering.ipynb](file:///C:/daisuki-inventory/data-science/notebooks/03_partner_clustering.ipynb) | **Customer/Partner Segmentation**<br>Pengelompokan 106 cabang mitra berbasis pola hari konsumsi dan volume. | - Grafik komparasi *Elbow Method* (Inertia) dan *Silhouette Score* ($k=2,3,4$).<br>- Proyeksi spasial 2D PCA cabang aktif.<br>- *Bar chart* komparasi rata-rata centroid fitur per segmen.<br>- Matriks tabel rekomendasi jadwal logistik dan strategi penyesuaian buffer. |

---

## 6. Arsitektur Keamanan Database (`ds_readonly`) & Fallback Offline

1. **Prinsip Hak Akses Terkecil (*Least Privilege*):**
   - Koneksi database wajib menggunakan role PostgreSQL khusus `ds_readonly`.
   - Script menegakkan transaksi mode baca saja (`conn.read_only = True; SET ROLE ds_readonly;`).
   - Role `ds_readonly` hanya diberikan izin `GRANT SELECT` pada tabel terkait inventaris (`stock_logs`, `partner_stocks`, `partners`, `products`).
   - Dilarang keras melakukan perintah mutasi (`INSERT`, `UPDATE`, `DELETE`, `ALTER`) dari workspace ini.
2. **Seamless Offline Fallback:**
   - Jika koneksi database Neon DB offline atau `DATABASE_URL` tidak dikonfigurasi, pipeline secara otomatis dan mulus beralih membaca file CSV lokal di `data-science/data/` (`raw_stock_logs.csv` dan `cleaned_inventory_summary.csv`).
   - Proses analisis, pelatihan model, dan eksekusi notebook tetap dapat berjalan 100% tanpa hambatan.

---

## 7. Ringkasan Hasil Evaluasi Model & Keterbatasan Domain

### A. Ringkasan Metrik Evaluasi

| Model / Analisis | Algoritma Terpilih | Metrik Utama pada Test Set | Interpretasi Bisnis |
|---|---|:---:|---|
| **Klasifikasi Risiko Stockout** | **Random Forest Classifier (Balanced)** | **Akurasi 99.53%**<br>**Macro F1 0.9944**<br>**Recall Kritis 100.00%** | **Zero False Negative pada kelas Kritis.** Tidak ada cabang berisiko kehabisan stok yang luput dari pantauan Admin Pusat. |
| **Proyeksi Sisa Hari Habis** | **Random Forest Regressor** | **MAE 0.1252 hari (~3 jam)**<br>**WAPE 0.22%** | Estimasi hari menuju kehabisan barang sangat presisi, memicu peringatan dini jika $\le 7$ hari kerja. |
| **Segmentasi Profil Mitra** | **K-Means Clustering ($k=4$)** | **Silhouette Score 0.4339**<br>**Inertia 16.51** | Memisahkan cabang ke dalam 4 persona operasional: Tipe A (1 cabang), Tipe B (8 cabang), Tipe C (2 cabang), dan Inaktif (95 cabang). |

### B. Matriks Segmen Operasional & Jadwal Pengiriman Mitra

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ SEGMEN OPERASIONAL MITRA DAISUKI                                                            │
├────────────────────────────────┬─────────┬────────────────────────────┬──────────────────────┤
│ Segmen Profil                  │ Cabang  │ Pola Hari Utama            │ Jadwal Rekomendasi   │
├────────────────────────────────┼─────────┼────────────────────────────┼──────────────────────┤
│ Tipe A: Ramai Akhir Pekan      │ 1 (1%)  │ Sabtu & Minggu (Weekend)   │ Kamis Sore / Jumat   │
│ Tipe B: Stabil Harian Reguler  │ 8 (8%)  │ Senin - Jumat (Weekday)    │ Senin & Kamis Pagi   │
│ Tipe C: Lonjakan Tengah Minggu │ 2 (2%)  │ Rabu & Kamis (Midweek)     │ Senin Sore / Selasa  │
│ Mitra Baru / Inaktif           │ 95 (89%)│ Belum Ada Log Konsumsi     │ On-Demand / Starter  │
└────────────────────────────────┴─────────┴────────────────────────────┴──────────────────────┘
```

### C. Keterbatasan Model & Catatan Data Sintetis (Rubrik Dicoding)
1. **Dominasi Data Sintetis:** Sebagian besar riwayat cabang berasal dari data seeding (`synthetic_seed`). Pola konsumsinya cenderung mengikuti distribusi normal reguler sehingga nilai F1-score model sangat tinggi (~0.99).
2. **Data Primer Riil (*Kopken Cijeruk*):** *Kopken Cijeruk* adalah satu-satunya mitra primer riil (`primary_daisuki`) dengan 100 log transaksi dinamis. Polanya memperlihatkan kombinasi konsumsi hari kerja yang tinggi dengan lonjakan tambahan di akhir pekan.
3. **Sumber Konsumsi Berbasis Laporan Fisik:** Angka pemakaian barang diturunkan dari selisih penurunan laporan stok fisik mingguan (`manual_update`), bukan dari mesin kasir (POS) per transaksi real-time.
4. **Rekomendasi Continuous Retraining:** Pipeline model dan clustering perlu dijalankan ulang (*re-train* dan *re-cluster*) secara otomatis tiap minggu di server produksi seiring bertambahnya data primer dari mitra cabang baru.

---

## 8. Fungsi Reusable untuk Integrasi Produksi & AI

Modul di `data-science/src/` menyediakan fungsi inferensi yang siap di-import oleh modul backend maupun agent AI:

```python
import sys
sys.path.insert(0, "data-science/src")

# 1. Inferensi Prediksi Risiko Stockout
from stockout_model import predict_stockout_risk
risk_results = predict_stockout_risk(partner_product_items)
# Mengembalikan: predicted_risk_level, predicted_days_to_stockout, urgency_lead_time_breached

# 2. Inferensi Segmentasi Klaster Mitra
from partner_clustering import predict_partner_cluster
segment_results = predict_partner_cluster(partner_items)
# Mengembalikan: cluster_code, segment_name, recommended_schedule, actionable_strategy
```
