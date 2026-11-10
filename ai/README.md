# AI Engineering — Daisuki Inventory

## 1. Tujuan
Menjalankan hasil model Data Science secara otomatis dan menyediakan fitur berbasis AI:
- Job harian rekomendasi restock otomatis.
- Asisten admin berbasis LLM (*tool calling*).
- Input stok cabang via chat.
- Ringkasan laporan mingguan (*weekly summary*).

## 2. Pemilik
Tim AI Engineer.

## 3. Struktur Folder

| Folder | Keterangan |
|---|---|
| `jobs/` | Skrip background job harian yang menghitung dan menulis ke tabel `restock_recommendations` |
| `assistant/` | Modul asisten admin LLM yang terintegrasi dengan *tool calling* API |
| `bot/` | Layanan input stok via antarmuka chat (prototipe Telegram) |
| `evals/` | Skrip pengujian akurasi parsing input chat dan performa respon asisten AI |

## 4. Dependensi & Library Python (`requirements.txt`)

Berikut adalah daftar pustaka (*libraries*) yang wajib diinstal beserta fungsi dan perannya dalam arsitektur AI Daisuki:

| Library | Versi Minimal | Fungsi Utama di Proyek Daisuki |
|---|---|---|
| `scikit-learn` | `>=1.3.0` | Melatih dan mengeksekusi pipeline machine learning Multinomial Naive Bayes (`daisuki.pkl`) untuk klasifikasi intent pesan mitra dan estimasi risiko stok toko. |
| `numpy` | `>=1.24.0` | Operasi vektor, manipulasi matriks fitur pada classifier, dan kalkulasi numerik inferensi. |
| `pandas` | `>=2.0.0` | Agregasi data konsumsi mingguan, pemrosesan log inventaris, dan konversi dataset tabel CSV/JSON. |
| `psycopg[binary]` | `>=3.1.0` | Driver PostgreSQL resmi (Neon DB) untuk menarik data riil (`stock_logs`, `partner_stocks`, `orders`) langsung dari server database. |
| `python-dotenv` | `>=1.0.0` | Memuat variabel konfigurasi dan kredensial sensitif (`DATABASE_URL`, `LLM_API_KEY`) dari berkas `.env` lokal secara aman. |
| `pypdf` | `>=3.17.0` | Universal Document Ingestion — mengekstrak teks dokumen PDF (seperti `CV-Hudzaifah_Ar-Rantisi.pdf`, laporan, dsb.) secara otomatis menjadi berkas Markdown di `data/mainbrain/context_embeddings/`. |
| `python-docx` | `>=1.0.0` | Universal Document Ingestion — membaca dan mengonversi berkas dokumen Microsoft Word (`.docx`) menjadi Markdown terstruktur untuk otak RAG. |
| `httpx` | `>=0.25.0` | Klien HTTP asinkron/sinkron berkecepatan tinggi untuk komunikasi dengan LLM lokal via 9Router (`localhost:20128`) dan webhook eksternal. |
| `python-telegram-bot` | `>=20.0` | Integrasi bot percakapan Telegram sebagai saluran alternatif pelaporan sisa stok cabang secara mobile. |

---

## 5. Setup Lingkungan & Instalasi

### A. Melalui PowerShell (Windows)

```powershell
# 1. Pindah ke direktori workspace ai
cd ai

# 2. Buat virtual environment (.venv)
python -m venv .venv

# 3. Aktifkan virtual environment
.venv\Scripts\Activate.ps1

# (Jika muncul Execution Policy error, jalankan: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned)

# 4. Perbarui pip dan pasang seluruh dependensi
python -m pip install --upgrade pip
pip install -r requirements.txt

# 5. Siapkan konfigurasi .env
Copy-Item .env.example .env
```

### B. Melalui Command Prompt (CMD)

```cmd
cd ai
python -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt
```

### C. Melalui Git Bash / Linux Shell

```bash
cd ai
python -m venv .venv
source .venv/Scripts/activate   # atau source .venv/bin/activate di Linux
pip install -r requirements.txt
```

---

## 6. Perintah Operasional Utama

Setelah dependensi terpasang, perintah-perintah berikut dapat dijalankan dari terminal:

1. **Menjalankan Training Model & Ingestion Dokumen Mainbrain:**
   ```bash
   python ai/retraining/train.py
   ```
   *Fungsi*: Memindai seluruh dokumen di `data/raw_references/`, mengekstraknya ke `data/mainbrain/context_embeddings/*.md`, mengambil data terbaru dari PostgreSQL, dan menghasilkan model serialisasi biner `data/mainbrain/models/daisuki.pkl`.

2. **Menjalankan Pengujian AI Guardrails:**
   ```bash
   python ai/guardrails/test_guardrails.py
   ```
   *Fungsi*: Menguji filter pre-guardrail (Prompt Injection, Jailbreak, Cross-Tenant Isolation) dan post-guardrail context grounding angka.

3. **Menjalankan Worker Inferensi Lokal:**
   ```bash
   python ai/retraining/inference_worker.py
   ```
   *Fungsi*: Worker latar belakang berbasis stdio IPC yang digunakan oleh backend ElysiaJS API untuk prediksi instan (<5ms).

---

## 7. Akses dan Keamanan
- `DATABASE_URL` menggunakan role PostgreSQL `ai_job` (memiliki hak baca tabel inti dan hak tulis hanya ke tabel `restock_recommendations`).
- Asisten admin hanya boleh memanggil endpoint API berstatus *read-only* melalui `API_BASE_URL` dan **dilarang keras** mengeksekusi perintah SQL mentah secara bebas.
- Mitra tidak boleh memiliki akses atau melihat data mitra lain melalui respon AI (wajib mematuhi batasan *tenant isolation*).
- Semua API key (LLM, Telegram token, database) hanya disimpan dalam file `.env`.

## 8. Output yang Diharapkan
- Job harian yang mengeksekusi inferensi model dan menyimpan rekomendasi ke database.
- Asisten cerdas untuk dashboard admin dengan kemampuan *function/tool calling*.
- Prototipe bot input stok chat yang menyertakan tahap konfirmasi data sebelum menyimpan transaksi.
- Modul pembuatan ringkasan performa dan kebutuhan inventaris mingguan.
- Dokumentasi hasil pengujian dan akurasi di folder `evals/`.

## 9. Pipeline Rekomendasi Stok

Setelah Data Science membuat `data-science/data/cleaned_inventory_summary.csv`, jalankan dari root repo:

```powershell
python ai/jobs/analyze_stockouts.py
python ai/jobs/smart_allocation.py
```

Job pertama menulis klasifikasi risiko ke `data/mainbrain/context_embeddings/stockout_risks.csv`. Job kedua memakai koneksi database untuk memperbarui rekomendasi dan membuat alert admin (skema database terpadu tersedia di `neon/init.sql`).

## 10. Aturan Kerja AI Workspace
- Jangan pernah meng-commit file `.env`, API key, atau token ke repositori git.
- Model biner dan file ekstraksi berukuran besar dikelola di bawah folder `data/` sesuai arsitektur monorepo terpusat.
