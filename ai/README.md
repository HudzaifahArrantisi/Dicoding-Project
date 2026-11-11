# AI Engineering â€” Daisuki Inventory

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
| `data/raw_references/` | PDF, DOCX, dan CSV sumber untuk ekstraksi pengetahuan |
| `data/mega_data_word/` | Frasa training, intent, alias produk, dan filter guardrail |
| `data/mainbrain/corporate_knowledge/` | Profil perusahaan, aturan bisnis, dan kebijakan sumber RAG |
| `data/mainbrain/context_embeddings/` | Dokumen publik RAG dan snapshot analitik; retrieval saat ini memakai indeks kata, bukan embedding vektor |
| `data/mainbrain/models/` | Model lokal `daisuki.pkl` hasil training |
| `requirements.txt` | Satu daftar dependensi Python untuk seluruh workspace AI |

## 4. Dependensi & Library Python (`requirements.txt`)

Berikut adalah daftar pustaka (*libraries*) yang wajib diinstal beserta fungsi dan perannya dalam arsitektur AI Daisuki:

| Library | Versi Minimal | Fungsi Utama di Proyek Daisuki |
|---|---|---|
| `scikit-learn` | `>=1.3.0` | Melatih dan mengeksekusi pipeline machine learning Multinomial Naive Bayes (`daisuki.pkl`) untuk klasifikasi intent pesan mitra dan estimasi risiko stok toko. |
| `numpy` | `>=1.24.0` | Operasi vektor, manipulasi matriks fitur pada classifier, dan kalkulasi numerik inferensi. |
| `pandas` | `>=2.0.0` | Agregasi data konsumsi mingguan, pemrosesan log inventaris, dan konversi dataset tabel CSV/JSON. |
| `matplotlib` | `>=3.7.0` | Membuat grafik dari snapshot analitik pada skrip `colab/`. |
| `psycopg[binary]` | `>=3.1.0` | Driver PostgreSQL resmi (Neon DB) untuk menarik data riil (`stock_logs`, `partner_stocks`, `orders`) langsung dari server database. |
| `python-dotenv` | `>=1.0.0` | Memuat variabel konfigurasi dan kredensial sensitif (`DATABASE_URL`, `LLM_API_KEY`) dari berkas `.env` lokal secara aman. |
| `pypdf` | `>=3.17.0` | Universal Document Ingestion â€” mengekstrak teks dokumen PDF (seperti `CV-Hudzaifah_Ar-Rantisi.pdf`, laporan, dsb.) secara otomatis menjadi berkas Markdown di `ai/data/mainbrain/context_embeddings/`. |
| `python-docx` | `>=1.0.0` | Universal Document Ingestion â€” membaca dan mengonversi berkas dokumen Microsoft Word (`.docx`) menjadi Markdown terstruktur untuk otak RAG. |
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

# 4. Perbarui pip dan pasang seluruh dependensi
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# 5. Buat konfigurasi lokal hanya jika belum ada, lalu isi DATABASE_URL
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

### B. Melalui Command Prompt (CMD)

```cmd
cd ai
python -m venv .venv
.venv\Scripts\activate.bat
python -m pip install -r requirements.txt
```

### C. Melalui Git Bash / Linux Shell

```bash
cd ai
python -m venv .venv
source .venv/Scripts/activate   # atau source .venv/bin/activate di Linux
python -m pip install -r requirements.txt
```

---

## 6. Perintah Operasional Utama

Jalankan perintah berikut dari folder `ai/` setelah dependensi terpasang. Perintah JavaScript/TypeScript proyek tetap memakai Bun dari root repository.

1. **Menjalankan Training Model & Ingestion Dokumen Mainbrain:**
   ```bash
   python retraining/train.py
   ```
   *Fungsi*: Memindai dokumen di `ai/data/raw_references/`, membaca `data-science/reports/cleaned_inventory_summary.csv`, dan menghasilkan `ai/data/mainbrain/models/daisuki.pkl`.

2. **Menjalankan Pengujian AI Guardrails:**
   ```bash
   python -m unittest guardrails.test_guardrails
   ```
   *Fungsi*: Menguji filter pre-guardrail (Prompt Injection, Jailbreak, Cross-Tenant Isolation) dan post-guardrail context grounding angka.

3. **Menjalankan Worker Inferensi Lokal:**
   ```bash
   python retraining/inference_worker.py
   ```
   *Fungsi*: Worker latar belakang berbasis stdio IPC yang digunakan oleh backend ElysiaJS API untuk prediksi instan (<5ms).

4. **Memperbarui classifier intent tanpa koneksi database:**
   ```bash
   python retraining/refresh_identity.py
   ```
   Tambahkan frasa di `data/mega_data_word/intent/training/` sebelum menjalankan perintah ini. Model risiko stok lama tetap dipertahankan. Restart API agar kamus JSON dan dokumen publik yang dicache dimuat ulang.

### Handoff laporan Data Science

1. Data Science menjalankan `python data-science/src/weekly_analytics_aggregator.py` dari root, menghasilkan JSON, CSV, dan Markdown di `data-science/reports/`.
2. AI menjalankan `python ai/jobs/regional_stockout_naive_bayes.py`, `python ai/jobs/smart_allocation.py`, `python ai/jobs/weekly_facts_aggregator.py`, lalu `python ai/retraining/train.py` dari root. Tombol **Perbarui analisis & model** menjalankan urutan ini otomatis dan menyiapkan grafik setelah training.
3. Model risiko memakai CSV laporan yang berumur paling lama tujuh hari. Jika CSV tidak ada, lama, atau tidak valid, training gagal dan model lama dipertahankan. Ringkasan agregat privat tetap disimpan di `ai/data/raw_references/csv/ai_analysis_summary.csv`.

