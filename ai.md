# PROMPT & PANDUAN PENGEMBANGAN: ROLE AI ENGINEER
## Model Analisis Spasial Kehabisan Stok Daerah Berbasis Naive Bayes

Dokumen ini berisi spesifikasi instruksi, context data, serta prompt siap pakai (*ready-to-use prompt*) untuk tim/role **AI Engineer** dalam mengimplementasikan model Machine Learning **Naive Bayes** guna menganalisis perkembangan tren daerah (kabupaten/kota) yang paling sering dan paling banyak mengalami kehabisan stok barang (*stockout / status kritis*) beserta identifikasi mitra terkait di Daisuki B2B Inventory System.

---

## 1. Salin & Tempel Prompt Berikut ke AI / Engineer

```markdown
Anda adalah seorang Senior AI & Machine Learning Engineer yang bertanggung jawab atas workspace `ai/` pada sistem Daisuki B2B Inventory & Order Management System.

================================================================================
TUGAS UTAMA:
Bangun sebuah modul pipeline analitik Machine Learning di `ai/jobs/regional_stockout_naive_bayes.py` yang menganalisis tren perkembangan daerah (provinsi, kabupaten/kota) yang paling sering dan paling banyak mengalami kehabisan stok barang (status kritis & stockout) berdasarkan data mitra di daerah tersebut, serta mengkategorikan tingkat kerentanan daerah menggunakan metode NAIVE BAYES.
================================================================================

1. KONTEKS ARSITEKTUR & DATA SISTEM:
- Runtime: Python 3.10+ (workspace `ai/` atau `data-science/`)
- Database: PostgreSQL (Neon DB).
- Tabel & Kolom Kunci:
  a. `partners`: id, name, type, province_name, regency_name, district_name, village_name, is_active.
  b. `partner_stocks`: partner_id, product_id, current_qty, par_level, updated_at.
  c. `stock_logs`: id, partner_id, product_id, qty_before, qty_after, source ('manual_update', 'order_received', 'adjustment'), created_at.
  d. `products`: id, sku, name, central_stock, b2b_price, is_active.
  e. `orders` & `order_items`: status ('diproses', 'disetujui', 'dalam_pengiriman', 'selesai', 'ditolak', 'dibatalkan').

2. DEFINISI STATUS STOK DAISUKI:
- Kritis / Potensi Stockout: current_qty <= 0.20 * par_level (atau current_qty == 0).
- Waspada: 0.20 * par_level < current_qty <= 0.50 * par_level.
- Aman: current_qty > 0.50 * par_level.
- Penting: Di sistem Daisuki, produk yang berstatus "kritis" sering kali merupakan produk fast-moving (laku keras) yang melebihi kapasitas par level rak mitra di daerah tersebut.

3. REKAYASA FITUR (FEATURE ENGINEERING PER KABUPATEN/KOTA & MITRA):
Agregasikan transaksi 30–60 hari terakhir dengan metrik spasial:
1. `critical_events_count` (X1): Frekuensi kejadian sisa stok mitra di daerah tersebut menyentuh batas kritis (qty <= 20% par_level).
2. `stockout_events_count` (X2): Frekuensi kejadian sisa stok benar-benar 0 unit.
3. `avg_stock_ratio` (X3): Rata-rata rasio stok terhadap kapasitas rak (current_qty / par_level).
4. `partner_density` (X4): Jumlah mitra aktif di kabupaten/kota tersebut (indikator konsentrasi pasar).
5. `daily_consumption_velocity` (X5): Laju rata-rata unit keluar per hari (Average Daily Usage / ADU).
6. `unfulfilled_ratio` (X6): Persentase pesanan restok yang dipotong/terlambat dipenuhi di daerah tersebut.

4. KLASIFIKASI NAIVE BAYES (TARGET CLASSES):
Kelompokkan wilayah ke dalam 3 zona kerentanan:
- `ZONA_MERAH` (High Stockout Vulnerability): Daerah dengan frekuensi kehabisan stok sangat tinggi, perputaran cepat, dan kapasitas pasokan minim. Perlu prioritas alokasi darurat & peningkatan par level.
- `ZONA_KUNING` (Moderate Risk): Daerah dengan stok fluktuatif atau sering terlambat mengajukan restok (late reorder).
- `ZONA_HIJAU` (Stable / Resilient): Daerah dengan pasokan stabil, stok jarang kritis, dan siklus restok lancar.

5. METODE & FORMULASI MATEMATIS:
- Gunakan Teorema Bayes:
  P(Kelas | X) = [ P(X | Kelas) * P(Kelas) ] / P(X)
- Implementasikan menggunakan `GaussianNB` (atau `MultinomialNB`) dari scikit-learn.
- Untuk bootstrapping data latih awal (jika belum ada supervised labels historis), terapkan aturan heuristik batas risiko bisnis untuk membuat ground-truth sintetis, latih model Naive Bayes, lalu hitung probabilitas posterior P(ZONA_MERAH | X) per wilayah.

6. OUTPUT YANG DIHASILKAN:
1. Peringkat Daerah Paling Rawan: Daftar Kabupaten/Kota diurutkan berdasarkan `critical_events_count` tertinggi dan probabilitas `ZONA_MERAH`.
2. Pemetaan Mitra Terdampak: Daftar mitra cabang di daerah merah tersebut, produk apa yang paling sering habis (fast-moving), dan rekomendasi revisi kapasitas rak (Suggested Par Level).
3. File JSON Ekspor: Simpan hasil analisis terstruktur ke `ai/data/regional_stockout_insights.json` agar dapat langsung ditampilkan di Dashboard Admin (Tab AI Insights / Data Science).
4. Rekomendasi Eksekutif: Narasi ringkas dalam Bahasa Indonesia yang menjelaskan akar masalah di daerah teratas (apakah Under-Capacity atau Keterlambatan Pengiriman).

7. STANDAR KUALITAS KODE:
- Modular, memiliki penanganan error (ZeroDivisionError, missing database connection, data kosong).
- Menggunakan `psycopg` dengan `DATABASE_URL` dari file `.env`.
- Jalankan script secara standalone dengan perintah:
  `python ai/jobs/regional_stockout_naive_bayes.py`
```

