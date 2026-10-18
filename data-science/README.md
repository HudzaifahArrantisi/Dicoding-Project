# Data Science — Daisuki Inventory

## 1. Tujuan
Lapisan prediksi untuk sistem inventaris Daisuki:
- Forecast permintaan produk.
- Rekomendasi par level dan safety stock.
- Prediksi risiko stok habis (*stockout*).
- Deteksi anomali pergerakan stok.

## 2. Pemilik
Tim Data Science.

## 3. Struktur Folder

| Folder | Keterangan |
|---|---|
| `notebooks/` | EDA (*Exploratory Data Analysis*) dan eksperimen model |
| `src/` | Modul kode Python yang dapat digunakan kembali (*reusable*) |
| `data/` | Data mentah dan olahan (tidak masuk git) |
| `models/` | File penyimpanan model hasil pelatihan (tidak masuk git) |
| `reports/` | Dokumen metodologi, laporan insight, dan hasil evaluasi model |

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
- **Dilarang keras** menggunakan *service role key* atau akun utama (*postgres admin*) Supabase.
- Kredensial password `ds_readonly` didapatkan langsung dari tim Fullstack backend melalui jalur aman.

## 6. Output yang Diharapkan
- Notebook EDA yang mendokumentasikan pola konsumsi produk dan perilaku mitra.
- *Baseline forecast* (misal: *moving average*, *seasonal naive*) dengan metrik evaluasi WAPE atau MAPE.
- Rekomendasi par level dan *safety stock* dinamis dengan memperhitungkan *lead time* produksi pabrik 5 sampai 7 hari.
- Hasil prediksi yang sesuai dengan kontrak skema tabel `restock_recommendations`.
- Dokumen metodologi dan laporan hasil evaluasi di folder `reports/`.

## 7. Aturan
- Jangan pernah meng-commit data mentah klien ke repositori git.
- Jangan meng-commit file model berukuran besar (`.pkl`, `.joblib`, `.pt`, dsb.).
- Jangan meng-commit file `.env`.
