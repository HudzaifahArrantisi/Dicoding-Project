# Data Science — Daisuki Inventory

## 1. Tujuan
Data Science mengekstrak log PostgreSQL secara baca saja, menghitung metrik operasional, dan menyerahkan artefak bertanggal kepada AI. Inferensi Naive Bayes dan penulisan rekomendasi tetap dikerjakan di `ai/`.

## 2. Pemilik
Tim Data Science.

## 3. Struktur Folder

| Folder | Keterangan |
|---|---|
| `notebooks/` | EDA (*Exploratory Data Analysis*) dan eksperimen model |
| `src/` | Modul kode Python yang dapat digunakan kembali (*reusable*) |
| `data/` | Data mentah dan olahan (tidak masuk git) |
| `models/` | File penyimpanan model hasil pelatihan (tidak masuk git) |
| `reports/` | `weekly_analytics_summary.json`, `cleaned_inventory_summary.csv`, dan `weekly_analytics_report.md` (lokal, tidak masuk Git) |

## 4. Setup (PowerShell)

Jalankan perintah berikut di PowerShell untuk menyiapkan lingkungan kerja:

```powershell
cd data-science
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

> **Catatan:** Jika eksekusi `Activate.ps1` diblokir oleh PowerShell, jalankan perintah berikut sekali di terminal:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```

## 5. Akses Database
- Koneksi hanya menggunakan role PostgreSQL `ds_readonly` (read-only).
- **Dilarang keras** menggunakan akun utama (*postgres admin / owner*) langsung di lingkungan analisis tanpa pembatasan hak akses.
- Kredensial password `ds_readonly` didapatkan langsung dari tim Fullstack backend melalui jalur aman.

## 6. Output yang Diharapkan
- Notebook EDA yang mendokumentasikan pola konsumsi produk dan perilaku mitra.
- *Baseline forecast* (misal: *moving average*, *seasonal naive*) dengan metrik evaluasi WAPE atau MAPE.
- Rekomendasi par level dan *safety stock* dinamis dengan memperhitungkan *lead time* produksi pabrik 5 sampai 7 hari.
- Hasil prediksi yang sesuai dengan kontrak skema tabel `restock_recommendations`.
- Dokumen metodologi dan laporan hasil evaluasi di folder `reports/`.

## 7. Agregasi Mingguan

Jalankan dari root repositori memakai Python yang sudah memasang `data-science/requirements.txt`:

```powershell
python data-science/src/weekly_analytics_aggregator.py
python data-science/src/weekly_analytics_aggregator.py --start-date 2026-11-02 --end-date 2026-11-08
```

Tanpa argumen, periode adalah tujuh hari kalender terakhir termasuk hari ini menurut zona Asia/Jakarta. `--end-date` inklusif. Skrip membaca `DATABASE_URL` dari environment, `data-science/.env`, `ai/.env`, atau `apps/api/.env`, lalu mengunci transaksi PostgreSQL sebagai **read-only**. Gunakan kredensial `ds_readonly` di lingkungan Data Science.

JSON memuat lima kategori: produk, mitra, wilayah, disiplin laporan, dan stok pusat/proyeksi pabrik. `risk_records` di dalam JSON serta CSV memuat data per mitra-produk dan bersifat **privat**; jangan publikasikan atau kirim langsung ke chatbot mitra. Laporan Markdown adalah ringkasan internal. Ketiga file harus berasal dari satu eksekusi sebelum job AI dijalankan.

## 8. Pipeline CSV Ekspor Manual (Eksperimen)

Simpan ekspor admin sebagai `data/raw_stock_logs.csv`, lalu jalankan dari root repo:

```powershell
python data-science/src/clean_logs.py
```

Script menulis `data/cleaned_inventory_summary.csv`. Untuk mendapatkan `current_qty` dan `par_level` aktual, isi `DATABASE_URL` pada `data-science/.env` dengan akun `ds_readonly`; tanpa koneksi, script membuat ringkasan berdasarkan log CSV dan memakai stok tertinggi yang tercatat sebagai perkiraan par level.

Output eksperimen ini tidak menjadi input tombol **Perbarui analisis**. Handoff produksi memakai `weekly_analytics_aggregator.py` dan file di `data-science/reports/`. Ringkasan analisis tanpa identitas cabang disimpan terpisah; CSV cabang tidak dipublikasikan ke chatbot mitra.

## 9. Aturan
- Jangan pernah meng-commit data mentah klien ke repositori git.
- Jangan meng-commit file model berukuran besar (`.pkl`, `.joblib`, `.pt`, dsb.).
- Jangan meng-commit file `.env`.

## 10. Serah Terima Mingguan ke AI Engineer

Tim Data Science menyiapkan **satu periode laporan yang sama** untuk ketiga artefak. Contoh berikut mencakup 2 sampai 8 November 2026, termasuk kedua tanggal:

```powershell
# Jalankan dari root repositori dengan Python yang memiliki dependensi Data Science.
python data-science/src/weekly_analytics_aggregator.py --start-date 2026-11-02 --end-date 2026-11-08
```

| Artefak | Isi dan pemakai |
|---|---|
| `reports/weekly_analytics_summary.json` | Lima kategori analisis, deret konsumsi harian, dan `risk_records` per mitra-produk. Dibaca job Naive Bayes dan sintesis fakta AI. |
| `reports/cleaned_inventory_summary.csv` | Sampel stok dan konsumsi per mitra-produk. Dibaca job alokasi dan training `daisuki.pkl`. |
| `reports/weekly_analytics_report.md` | Ringkasan manusia untuk ditinjau sebelum AI Engineer memproses laporan. |

Sebelum serah terima, periksa `metadata.start_date`, `metadata.end_date`, keempat nama produk resmi, dan kesesuaian total konsumsi JSON dengan CSV. Laporan dapat memuat identitas serta data cabang; ketiganya tetap lokal dan diabaikan Git. AI Engineer menjalankan job dari laporan yang sudah ditinjau sesuai [panduan AI](../ai/README.md#11-alur-mingguan-data-science-ke-ai-dan-chatbot).

Saat ini **belum ada tombol atau role aplikasi khusus Data Science** dan belum ada penjadwalan mingguan otomatis. Tombol Admin menjalankan agregator ini sendiri dengan periode bawaan tujuh hari kalender terakhir, kemudian langsung menjalankan seluruh tahap AI. Jika tim membutuhkan rentang tanggal tertentu, gunakan CLI di atas sebelum menjalankan tahap AI secara manual.
