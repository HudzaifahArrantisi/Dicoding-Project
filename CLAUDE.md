# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Daisuki B2B Inventory & Order Management System is a multi-tenant platform for Daisuki central administration and partner branches (hotels, restaurants, cafes, minimarkets). It solves stock visibility, late restock cycles, and factory lead time coordination.

The codebase is organized as a Bun monorepo comprising a web frontend, backend API, shared TypeScript package, database migrations, and Python-based data science and AI workspaces.

---

## Development Commands

### Package Manager
- **Strictly use [Bun](https://bun.sh/)** for all JS/TS operations. Do **not** use `npm`, `yarn`, or `pnpm` (they corrupt [bun.lock](bun.lock) and workspace symlinks).

### Common Commands (Root)
- Install all workspace dependencies:
  ```bash
  bun install
  ```
- Run web frontend (port 3000) and API server (port 3001) concurrently:
  ```bash
  bun run dev
  ```
- Run only the frontend:
  ```bash
  bun run dev:web
  ```
- Run only the backend API:
  ```bash
  bun run dev:api
  ```
- Run TypeScript typecheck across all workspaces:
  ```bash
  bun run typecheck
  ```

### Frontend ([apps/web/](apps/web/))
- Typecheck:
  ```bash
  bun --cwd apps/web run typecheck
  ```
- Linting:
  ```bash
  bun --cwd apps/web run lint
  ```
- Formatting & ESLint auto-fix:
  ```bash
  bun --cwd apps/web run format
  bun --cwd apps/web run check
  ```
- Build production bundle (Vite + Cloudflare):
  ```bash
  bun --cwd apps/web run build
  ```
- Regenerate TanStack router tree:
  ```bash
  bun --cwd apps/web run generate-routes
  ```
- Add a new Shadcn UI component (run inside [apps/web/](apps/web/)):
  ```bash
  bunx --bun shadcn@latest add <component-name>
  ```

### Backend API ([apps/api/](apps/api/))
- Dev server with watch mode:
  ```bash
  bun --cwd apps/api run dev
  ```
- Start production server:
  ```bash
  bun --cwd apps/api run start
  ```
- Typecheck:
  ```bash
  bun --cwd apps/api run typecheck
  ```

### Python Workspaces ([data-science/](data-science/) & [ai/](ai/))
Both workspaces use Python virtual environments. PowerShell setup:
```powershell
cd data-science  # or cd ai
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## High-Level Architecture & Structure

```text
daisuki-inventory/
├── apps/
│   ├── web/           # Frontend: TanStack Start (React 19, Tailwind v4, Vite, Cloudflare)
│   └── api/           # Backend: ElysiaJS, Bun runtime, Drizzle ORM, Jose JWT
├── packages/
│   └── shared/        # Shared package (@daisuki/shared): enums, types, state machines
├── data-science/      # Python workspace: EDA, ROP/safety stock modeling, synthetic data
├── ai/                # Python workspace: batch restock jobs, LLM assistant, Telegram bot
│   ├── data/          # Raw references, RAG knowledge, intent dictionary, analytics, model
│   └── requirements.txt # Shared Python dependencies
├── neon/
│   └── init.sql       # Authoritative unified SQL schema, constraints, roles, and seed data for Neon DB
└── docs/
    └── ALUR_SISTEM_DAN_ROLE.md # Comprehensive system workflow, role guide, and business rules
```

### Core Architecture Rules

1. **Strict Mutation Boundary**:
   - The frontend **never writes directly** to database tables.
   - All mutations (stock adjustments, restock orders, status updates, approvals) **must** go through the Elysia backend API to ensure business validation and database transactions are centralized.
   - The frontend reads data via Elysia endpoints and client state cache (TanStack Query).

2. **End-to-End Type Safety**:
   - The Elysia app export `type App = typeof app` in [apps/api/src/index.ts](apps/api/src/index.ts) is imported directly by [apps/web/src/lib/api.ts](apps/web/src/lib/api.ts) via `@elysiajs/eden` (`treaty<App>(...)`).
   - Token authentication is handled automatically in the treaty `onRequest` hook using the JWT bearer token stored in localStorage (`daisuki_token`).

3. **Multi-Tenancy & Authorization**:
   - Two main roles: `admin` and `mitra`. Role and tenant linkage are in the `users` table (`role`, `partner_id`).
   - `partner_id` **must always be determined server-side** from the authenticated user's JWT payload in Elysia. Never accept `partner_id` blindly from a client request body.
   - Partner data isolation is enforced at Elysia route guards and schema constraints.

4. **Database & ORM Guidelines**:
   - **Source of Truth**: The unified SQL file in [neon/init.sql](neon/init.sql) is the authoritative database schema and initial seed source of truth.
   - [apps/api/src/db/schema.ts](apps/api/src/db/schema.ts) mirrors the database schema using Drizzle ORM for query building.
   - **Do not run `drizzle-kit push` or `drizzle-kit generate`**.
   - **Neon DB Connection Pooler**: Neon pooled connections work seamlessly with `{ prepare: false }` in [apps/api/src/db/client.ts](apps/api/src/db/client.ts).
   - **Concurrency Safety**: Stock updates in Elysia must wrap operations in transactions and use `SELECT ... FOR UPDATE` row locks to prevent race conditions when writing to `partner_stocks` and `stock_logs`.

5. **Shared Business Logic ([packages/shared/src/index.ts](packages/shared/src/index.ts))**:
   - **Unbounded Partner Stock**: No maximum stock per product, category, or branch. Never use 40 pcs or any other fixed ceiling for stock reports or restock requests. In Admin and Mitra UI, show stock as `{current_qty} pcs` or `Sisa Stok`, without `/40`, `/par`, or `Sisa Stok / Par`. Do not call a branch's stock ceiling `Kapasitas Rak` or `Max Stock`; use `Sisa Stok`, `Buffer Minimal`, or `Saran Pasokan` as appropriate. `par_level` and status thresholds are safety buffers and demand signals, never capacity caps. Restock requests are limited only by `products.central_stock` at transaction time.
   - **Stock Status**: Calculated relative to buffer thresholds:
     - `aman`: > 50%
     - `waspada`: > 20% to 50%
     - `kritis`: <= 20%
     - Stale: `updated_at` older than 24 hours (`isStale()`).
   - **Order State Machine**:
     - Statuses: `diproses` → `disetujui` (or `ditolak` / `dibatalkan`) → `dalam_pengiriman` → `selesai`.
     - Validated using `canTransition(from, to)`.
     - Stock quantities increase only when the partner confirms delivery (`dalam_pengiriman` → `selesai`).

6. **Data Science & AI Integration**:
   - DB Roles: Tim Data Science uses `ds_readonly` (read-only access to core tables), and AI jobs use `ai_job` (read tables, write to `restock_recommendations`). Neither role may use service role keys.
   - AI Assistant operates strictly read-only against Elysia API endpoints (no direct arbitrary SQL execution).

7. **Design System & UI Conventions**:
   - Fonts: Heading and major numerical displays use `Bricolage Grotesque` (`--font-display` / `.font-display`). Body and form elements use `Figtree` (`--font-sans` / `.font-sans`).
   - Tabular Numbers: All stock quantities, prices, and metrics must use `.num` (`tabular-nums`) to maintain vertical alignment.
   - Stock Status Colors: Defined in [apps/web/src/styles.css](apps/web/src/styles.css) as semantic tokens (`--color-ok`, `--color-warn`, `--color-crit`, `--color-stale` and their fg/bg variants).
   - Brand Accent: `Ume` (`#b83a6a`) is reserved for branding, login headers, and illustrations; never use it for buttons or status chips to avoid confusion with critical red.
   - Touch Accessibility: Partner portal is optimized for mobile with touch targets of at least 44px.

8. **Prosedur Otomatis Log Perubahan Harian (Daily Changelog Protocol)**:
   - **Sebelum Bekerja**: Agen/Developer **wajib membaca** [AGENTS.md](AGENTS.md) dan [CLAUDE.md](CLAUDE.md) untuk memahami konteks dan perubahan terbaru.
   - **Setelah Mengubah Kode**: Catat dokumentasi ringkas perubahan ke seksi `## Catatan Perubahan Harian (Daily Changelog)` di [CLAUDE.md](CLAUDE.md) dan [AGENTS.md](AGENTS.md) dengan format tanggal `YYYY-MM-DD`.

---

## Catatan Perubahan Harian (Daily Changelog)

### 2026-11-13
- **Panduan training manual per kategori**: Tiga dokumen di `docs/training/` menjelaskan secara terpisah mode analisis internal, referensi mentah, dan gabungan; indeks panduan serta README retraining menautkan semuanya. Perintah, artefak, dan isolasi data mitra dicocokkan dengan `train_daisuki.py`.
- **Perbaikan Koneksi 9Router (`daisuki` / `ag/gemini-3.8-flash-high`), Eliminasi Blokir Cooldown 30s, & Status Respons Chatbot Mitra**: Menghapus pemblokiran sirkuit 30 detik (`failedUntil`) dan pemotongan batas waktu 80% pada endpoint utama di [apps/api/src/modules/assistant/llm-client.ts](apps/api/src/modules/assistant/llm-client.ts), menaikkan `max_tokens` dari `600` menjadi `2048` (agar model reasoning `-high` tidak kehabisan kuota token saat fase thinking), serta melacak status panggilan (`getLastLlmStatus()`). Memadatkan prompt di [apps/api/src/modules/assistant/rag-prompt.ts](apps/api/src/modules/assistant/rag-prompt.ts) dan memisahkan prompt ringan untuk pertanyaan umum di [apps/api/src/modules/assistant/index.ts](apps/api/src/modules/assistant/index.ts) agar model merespons cepat layaknya chatbot biasa tanpa memblokir pertanyaan umum, menampilkan pesan status `"Maaf, server sedang gangguan"` saat LLM timeout/error, serta menampilkan alasan aturan spesifik saat melanggar guardrail. Memperbaiki regex `log\w*` menjadi `logs?|lognya` di `ai/data/mega_data_word/intent/tours/logs.json` dan `operational.json` agar kata `"Logistic"` tidak salah memicu log mutasi stok.
- **Vektor analisis mingguan dan PDF privat dalam model**: Training gabungan menulis `daisuki.pkl` manual di `ai/data/private/manual/`, memuat vektor analisis empat kategori per mitra dan 354 cuplikan dari tujuh PDF. Worker menyaring analisis menurut `partner_id` JWT; ringkasan memisahkan periode model dari data PostgreSQL terbaru. PDF mentah dalam biner tetap privat sampai sumber disetujui sebagai `.public.md`. `pypdf` dipasang, run 424 pasangan mitra-produk dilatih, dan override model API lokal diarahkan ke artefak privat.
- **Training manual tiga opsi Daisuki AI**: `ai/retraining/train_daisuki.py` menyediakan mode analisis privat, referensi publik, dan kombinasi. Empat JSON Data Science serta manifest diverifikasi; model risiko memakai CSV pasangan mitra-produk dari run yang sama. Referensi mentah hanya terindeks setelah dipilih eksplisit melalui `--public-source` dan lolos penyaringan konten. Panduan dan tes validasi run ditambahkan; tes 1/1, kompilasi Python, dan `git diff --check` lulus.
- **Perbaikan Error 503 `CONNECTION_CLOSED` pada `GET /admin/ai-insights` (Neon DB Pooler)**: Menambahkan konfigurasi lifecycle socket pada klien `postgres` di [apps/api/src/db/client.ts](apps/api/src/db/client.ts) (`idle_timeout: 15`, `connect_timeout: 15`, `max_lifetime: 300`, `keep_alive: 30`) agar koneksi idle yang diputus oleh Neon PgBouncer tidak dipakai ulang hingga menggantung 72 detik. Memperkuat `isTransientDatabaseError` dan `retryTransientRead` (hingga 2x retry dengan backoff bertahap) di [apps/api/src/lib/db-retry.ts](apps/api/src/lib/db-retry.ts), membungkus seluruh 9 query agregasi di `computeCompanyAiAnalytics` dan `getRegionalActivity` ([apps/api/src/modules/admin/index.ts](apps/api/src/modules/admin/index.ts)) dengan `retryTransientRead` secara paralel (`Promise.all`), serta menambahkan deduplikasi request paralel (`inflightCompanyAnalytics`) dan cache TTL 15 detik (`cachedCompanyAnalytics`).
- **Redesain Antislop UI & Grid 2 Kolom pada Tab Ajukan Restock Mitra**: Merefaktor komponen `OrderForm` di [apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx) mengikuti pedoman `/antislop-ui` dan `/antislop-layoutmobile`. Mengubah daftar produk dari kartu vertikal 1 kolom menjadi **2-Column Responsive Grid** (`grid-cols-1 sm:grid-cols-2`) yang konsisten dengan tab *Stok Saya*, mengeliminasi checkbox redundan *"Tidak perlu restock barang ini"* dan elemen `<hr>` kasar, memadatkan perbandingan *Sisa di toko* vs *Stok pusat* ke dalam kotak metrik 2 kolom (`tabular-nums`), menambahkan tombol cepat satu sentuhan **`Isi saran +X pcs`** untuk produk di bawah buffer, serta menyatukan ringkasan pengajuan, catatan admin, dan tombol kirim ke dalam footer terintegrasi. Merapikan chip saran cepat pada `MitraAiAssistant` ([apps/web/src/components/inventory/mitra-ai-assistant.tsx](apps/web/src/components/inventory/mitra-ai-assistant.tsx)) dengan `flex-wrap` agar tidak terpotong di sisi kanan dialog.

### 2026-11-12
- **Worker model dan retrieval biner saat server berjalan**: `daisuki.pkl` kini memuat classifier intent dan indeks TF-IDF publik yang digunakan worker Python persisten sejak startup API. Setiap chat mengambil intent serta cuplikan, lalu menggabungkannya dengan fakta cabang dari PostgreSQL. Override model eksplisit diprioritaskan; startup mencatat kesiapan dan worker ditutup bersama API. Biner berisi 225 contoh intent dan 26 cuplikan publik. Validasi 60 tes asisten, tes indeks Python, typecheck, dan startup API nyata pada port uji lulus; alur didokumentasikan di `docs/RUNTIME_RAG_DAISUKI.md`.
- **Mode percobaan prompt chatbot mitra**: `ASSISTANT_RELAXED_CHAT=true` pada `.env` lokal memakai prompt ringkas dan melewati regex injection/probe, penulisan ulang kedua, serta validator angka jawaban; isolasi JWT dan penolakan lintas mitra tetap aktif. Model `ag/gemini-3.8-flash-high` tetap timeout pada pengujian chat langsung melalui gateway lokal dan tunnel. Validasi 59 tes asisten dan typecheck lulus.
- **Diagnosis timeout 9Router pada chat mitra**: `apps/api/.env` lokal diperbaiki dari timeout 8 detik menjadi 25 detik. Klien menghentikan retry tunnel setelah timeout model dan memberi cooldown 30 detik; GET riwayat tidak menunggu pemadatan memori latar. Gateway lokal `/v1/models` merespons, tetapi chat `opn` tetap tidak mengirim respons dalam 40 detik dan beberapa penyedia 9Router tidak tersedia; pemulihan penyedia diperlukan agar chatbot memakai jawaban LLM. Validasi 57 tes asisten dan typecheck lulus.
- **RAG lima lapis dan memori sesi bergulir**: Guardrail berbasis kebijakan berkas menjaga isolasi mitra, penulisan ulang pertanyaan ambigu berjalan kondisional melalui 9Router, dan fakta stok cabang dipisah dari stok pusat. Percakapan umum serta koreksi stok diterima; validator tetap memeriksa klaim operasional. Empat pasangan pesan terakhir aktif per UUID sesi dan dua pasangan tertua diringkas ke PostgreSQL secara asinkron. Timeout default LLM 25 detik; `daisuki.pkl` dilatih ulang dari 424 pasangan mitra-produk dengan cuplikan pengetahuan publik. Validasi 56 tes asisten dan typecheck lulus.
- **Panduan folder data dan memori AI**: Menambahkan `ai/data/PANDUAN_DATA_DAN_MEMORI_DAISUKI.md` untuk menjelaskan struktur data, perintah ekstraksi dokumen, training intent/risiko, publikasi sumber RAG, dan penyimpanan memori percakapan. Tautan ditambahkan di README data.
- **Memori database berpartisi UUID**: Menambahkan kolom dan primary key `session_id` pada `assistant_conversation_memory` melalui migrasi `20261112_assistant_memory_session_uuid.sql`; ringkasan sesi paralel kini tersimpan terpisah.
- **Session UUID, typo tolerance, dan anti-looping chatbot**: Endpoint chat menerima `session_id` UUID dari body/header, event menyimpan identitas sesi, dan UI memakai UUID terpisah per percakapan. Filter awal hanya menahan prompt injection, system probe, dan pelanggaran cross-tenant; typo seperti sapaan gabung diteruskan. Grounding RAG menerima angka hasil penjumlahan yang bersumber dari konteks sesi, sementara klaim stok individual dan PO tetap diverifikasi.
- **Sentralisasi fixture dan kosakata pengujian ke bank data**: Semua contoh pesan guardrail, identitas, sapaan, intent tur, penolakan, kebocoran internal, dan kebijakan stok pada test assistant dipindahkan ke `ai/data/mega_data_word/tests/*.json`. Test memakai loader fixture bersama, sedangkan penyaringan sapaan singkat pada memori sesi membaca `dictionary/courtesy_phrases.json` agar kosakata tidak di-hardcode di source.
- **Perbaikan impor statis `run_context` pada modul retraining AI**: `ai/retraining/train.py` dan `ai/retraining/chart_data.py` kini menambahkan `ai/` ke `sys.path` (dengan pengecekan duplikasi) dan memakai `from jobs.run_context import ...` agar resolusi modul statis (Pyrefly/Pyright) serta runtime dari berbagai working directory berjalan konsisten. Validasi `py_compile`, smoke test `test_pipeline.py`, `test_csv_handoff` (4/4), `test_evaluate_stockout` (2/2), dan `test_guardrails` (10/10) lulus.
- **Analisis seluruh mitra dan empat artefak kategori**: Data Science tidak lagi bergantung pada mitra yang memiliki log; query membentuk seluruh mitra aktif × produk resmi dan memberi nilai nol untuk periode tanpa laporan. Run menghasilkan empat JSON kategori untuk kartu produk, mitra, wilayah, dan disiplin pelaporan. Modal AI Insights menampilkan file kategori sebelum Admin melanjutkan analisis AI.
- **Flow Admin akhir minggu untuk Data Science dan AI Insights**: Admin kini dapat membuat laporan Data Science langsung dari tab Log & Data, meninjau JSON/CSV/Markdown pada modal AI Insights, lalu melanjutkan pemrosesan AI dari file run yang sama. Progres job Naive Bayes, evaluasi, alokasi, training `daisuki.pkl`, grafik, dan validasi ditampilkan per langkah. API artifact preview dan otorisasi Admin untuk membuat/memproses run ditambahkan.

### 2026-11-11
- **Implementasi Alur Run Data Science → AI → RAG**: Role tim dan halaman `/analysis` memisahkan pembuatan, persetujuan, pemrosesan, dan rollback laporan. Run privat berisi manifest SHA-256; job AI mengonsumsi run yang sama dan menerbitkan rekomendasi/model/fakta setelah validasi. Evaluasi historis menjaga skor Naive Bayes yang belum terkalibrasi tetap eksploratif. Snapshot per mitra dipindahkan ke direktori privat; retrieval RAG publik memakai alias parafrasa dan versi sumber. Jadwal mingguan membuat draft saja. Migrasi PostgreSQL berhasil dan run historis 424 baris lolos validasi tanpa publikasi.
- **Rencana Penyempurnaan Pipeline Data Science, AI, dan RAG**: `docs/PLANNING_PENYEMPURNAAN_PIPELINE_DS_AI_RAG.md` mendefinisikan tahapan privasi, run Data Science yang disetujui, inferensi/training yang dapat diulang, evaluasi risiko, peningkatan RAG dan guardrail, serta jadwal dan rollback. README AI/Data Science ditautkan; implementasi ditunda.
- **Dokumentasi Flow Mingguan Data Science → AI → RAG**: README `data-science/`, `ai/`, dan `ai/data/` memetakan serah terima laporan, urutan job inferensi/training/grafik, lokasi artefak dan batas akses, serta membedakan classifier `daisuki.pkl`, pengetahuan RAG, dan pola regex guardrail. Status tombol Admin saat ini dan belum adanya role/jadwal mingguan khusus Data Science dicatat secara eksplisit.
- **Agregasi mingguan Data Science dan inferensi AI terpisah**: CLI `data-science/src/weekly_analytics_aggregator.py` menghasilkan laporan JSON/CSV/Markdown dari PostgreSQL read-only untuk lima kategori analitik. Naive Bayes, alokasi, fakta mingguan, grafik, dan training membaca laporan itu; job agregasi AI lama dihapus dan pipeline tombol admin menjalankan urutan baru. Empat kartu admin diselaraskan dengan periode laporan, dan konteks chatbot mitra tidak lagi memuat daftar mitra/wilayah lain. `daisuki.pkl` dilatih ulang dari 424 pasangan mitra-produk. Validasi: 51 tes asisten, 6 tes Python terkait, typecheck, dan sinkronisasi laporan/model lulus. Laporan privat tidak masuk Git.

### 2026-11-10
- **Penutupan Chat Mitra Tanpa Timeout 9Router**: Ringkasan tujuan sesi saat `POST /assistant/mitra/end` kini dibentuk dari pesan mitra yang sudah ada, lalu disimpan ke memori PostgreSQL tanpa request LLM tambahan. Ini menghilangkan penantian timeout lokal dan tunnel saat chat ditutup sambil mempertahankan konteks percakapan. Tes asisten 51/51 dan typecheck lulus. Reset SSE `/events` saat API restart di mode dev tetap dipulihkan oleh koneksi ulang klien.
- **Handoff CSV Data Science ke Training AI**: `cleaned_inventory_summary.csv` yang disalin ke `ai/data/raw_references/csv/` divalidasi terhadap skema, angka, pasangan mitra-produk, dan katalog resmi; CSV yang diperbarui dalam 7 hari terakhir dipakai untuk training risiko `daisuki.pkl`, sedangkan CSV lama atau yang tidak ada memakai PostgreSQL. Training menghasilkan `ai_analysis_summary.csv` agregat tanpa identitas cabang di raw references dan dokumen mainbrain privat. Tombol admin Log & Data menampilkan sumber training. CSV dan dokumen hasil ekstraksi privat tidak otomatis diakses RAG mitra. Panduan handoff dan tes integrasi ditambahkan; 4 tes CSV, 10 tes guardrail Python, 51 tes asisten, dan typecheck lulus.
- **Seluruh Aset AI Dipusatkan di `ai/data/`**: Memindahkan referensi mentah, kamus intent, pengetahuan RAG, snapshot analitik, dan model lokal dari root `data/` ke `ai/data/`; memindahkan digest analitik dari root `ai/` ke `ai/data/mainbrain/context_embeddings/`. Semua path API, worker Python, guardrail, retraining, dan job analitik diperbarui. `ai/requirements.txt` menjadi daftar dependensi tunggal termasuk `matplotlib`; requirements retraining menunjuk ke daftar itu. README setup AI diperbaiki untuk perintah dari folder `ai/`. Validasi: tes asisten 51/51, guardrail Python 10/10, smoke test retraining, dan typecheck lulus.
- **Penambahan Korpus Pelatihan dan Kebijakan RAG Mitra**: Menambahkan tujuh berkas frasa intent di `data/mega_data_word/intent/training/` (70 frasa baru; total 213), tiga dokumen pengetahuan publik untuk aturan stok, SOP mitra, dan identitas asisten, serta `rag_policy.json` untuk daftar sumber RAG yang disetujui dan penyaringan konten sensitif. Loader TypeScript dan Python memakai berkas intent yang sama; classifier intent `daisuki.pkl` lokal diperbarui tanpa melatih ulang model risiko. Panduan lokasi data dan cara pembaruan model ditambahkan. Validasi: 51/51 tes asisten, 10/10 tes guardrail Python, dan typecheck lulus.
- **Sentralisasi Dependensi & Dokumentasi Workspace AI (`ai/requirements.txt` & `ai/README.md`)**: Merestrukturisasi dependensi Python workspace AI ke `ai/requirements.txt` (termasuk `scikit-learn`, `numpy`, `pandas`, `psycopg[binary]`, `python-dotenv`, `pypdf`, `python-docx`, `httpx`, dan `python-telegram-bot`). Menyediakan dokumentasi lengkap peran tiap library, panduan setup multi-shell (PowerShell, CMD, Git Bash/Linux), dan perintah operasional utama (`train.py`, `test_guardrails.py`, `inference_worker.py`) di `ai/README.md`.
- **Pemisahan Data Chatbot ke Workspace `/data`**: Memindahkan PDF referensi, dokumen mainbrain, snapshot analitik, profil perusahaan, dan artefak lokal `daisuki.pkl` ke hierarki root `data/`. Kamus intent, filter keamanan, alias produk, contoh training, aturan bisnis, dan teks cadangan kini berada di JSON/TXT terpisah. API memakai loader `Set` dan RegExp terkompilasi yang dicache saat proses hidup; dokumen publik diindeks berdasarkan kata untuk retrieval RAG. Pipeline Python membaca sumber yang sama. Seluruh pembaca model, snapshot, dan dokumen diperbarui ke path baru. Ekstraksi tidak otomatis memublikasikan PDF; tanpa `pypdf`, PDF dilewati agar byte mentah tidak masuk mainbrain. Memori percakapan tetap terisolasi di PostgreSQL. Respons yang sudah lolos guardrail dikirim ke UI melalui SSE. Uji asisten 50/50, pembaca SSE 1/1, guardrail Python 10/10, dan typecheck lulus.
- **Dukungan Variasi Kata & Typo Tolerant untuk Pertanyaan Log & Konsumsi Stok**: Memperbaiki regex istilah operasional (`operationalTerms`) dan pengenal intensi (`intentPatterns`) di `knowledge.ts` agar mendukung akhiran plural/imbuhan Indonesia (`logs`, `stoknya`, `pesananku`), variasi typo (`haisl`, `minggukemaren`), serta kata analisis numerik (`totalkan`, `hitung`, `rekap`). Menambahkan data konsumsi minggu kemarin (`consumption_prev_7d`) dan agregat total pada `buildMitraRagFacts` serta memperluas limit log mutasi dari 3 menjadi 10 baris pada `context.ts` agar LLM lokal 9Router dan fallback dapat menjawab rekapitulasi data log tanpa tertolak guardrail.
- **Identitas Daisuki AI pada Chatbot Mitra**: Menyatukan perkenalan diri asisten untuk pertanyaan seperti "kamu siapa", "siapakah dia", "diri nya apa", dan "chatbot ini siapa"; menyimpan identitas yang sama di metadata model `daisuki.pkl` dan prompt RAG. Menambah contoh intent, memperbarui classifier lokal tanpa mengubah model risiko atau data stok, serta memvalidasi jawaban 9Router agar pertanyaan identitas tetap menyebut Daisuki AI. Seluruh 47 tes asisten dan typecheck lulus.
- **Perbaikan Pre-Guardrail Chatbot untuk Sapaan & Chit-Chat Alami**: Memperluas filter keramahan (*courtesy & chit-chat*) pada `apps/api/src/modules/assistant/guardrails.ts` dan `knowledge.ts` agar pesan pembuka santai (seperti *"gimana kabar anda"*, *"apa kabar"*, *"halo apa kabar"*, *"kamu sehat"*) tidak lagi dicegat oleh regex out-of-scope lokal dan dapat diteruskan langsung ke 9Router LLM lokal. Menambahkan pengenalan profil pengembang (Hudzaifah Ar-Rantisi) dan mengekspor dokumen mainbrain publik (`CV-Hudzaifah_Ar-Rantisi.public.md`) agar asisten dapat mengenali latar belakang teknis tim secara dinamis melalui RAG.
- **Chatbot Mitra dengan Profil Perusahaan, SOP, dan Mainbrain Publik**: Menghubungkan basis pengetahuan `ai/data/company_knowledge.json` dan cuplikan relevan `ai/data/mainbrain/*.public.md` ke endpoint chat 9Router, dengan jawaban cadangan bernomor untuk panduan operasional. Menambahkan tren produk/wilayah agregat tanpa identitas cabang lain, penolakan permintaan data lintas mitra, serta validasi angka operasional dari fakta database. Pembaca mainbrain Python kini juga hanya mengambil dokumen bertanda publik; CV dan hasil ekstraksi internal tidak otomatis dikirim ke chatbot. Memperbaiki keterangan SOP resi dan waktu reservasi stok pusat agar sesuai alur aplikasi. Tes asisten 43/43 dan typecheck lulus.
- **Mainbrain Document Generator (`ai/data/mainbrain/`)**: Mengimplementasikan pipeline *Universal Document Ingestion* pada `ai/retraining/doc_loader.py` dan `ai/retraining/train.py`. Sistem secara otomatis memindai seluruh dokumen di `ai/data/` (PDF, DOCX, JSON, CSV, TXT, MD) dan menghasilkan 1-to-1 file Markdown terstruktur di `ai/data/mainbrain/*.md` dalam satu perintah training (`python ai/retraining/train.py`). Prompt RAG di `ai/guardrails/prompt.py` kini secara dinamis membaca seluruh dokumen mainbrain sebagai basis pengetahuan cerdas untuk LLM lokal via 9Router.
- **Sentralisasi Data AI Workspace di `ai/data/`**: Memindahkan dan menyatukan file basis pengetahuan resmi perusahaan ke `ai/data/company_knowledge.json` dan menambahkan dokumentasi `ai/data/README.md`. Memperbarui pembangun prompt `ai/guardrails/prompt.py` agar secara dinamis memuat fakta profil PT Daisuki Pangan Indonesia dan prosedur SOP langkah-demi-langkah (termasuk alur scan resi dan batas isolasi multi-tenant) langsung dari folder pusat data `ai/data/`.
- **Knowledge Base Resmi Perusahaan & SOP Operasional untuk Otak AI**: Membuat basis pengetahuan resmi perusahaan dan SOP langkah-demi-langkah di `ai/guardrails/company_knowledge.json` dan `docs/KNOWLEDGE_BASE_PERUSAHAAN_DAN_SOP.md`. Menyediakan fakta statis terverifikasi (PT Daisuki Pangan Indonesia, tahun berdiri 2023, 4 produk resmi: Seblak Jadul Instan, Basreng Daun Jeruk, Makaroni Daun Jeruk, Keripik Pisang Rasa Coklat, visi/misi, jam operasional), alur step-by-step scan barcode/resi pengiriman (`DLV-XXXXXXXX`), SOP lapor stok harian, pengajuan restock, serta kebijakan ketat isolasi tenant agar LLM dapat menjawab pertanyaan umum dan tutorial secara luwes tanpa membocorkan data rahasia antar-mitra.
- **Peningkatan UI & Detail Modal Cetak Dokumen / Resi Logistik**: Memperbarui modal pratinjau cetak resi (`DeliveryReceiptModal` di [apps/web/src/components/inventory/delivery-receipt-modal.tsx](apps/web/src/components/inventory/delivery-receipt-modal.tsx)) menjadi studio pratinjau dokumen (*authentic paper preview*). Menggabungkan tombol salin kode surat jalan dan switcher format cetak ke dalam satu *unified action toolbar*, memperjelas lembar pratinjau A4 dengan kop resmi Daisuki Distribution, kotak informasi pengiriman & penerima 2 kolom, tabel muatan lengkap dengan kolom SKU dan cek fisik, tata letak QR Code verifikasi dan Barcode Code-128 yang proporsional, kolom tanda tangan resmi 3 pihak (Admin Gudang, Kurir Logistik, dan PIC Mitra), serta menyelaraskan warna tombol cetak dari `bg-ume` menjadi `bg-ink-900` sesuai pedoman token Daisuki.
- **Redesain Antislop Modal Persetujuan Pesanan Admin**: Merefaktor tampilan item produk pada modal persetujuan restock mitra (`OrderApprovalModal` di [apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx)) dari sindrom kotak bersarang (*nested box syndrome*) dan teks redundan menjadi **Compact Product Strip**. Mengeliminasi 4 sub-box kaku dan teks mubazir (*"Jumlah diajukan cabang"*, *"Tersedia untuk disetujui"*, *"Status Alokasi"*), menyatukan fakta sisa stok cabang, stok pusat bebas, dan estimasi tiba ke dalam satu baris metadata ringkas dan fokus, serta menata kolom permintaan dan kontrol stepper persetujuan secara proporsional sehingga tinggi kartu berkurang drastis dan seluruh daftar produk dapat ditinjau tanpa scrolling berlebih.
- **Respons Chatbot Saat Worker Python Lambat**: Memulai worker `daisuki.pkl` saat API menyala, menambah waktu startup internal worker, dan membatasi waktu tunggu klasifikasi/prediksi pada request chat agar retrieval PostgreSQL serta 9Router tetap berjalan saat model belum siap. Kegagalan model kini dicatat singkat tanpa stack trace. Seluruh 38 tes asisten dan typecheck lulus.

### 2026-11-09
- **Guardrail Chatbot Mitra & Pelatihan Intent**: Menegakkan batas topik dan isolasi data cabang sebelum memanggil 9Router, menolak upaya pembocoran instruksi internal, serta memeriksa respons LLM untuk detail sistem. Prompt RAG kini menyebut kewenangan baca-saja, status stok dan pesanan, serta penolakan di luar inventaris. Jawaban cadangan memakai data cabang sendiri untuk stok pusat dan konsumsi produk. Pipeline intent `daisuki.pkl` dilatih dengan prior kelas seimbang agar sapaan tetap dikenali setelah contoh identitas bertambah; artefak telah dilatih ulang dari data operasional dan 36 tes asisten lulus. Katalog produksi tetap mengikuti empat produk yang tercatat dalam database sambil menunggu keputusan perubahan katalog.
- **Dedicated Workspace AI Guardrails & Context Grounding**: Membuat modul workspace Python baru di `ai/guardrails/` (`rules.py`, `threats.py`, `faithfulness.py`, `prompt.py`, `pipeline.py`, `test_guardrails.py`, dan `README.md`) yang mengimplementasikan sistem pertahanan 4-layer untuk chatbot RAG lokal via 9Router. Mencakup filter Pre-guardrail terhadap Prompt Injection, Jailbreak, dan Probe data internal; generator Master Unified System Prompt berbasis FAKTA_JSON; serta Post-guardrail validator untuk verifikasi Context Grounding angka numerik, nomor PO, larangan batas plafon 40 pcs (*unbounded stock*), larangan klaim mutasi sepihak, dan pembatasan 4 produk resmi Daisuki.
- **Penanaman Identitas Diri Resmi ke dalam Model daisuki.pkl**: Menanamkan metadata identitas diri AI (`name`, `role`, `algorithm: Multinomial Naive Bayes`, `specialization`, `supported_products`, dan `identity_bio`) langsung ke dalam bundle serialisasi biner `daisuki.pkl`. Menambahkan intent `"identity"` pada `ai/retraining/source.py` dan `ai/retraining/train.py`, memperbarui `ai/retraining/filter.py` dan `inference_worker.py` untuk mengekstrak serta mengekspos metadata model, mengintegrasikan deteksi intent `identity` pada `knowledge.ts`, `compose.ts`, serta konteks referensi `rag-prompt.ts`, sehingga chatbot dapat memperkenalkan dirinya secara akurat, mandiri, dan konsisten saat ditanya oleh mitra (*"kamu siapa"*, *"apa itu daisuki.pkl"*).
- **Memori Sesi Chatbot Mitra**: Menambahkan memori percakapan sementara per mitra dan pengguna di server, pemulihan sesi saat API dimulai ulang, konteks lima percakapan terakhir untuk 9Router, endpoint akhir sesi yang merangkum tujuan mitra ke tabel PostgreSQL `assistant_conversation_memory` lalu membersihkan pesan mentah sesi, serta tombol tutup chat yang menyimpan konteks. Memori tidak dipakai sebagai bukti angka stok atau status pesanan; fakta operasional tetap dari database dan prediksi `daisuki.pkl`. Aksi hapus riwayat juga menghapus memori tersimpan. Migrasi telah diterapkan dan 30 tes asisten lulus.
- **Perbaikan Koneksi Chatbot 9Router**: Semua pesan mitra, termasuk sapaan dan pesan uji, kini mengambil konteks mitra dan mencoba model `opn` melalui 9Router. Klien memakai respons streaming SSE agar jawaban dapat selesai dalam batas 8 detik, dengan fallback lokal saat proxy gagal atau lambat. Tes asisten dan uji langsung endpoint lokal berhasil.
- **RAG Chatbot Mitra dengan 9Router**: Menambahkan retrieval fakta PostgreSQL khusus mitra dan empat produk resmi, konteks prediksi `daisuki.pkl`, prompt terstruktur, klien 9Router local/tunnel dengan batas waktu serta fallback template, validasi angka/PO respons, metadata sumber jawaban di riwayat, dan tampilan Markdown aman dengan badge sumber AI. Kunci API disimpan di `.env` lokal; contoh dan dokumen memakai placeholder.
- **Grafik Analisis Python pada Log & Data**: Menambahkan tombol untuk menjalankan pipeline Python dari API admin, progres tiap skrip, grafik garis konsumsi stok fisik harian 14 hari dari log nyata, serta ringkasan klasifikasi risiko `daisuki.pkl` setelah pelatihan. Status pipeline diperbarui selama proses berjalan.
- **Perbaikan Error 42703 pada Daftar Mitra**: Menerapkan migrasi `20261109_partner_type_other.sql` pada database Neon yang dipakai API dan memverifikasi kolom `partners.type_other` tersedia sebagai `text`.
- **Jenis Perusahaan Lainnya Dapat Diisi Manual**: Form Tambah/Ubah Mitra menampilkan input wajib saat kategori `lainnya` dipilih; API memvalidasi dan menyimpan teks pada `partners.type_other`, lalu daftar dan detail mitra menampilkan nilainya. Skema Neon dan migrasi kolom baru turut ditambahkan.
- **Dinamis Button Simpan Profil Mitra**: Mengubah tombol "Simpan profil" di portal Mitra ([apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx)) agar memiliki state dinamis berdasarkan perubahan input form (`hasChanges`). Saat belum ada perubahan data, tombol berstatus nonaktif dengan warna `bg-gray-400 cursor-not-allowed`. Saat terdeteksi perubahan pada nama mitra, PIC, telepon, alamat, wilayah, atau foto profil, tombol otomatis aktif dengan warna hijau `bg-emerald-600 hover:bg-emerald-700 cursor-pointer`.
- **Tab Dalam Pengiriman di Approval dan Pengiriman Admin**: Menambahkan tab baru **"Dalam Pengiriman"** pada sub-navigasi panel *Approval dan pengiriman* (`OrderApprovalPanel`) di [apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx). Memperbarui tipe `OrderCategoryTab` (`'menunggu' | 'dalam_pengiriman' | 'selesai' | 'ditolak'`), memisahkan counter `shippingCount` (`status === 'dalam_pengiriman'`) dan `completedCount` (`['disetujui', 'selesai']`), menyematkan tombol tab bergaya `Truck` icon dengan badge count biru operasional (`bg-blue-600`), menyediakan empty state informatif saat tidak ada barang dalam perjalanan armada logistik, serta menyelaraskan navigasi notifikasi dari alert pesanan baru (`parsed.type === 'new_order'`).
- **Optimalisasi Grid Log Pengiriman Admin di Mobile**: Merefaktor tampilan Log Pengiriman (`ShipmentLogPanel`) di dashboard admin ([apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx)) dari format baris vertikal panjang menjadi **Responsive Card Grid** (`grid-cols-1 md:grid-cols-2`). Di mode mobile (layar HP), informasi teks panjang dipadatkan: tanggal panjang diganti format ringkas (`9 Nov, 14:30 WIB`), daftar rincian nama produk panjang diringkas menjadi ringkasan muatan (`Muatan: X macam produk · Total Y pcs`), badge status logistik dibuat kompak (`Diterima` / `Dikirim`), serta penataan tombol bukti dan navigasi pesanan dirapikan secara horizontal agar kartu tidak memanjang dan nyaman dibaca.
- **Redesain UI Chatbot Asisten Mitra yang Bersih & Fokus**: Memperbarui antarmuka `MitraAiAssistant` ([apps/web/src/components/inventory/mitra-ai-assistant.tsx](apps/web/src/components/inventory/mitra-ai-assistant.tsx)) agar tampil lebih bersih, modern, dan bebas distraksi. Menambahkan backdrop lembut (`backdrop-blur-[2px] bg-ink-950/20`) saat chat dibuka untuk memfokuskan mata pengguna ke percakapan, memperbesar dimensi kartu dialog (lebar 440px di desktop, tampilan penuh responsif di mobile), memperbarui tombol pemicu mengambang dengan indikator status aktif pulsing hijau, membersihkan header dengan avatar ikonik dan indikator online, menyederhanakan bubble percakapan bergaya Apple Messages, menyematkan avatar asisten mini pada setiap jawaban, menghapus teks disclaimer statis yang memakan ruang vertikal, serta mendesain ulang input bar menjadi bentuk kapsul modern dengan tombol kirim terintegrasi.
- **Peningkatan Responsivitas & Eliminasi Stalling Worker Model Chatbot**: Memperbaiki issue timeout berulang 10 detik pada worker model Python Scikit-Learn (`apps/api/src/modules/assistant/model.ts`) dengan menambahkan pelacakan status proses aktif (`client.isDead`), penolakan instan (0ms) saat proses berhenti tanpa memicu timer tunggu yang lama, serta *circuit breaker cooldown* selama 30 detik untuk mencegah loop spawn berulang jika dependensi Python sedang tidak tersedia. Selain itu, mempercepat interval sinkronisasi pesanan aktif mitra ([apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx)) menjadi 4 detik secara adaptif saat ada barang dalam proses/pengiriman agar status pesanan terasa instan dan realtime.

### 2026-11-08
- **AI Insights UI cleanup**: Reworked the four overview cards into compact, accessible summaries with restrained Daisuki colors, simplified the header, kept the detail modals and AI refresh actions, switched charts to 2D donuts, and removed fabricated fallback percentages and regional quantities.
- **Simplifikasi Tab AI Insights Menjadi 4 Grid Kategori & 3D Pie Chart Detail**: Merefaktor antarmuka tab AI Insights admin ([apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx)) yang sebelumnya padat menjadi **4 Grid Card Kategori Utama** responsif (`grid-cols-1 md:grid-cols-2`): (1) *Analisis 4 Produk Paling Laku*, (2) *Analisis Mitra Paling Laku*, (3) *Analisis Wilayah Paling Laku*, dan (4) *Analisis Mitra Paling Aktif Update Stok*. Setiap kartu menampilkan highlight juara #1, metrik operasional kunci, dan pemicu modal. Dibuat komponen modal baru di [apps/web/src/components/inventory/ai-insights-modals.tsx](apps/web/src/components/inventory/ai-insights-modals.tsx) (`ProductSalesDetailModal`, `TopPartnersDetailModal`, `TopRegionsDetailModal`, `ActiveReportingPartnersModal`) yang menyajikan visualisasi **Grafik 3D Pie Chart (`ThreeDPieChart`)** interaktif dan tabel data mendalam. Dokumentasi arsitektur dan prompt instruksi dicatat di [docs/PROMPT_AI_INSIGHTS_4_GRID.md](docs/PROMPT_AI_INSIGHTS_4_GRID.md).
- **Mitra navbar border**: Strengthened the floating navigation outline using translucent `ink-700` border and ring tokens so its capsule remains visible on light backgrounds.
- **Agregasi per Mitra & Modal Detail pada Risiko Stok Cabang AI Insights**: Mengubah tampilan tabel "Risiko stok cabang" di tab AI Insights ([apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx)) dari yang sebelumnya me-loop baris berulang per produk (sehingga mitra yang sama muncul berkali-kali) menjadi **1 baris ringkas per mitra cabang**. Menambahkan komponen modal baru `PartnerDeficitModal` ([apps/web/src/components/inventory/partner-deficit-modal.tsx](apps/web/src/components/inventory/partner-deficit-modal.tsx)) yang terbuka saat baris mitra diklik, menampilkan rincian seluruh produk bermasalah/kategori berisiko, sisa stok, cakupan hari, akar masalah, serta rekomendasi tindakan solusi AI khusus untuk cabang tersebut.
- **Admin AI Insights layout refactor**: Reordered operational metrics, attention table, regional donut, product share, and partner performance; compacted filters, grouped missing locations into a banner, and kept deficit, factory, weekly facts, and AI API flows intact.
- **Perbaikan Input Counter Stok (Eliminasi Leading Zero '010')**: Mengganti input native `type="number"` dengan komponen terkontrol `NumericStockInput` pada Laporan Harian dan Form Restock Mitra ([apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx)). Mengatasi bug browser saat nilai awal `0` diubah menjadi angka lain (seperti `10`) yang sebelumnya memunculkan `010` karena browser tidak memperbarui string teks input jika nilai numeriknya dianggap sama. Kini saat input berfokus pada angka `0`, teks otomatis dikosongkan/diseleksi, input memvalidasi dan memangkas leading zero via regex (`/^0+(?=\d)/`), serta menghilangkan tombol panah stepper bawaan browser yang bertumpuk dengan tombol counter minus/plus.
- **Grid Layout Laporan Harian Stok Mitra**: Mengubah tampilan daftar "Stok Saya" pada Laporan Harian di portal Mitra ([apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx)) dari format baris vertikal (*vertical list divide-y*) menjadi **Grid Card Layout responsif** (`grid-cols-1 sm:grid-cols-2`). Setiap produk kini tampil dalam kartu mandiri berbingkai dengan header status, display sisa stok numerik besar, highlight visual dinamis saat kuantitas diubah, dan tombol counter sentuh (`min-h-11`) yang ringkas dan efisien tanpa memakan ruang vertikal berlebih.
- **Perbaikan Animasi & Clipping Apple Liquid Glass**: Memperbaiki bug animasi tab yang membeku di index awal dan clipping border navbar pada Admin dan Mitra ([apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx), [apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx), [apps/web/src/styles.css](apps/web/src/styles.css)). Memindahkan transform kalkulasi animasi dari inline string Tailwind yang rapuh ke utilitas CSS terkompilasi (`.liquid-pill-active-x`, `.liquid-pill-hover-x`, `.liquid-pill-active-y-48`, `.liquid-pill-hover-y-48`, `.liquid-pill-active-mitra`), menambahkan `overflow-hidden` pada container `nav` agar kapsul aktif melengkung sempurna mengikuti kurva kaca tanpa keluar dari border luar navbar, serta memastikan tab yang aktif (seperti "Mitra") selalu terlapisi kapsul gelap kontras di posisi yang presisi.

### 2026-11-07
- **Apple Liquid Glass Navigation (Mitra & Admin)**: Menerapkan estetika navigasi Apple iOS / iPhone *Liquid Glass* ke portal Mitra dan dashboard Admin ([apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx), [apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx), [apps/web/src/styles.css](apps/web/src/styles.css)). Memperbaiki bug delay/lag saat kursor bergerak atau berpindah antar menu dengan mengisolasi komponen `AdminFloatingNavbar` ke sub-komponen mandiri (sebelumnya state hover berada di root `AdminDashboard` sehingga me-re-render seluruh 3.600 baris dashboard pada setiap gerakan mouse), mengganti kurva overshoot memantul dengan kurva *Apple fluid deceleration* yang mulus (`duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]`), akselerasi perangkat keras GPU (`transform-gpu will-change-transform`), menyelaraskan transisi warna teks (`transition-colors duration-200`), serta penyesuaian token gradient `--color-ink-950` agar warna tab aktif tidak memudar/transparan di sisi kanan.
- **Button Keluar Hover Styling**: Memperbarui efek hover pada tombol "Keluar" di dashboard Admin (header & sidebar) serta portal Mitra (header & tab profil) menggunakan `hover:bg-crit-bg` dan `hover:text-crit-fg` serta penanda `focus-visible:outline-crit` agar transisi interaktif terlihat jelas dan konsisten dengan token tema bahaya/logout ([apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx), [apps/web/src/routes/mitra.tsx](apps/web/src/routes/mitra.tsx)).
- **Admin Order Rejection**: Menghapus form ganda (*double form*) saat admin menolak pesanan restock di modal persetujuan. Form penolakan kini terisolasi, dilengkapi template alasan cepat, counter karakter, dan tombol aksi terintegrasi ([apps/web/src/routes/admin.tsx](apps/web/src/routes/admin.tsx)).
- **Cetak Surat Jalan & Resi Pengiriman**: Memperbaiki modal cetak resi logistik agar mendukung format resmi **Surat Jalan A4** (lengkap dengan kop resmi, tanda tangan 3 pihak, rincian barang, dan verifikasi QR/Barcode) serta opsi struk thermal 80 mm via isolasi iframe print engine ([apps/web/src/components/inventory/delivery-receipt-modal.tsx](apps/web/src/components/inventory/delivery-receipt-modal.tsx)).
- **Perencanaan Optimasi SSE & Cache**: Membuat rencana teknis [planing.md](planing.md) untuk meniadakan polling berulang dan menerapkan event-driven query cache dengan TanStack Query dan Server-Sent Events (SSE).
- **Protokol Log Perubahan**: Menerapkan aturan wajib baca dan pencatatan log harian otomatis pada [CLAUDE.md](CLAUDE.md) dan [AGENTS.md](AGENTS.md).