---

## 2. Struktur Pipeline Analisis Naive Bayes

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   SUMBER DATA TRANSAKSI (NEON DB)                      │
│ - partners (Wilayah: province_name, regency_name, district_name)       │
│ - partner_stocks & stock_logs (Sisa stok, par_level, histori kritis)  │
│ - orders & order_items (Histori pesanan restok per cabang)             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             FEATURE EXTRACTION & AGREGASI PER WILAYAH                  │
│  - Total Kejadian Kritis / Habis (30-60 hari)                          │
│  - Rasio Stok Fisik vs Par Level                                       │
│  - Kecepatan Konsumsi Harian (ADU)                                     │
│  - Kepadatan Jumlah Mitra di Daerah Tersebut                           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               MODEL CLASSIFIER: GAUSSIAN NAIVE BAYES                   │
│                                                                        │
│               P(Kelas | Fitur) ∝ P(Fitur | Kelas) × P(Kelas)           │
│                                                                        │
│  Kelas Output:                                                         │
│  - ZONA_MERAH  (Kerentanan Tinggi - Prioritas Alokasi & Naikan Par)    │
│  - ZONA_KUNING (Kerentanan Sedang - Pengawasan Late Reorder)           │
│  - ZONA_HIJAU  (Aman & Stabil)                                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       HASIL & AKSI REKOMENDASI                         │
│  - Peringkat Kabupaten/Kota dengan frekuensi kritis terbanyak          │
│  - Daftar nama mitra & produk yang paling laku keras di daerah tsb     │
│  - Ekspor output ke `ai/data/regional_stockout_insights.json`          │
│  - Visualisasi di Dashboard Admin: Tab AI Insights                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Contoh Implementasi Script (`ai/jobs/regional_stockout_naive_bayes.py`)