Model `.pkl` menyimpan classifier intent dan risiko; dokumen RAG perusahaan tetap dibaca terpisah. Dokumen privat hasil CSV tidak otomatis tersedia untuk chatbot mitra. Jika ada pengetahuan agregat yang layak dibagikan, buat versi `*.public.md` yang sudah diperiksa dan daftarkan di `data/mainbrain/corporate_knowledge/rag_policy.json`, lalu restart API.

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

## 9. Alur Mingguan Data Science → AI → Dashboard

1. Admin membuat akun `data_science` dan `ai_engineer` melalui halaman `/analysis`.
2. Data Science masuk sebagai role tersebut, memilih tanggal, lalu menekan **Buat laporan**. Server menjalankan agregator secara baca-saja dan menyimpan JSON, CSV, Markdown, serta `manifest.json` dengan hash SHA-256 di `data-science/reports/runs/<run_id>/`. Run yang sudah ada tidak ditimpa.
3. Admin meninjau periode, jumlah baris, dan produk di `/analysis`, lalu menyetujui atau menolak.
4. AI Engineer menekan **Proses laporan** pada run yang disetujui. Job risiko, evaluasi historis, alokasi draft, fakta dashboard, training `daisuki.pkl`, grafik, dan validasi berjalan berurutan. Artefak tahap berada di `ai/data/private/runs/<run_id>/`.
5. Setelah semua valid, API mengaktifkan run, menulis rekomendasi dengan stok pusat terkini, dan memuat ulang worker model chatbot. Dashboard dan chatbot membaca versi aktif yang sama. Admin dapat mengaktifkan kembali run terbit sebelumnya di `/analysis`.

Di dashboard Admin, alur yang sama tersedia langsung di tab **Log & Data** dan **AI Insights**. Tombol **Perbarui analisis Data Science** membuat laporan tujuh hari terakhir dan otomatis membuka tab AI Insights. Tombol **Buka alur analisis** menampilkan modal berisi JSON, CSV, dan Markdown hasil laporan. Setelah Admin memeriksa file, tombol **Lanjutkan dengan hasil file** menjalankan seluruh tahap AI dan menampilkan progres per langkah. Admin tidak perlu berpindah ke halaman role tim untuk alur akhir minggu ini.

Status, langkah, kesalahan, waktu publikasi, dan pelaku disimpan di PostgreSQL `analysis_runs` serta `audit_logs`. Jadwal Senin 05.00 WIB hanya membuat draft mingguan; pengingat harian 09.00 WIB muncul jika draft atau run yang disetujui belum dilanjutkan. Proses yang terputus saat API dimulai ulang ditandai gagal agar tidak terlihat terus berjalan.

**CLI manual untuk verifikasi run** (dari root repo, pakai Python pada `ai/.venv`):

```powershell
$env:DAISUKI_ANALYSIS_RUN_ID='<run_id-yang-disetujui>'
python ai/jobs/regional_stockout_naive_bayes.py
python ai/jobs/evaluate_stockout.py
python ai/jobs/smart_allocation.py
python ai/jobs/weekly_facts_aggregator.py
python ai/retraining/train.py
python ai/retraining/chart_data.py
python ai/jobs/validate_stage.py
```

CLI tersebut hanya menyiapkan draft privat. Publikasi rekomendasi dan pergantian run aktif dilakukan API melalui tombol **Proses laporan**, setelah validasi lengkap. Jangan menjalankan `smart_allocation.py --publish` secara manual karena melewati kontrol versi run.

## 10. Kebenaran Model dan RAG

`daisuki.pkl` melatih classifier intent dari `ai/data/mega_data_word/intent/` dan classifier risiko dari CSV run yang dipilih. File itu **tidak menyimpan seluruh dokumen perusahaan** dan tidak melakukan fine tuning LLM 9Router. Dokumen profil/SOP yang ditinjau disimpan sebagai `*.public.md`, harus terdaftar di `rag_policy.json`, lalu diambil saat pertanyaan masuk. Alias pencarian berada di `ai/data/mega_data_word/dictionary/retrieval_aliases.json`; pola keamanan dan intent dibaca dari kamus versi yang sama saat API menyala. Restart API untuk memuat perubahan kamus atau dokumen publik.

Fakta stok, PO, dan profil cabang diambil dari PostgreSQL sesuai JWT mitra yang login. Ringkasan wilayah hanya masuk prompt setelah disaring; dokumen privat dan daftar mitra lain tidak masuk RAG. Guardrail berjalan sebelum dan sesudah 9Router. Jika 9Router gagal, chatbot memakai balasan lokal.

`model_evaluation.json` memakai log historis dengan label stok mencapai nol dalam tujuh hari sebelum penerimaan. Data dipisah menurut waktu. Bila contoh atau kejadian nyata belum cukup, laporan menandai `insufficient_evidence` dan `calibrated: false`; prioritas pasokan tetap memakai aturan stok, bukan probabilitas model. Skor Naive Bayes tetap ditampilkan sebagai estimasi eksploratif. Rekomendasi tidak membuat PO otomatis.

## 11. Penyimpanan dan Setup

Jalankan `python -m venv .venv` lalu `pip install -r requirements.txt` dari folder `ai/`; untuk TS/JS gunakan Bun. Terapkan `neon/migrations/20261111_analysis_runs.sql` pada database yang sama dengan API sebelum membuka `/analysis`. Pada satu server, folder run privat harus berada di volume persisten. Deployment beberapa server memerlukan volume bersama atau object storage serta koordinasi worker; implementasi ini ditujukan untuk satu server API. Berkas `ai/data/private/` dan `data-science/reports/runs/` diabaikan Git dan wajib dicadangkan secara privat. Jangan memuat pickle dari sumber yang tidak tepercaya.