```python
from __future__ import annotations
import json
import os
from pathlib import Path
import pandas as pd
import numpy as np
import psycopg
from sklearn.naive_bayes import GaussianNB

ROOT = Path(__file__).resolve().parents[2]
OUTPUT_FILE = ROOT / "ai" / "data" / "regional_stockout_insights.json"

def get_database_url() -> str:
    for env_path in (ROOT / ".env", ROOT / "apps" / "api" / ".env", ROOT / "ai" / ".env"):
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8").splitlines():
                k, sep, v = line.partition("=")
                if sep and k.strip() == "DATABASE_URL":
                    return v.strip().strip("'\"")
    return os.environ.get("DATABASE_URL", "")

def fetch_regional_stock_data() -> pd.DataFrame:
    db_url = get_database_url()
    if not db_url:
        raise ValueError("DATABASE_URL tidak ditemukan pada file .env")

    query = """
    SELECT 
        p.id AS partner_id,
        p.name AS partner_name,
        COALESCE(p.province_name, 'Jawa Barat') AS province_name,
        COALESCE(p.regency_name, 'Kota Bandung') AS regency_name,
        COALESCE(p.district_name, 'Coblong') AS district_name,
        pr.id AS product_id,
        pr.name AS product_name,
        ps.current_qty,
        ps.par_level,
        COUNT(CASE WHEN sl.qty_after <= (ps.par_level * 0.20) THEN 1 END) AS critical_events,
        COUNT(CASE WHEN sl.qty_after = 0 THEN 1 END) AS zero_stock_events,
        COUNT(sl.id) AS total_updates
    FROM partners p
    JOIN partner_stocks ps ON ps.partner_id = p.id
    JOIN products pr ON pr.id = ps.product_id
    LEFT JOIN stock_logs sl ON sl.partner_id = p.id 
         AND sl.product_id = ps.product_id 
         AND sl.created_at >= NOW() - INTERVAL '45 days'
    WHERE p.is_active = TRUE
    GROUP BY p.id, p.name, p.province_name, p.regency_name, p.district_name, pr.id, pr.name, ps.current_qty, ps.par_level;
    """
    with psycopg.connect(db_url) as conn:
        return pd.read_sql(query, conn)

def train_and_classify(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    # 1. Agregasi per Daerah (Kabupaten/Kota + Mitra)
    grouped = df.groupby(["province_name", "regency_name", "partner_id", "partner_name"]).agg(
        monitored_products=("product_id", "count"),
        total_critical_events=("critical_events", "sum"),
        total_zero_events=("zero_stock_events", "sum"),
        avg_stock_ratio=("current_qty", lambda q: (q / df.loc[q.index, "par_level"]).mean()),
    ).reset_index()

    # 2. Bootstrapping Baseline Ground-Truth untuk Naive Bayes
    def get_initial_label(row):
        if row["total_critical_events"] >= 6 or row["total_zero_events"] >= 2 or row["avg_stock_ratio"] < 0.25:
            return "ZONA_MERAH"
        elif row["total_critical_events"] >= 2 or row["avg_stock_ratio"] < 0.50:
            return "ZONA_KUNING"
        return "ZONA_HIJAU"

    grouped["target_label"] = grouped.apply(get_initial_label, axis=1)

    # 3. Fit Gaussian Naive Bayes Model
    features = ["total_critical_events", "total_zero_events", "avg_stock_ratio", "monitored_products"]
    X = grouped[features].fillna(0)
    y = grouped["target_label"]

    nb = GaussianNB()
    nb.fit(X, y)

    # 4. Hitung Probabilitas Posterior
    grouped["predicted_zone"] = nb.predict(X)
    probs = nb.predict_proba(X)
    classes = list(nb.classes_)
    red_idx = classes.index("ZONA_MERAH") if "ZONA_MERAH" in classes else 0
    grouped["vulnerability_score"] = [round(p[red_idx] * 100, 1) for p in probs]

    # 5. Ringkasan Peringkat Daerah (Kabupaten / Kota)
    regency_rankings = grouped.groupby(["province_name", "regency_name"]).agg(
        total_partners=("partner_id", "count"),
        critical_partners=("predicted_zone", lambda x: (x == "ZONA_MERAH").sum()),
        warning_partners=("predicted_zone", lambda x: (x == "ZONA_KUNING").sum()),
        highest_vulnerability=("vulnerability_score", "max"),
        avg_vulnerability=("vulnerability_score", "mean")
    ).reset_index().sort_values(by=["critical_partners", "avg_vulnerability"], ascending=False)

    return regency_rankings, grouped.sort_values(by="vulnerability_score", ascending=False)

def run():
    print("Mengambil data riwayat stok mitra per wilayah...")
    df = fetch_regional_stock_data()
    if df.empty:
        print("Data transaksi stok belum mencukupi.")
        return

    print("Melatih model Naive Bayes dan mengklasifikasikan wilayah...")
    regency_summary, partner_predictions = train_and_classify(df)

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": pd.Timestamp.now().isoformat(),
        "model": "GaussianNaiveBayes-RegionalStockout-v1.0",
        "top_vulnerable_regions": regency_summary.to_dict(orient="records"),
        "partner_risk_details": partner_predictions.to_dict(orient="records")
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"Sukses! Hasil model Naive Bayes tersimpan di: {OUTPUT_FILE}")

if __name__ == "__main__":
    run()
```

---

## 4. Cara Menjalankan Script
Di terminal atau command prompt:
```bash
# Melalui Bun script di root project:
bun run ai:naive-bayes

# Atau secara manual di workspace ai/:
cd ai
python jobs/regional_stockout_naive_bayes.py
```
Output JSON akan tersimpan otomatis di `ai/data/regional_stockout_insights.json` dan siap dikonsumsi oleh endpoint Elysia API `/admin/ai-insights`.

---

## 5. Perintah & Prompt untuk Codex / AI Runner

Salin perintah singkat ini jika Anda menggunakan **OpenAI Codex**, **Cursor**, **Copilot**, atau **Claude Agent**:

```markdown
Perintah untuk Codex:
1. Periksa file `ai/jobs/regional_stockout_naive_bayes.py` yang telah dibuat.
2. Jalankan perintah eksekusi:
   bun run ai:naive-bayes
   (atau: python ai/jobs/regional_stockout_naive_bayes.py)
3. Pastikan script berhasil terkoneksi ke Neon DB menggunakan DATABASE_URL dari file .env.
4. Verifikasi bahwa file output `ai/data/regional_stockout_insights.json` telah terbuat dan berisi:
   - "regional_rankings": daftar kabupaten/kota yang diurutkan berdasarkan jumlah mitra kritis & kerentanan stok tertinggi (ZONA_MERAH).
   - "vulnerable_partners": daftar mitra dengan produk laku keras yang membutuhkan penambahan Par Level.
5. Tampilkan 3 daerah teratas hasil prediksi Naive Bayes ke terminal.
```

