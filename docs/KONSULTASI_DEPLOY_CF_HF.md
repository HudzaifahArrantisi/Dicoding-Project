# Konsultasi: Deploy Daisuki Inventory ke Cloudflare Workers dengan Model di Hugging Face

Dokumen ini untuk dikirim ke AI lain sebagai bahan konsultasi. Ditulis agar dapat
dipahami **tanpa akses ke repositori**. Setiap klaim ditandai sumbernya: hasil
pembacaan kode, hasil pembacaan dokumentasi resmi, atau asumsi yang belum diuji.

---

## 1. Ringkasan masalah

Saya punya aplikasi B2B inventory & order management (monorepo Bun). Rencana saya:

- **Frontend + backend API → Cloudflare Workers**
- **Model machine learning → Hugging Face**, dipanggil lewat HTTP
- **Biaya: gratis** (plan gratis CF dan HF)

Yang ingin saya konsultasikan: **apakah rencana ini mungkin, dan bagaimana caranya
paling efisien.**

---

## 2. Susunan proyek

```
daisuki-inventory/                     (Bun monorepo)
├── apps/
│   ├── web/          Frontend: TanStack Start, React 19, Vite, Tailwind v4
│   └── api/          Backend: ElysiaJS, Drizzle ORM, Jose JWT, driver `postgres`
├── packages/shared/  Tipe & state machine bersama
├── ai/               Workspace Python
│   ├── retraining/   train.py, filter.py, knowledge_index.py, dll
│   ├── jobs/         7 job pipeline analisis mingguan
│   └── data/         Model, indeks RAG, kamus intent, PDF referensi
├── data-science/     Agregator mingguan (Python, psycopg)
└── neon/             Skema & 12 migrasi SQL
```

**Runtime yang dibutuhkan:**

| Bagian | Runtime |
|---|---|
| `apps/web` | Node/Bun (SSR) + browser |
| `apps/api` | **Bun** (Elysia) |
| Worker model | **Python + scikit-learn** |
| Pipeline training | **Python + psycopg + pypdf** |

**Layanan eksternal:** PostgreSQL di Neon, LLM di 9Router (OpenAI-compatible).

---

## 3. Isi model `daisuki.pkl`

Berkas tunggal 10,3 MB, berisi bundle `pickle`:

| Kunci | Isi | Sifat |
|---|---|---|
| `intent` | sklearn `Pipeline` — classifier intent pesan | — |
| `risk` | sklearn `Pipeline` — classifier risiko stok | — |
| `retrieval` | 72 cuplikan dokumen publik | publik |
| `analysis_retrieval` | 644 baris analisis per cabang mitra | **privat** |
| `raw_pdf_retrieval` | 387 cuplikan CV, karya ilmiah, jurnal | **privat** |
| `metadata`, `shared_summaries`, `public_knowledge` | Metadata identitas & ringkasan | campuran |

Dibuat dengan **scikit-learn 1.7.2** dan **numpy 2.2.6** (dipin; pickle sklearn
sensitif versi).

**Catatan penting:** indeks retrieval tersimpan **di dalam** berkas `.pkl`.
Saat inference, model tidak membaca berkas Markdown sama sekali.

---

## 4. Batasan Cloudflare Workers — hasil pembacaan kode

Ini yang saya temukan setelah membaca kode API. **Belum satu pun saya uji dengan
deploy.**

### 4.1 Lima modul membaca berkas saat impor (akan crash saat boot)

| Berkas | Baris | Yang dipanggil |
|---|---|---|
| `lib/storage.ts` | 12-17 | `mkdirSync` — diimpor langsung oleh `index.ts:11` |
| `modules/assistant/guardrails.ts` | 8-10 | `readFileSync` 3 berkas kebijakan |
| `modules/assistant/word-loader.ts` | 30, 50, 58 | `readdirSync` + `readFileSync` |
| `modules/assistant/assistant-copy.ts` | 17 | `readFileSync` |
| `modules/assistant/company-knowledge.ts` | 30 | `readFileSync` |

Ini level-modul, bukan level-fungsi. Artinya **proses gagal start**, bukan
sekadar kehilangan fitur.

### 4.2 Pola khusus Bun

- `index.ts:250-254` memakai `.listen({ port, hostname, idleTimeout })` —
  Workers tidak punya server yang mendengarkan port; entry point harus
  berbentuk `export default { fetch }`.
- `index.ts:230-248` memakai `@elysiajs/cron` (timer). Workers memakai handler
  `scheduled()`.
- **20 berkas memakai `import.meta.dir`**, tidak tersedia di Workers.

### 4.3 Kebutuhan lain

| Kebutuhan | Sekarang | Perlu di Workers |
|---|---|---|
| PostgreSQL | driver `postgres`, opsi `{ prepare: false }` | Hyperdrive? |
| Upload resi & foto profil | tulis ke `apps/api/uploads/` di disk | R2? |
| Filesystem `/tmp` | ada | tidak ada |
| `Bun.spawn` untuk Python | ada (worker model + 7 job) | tidak ada |

### 4.4 Yang sudah ada

- `apps/web/wrangler.jsonc` sudah ada (`compatibility_date: 2025-09-02`,
  `compatibility_flags: ["nodejs_compat"]`).
- `@cloudflare/vite-plugin` sudah terpasang di `vite.config.ts`.
- `apps/api` **belum punya** `wrangler.jsonc` sama sekali.
- Ada `Dockerfile.api` di root (Bun + Python 3.11 + scikit-learn dalam satu image).

---

## 5. Batasan Hugging Face — hasil pembacaan dokumentasi resmi

### 5.1 Spaces

Kutipan langsung dari dokumentasi HF Spaces:

> "The default CPU Basic hardware has no hourly cost, but **creating a Space that
> runs on compute (Gradio or Docker) requires a paid plan**, while Static Spaces
> are free for everyone."

> "Static Spaces are free for everyone. **Gradio and Docker Spaces run on compute
> and require a paid plan to create:** PRO for personal accounts, Team or
> Enterprise for organizations. Free personal accounts in good standing can still
> host up to **2 Gradio Spaces** running on ZeroGPU."

**Kesimpulan:** RAM bukan masalah (CPU Basic memberi 2 vCPU / 16 GB, dan model
saya butuh ~300 MB). Blocker-nya adalah **hak membuat Space berbayar**. Saya sudah
mencoba dan menerima `HTTP 402 Payment Required`.

**Yang belum saya verifikasi:** apakah kuota "2 Gradio Spaces" untuk akun gratis
berlaku untuk Space CPU biasa (bukan hanya ZeroGPU), dan apakah FastAPI yang
di-mount ke dalam app Gradio lewat `gr.mount_gradio_app` tetap menerima `POST`
dari luar. Kalau ya, ini mungkin jalur gratis.

### 5.2 Jobs

- Butuh **saldo kredit positif**; kredit bulanan hanya dari PRO/Team/Enterprise.
- `cpu-basic` $0.01/jam + exposed ports $0.01/jam = **~$14,60/bulan** untuk 24/7.
- Default timeout **30 menit**; filesystem **dihapus saat job berakhir**.
- Dirancang untuk batch, bukan server persisten.

**Kesimpulan:** lebih mahal dari PRO $9/bulan.

### 5.3 Repo model

Repo model privat **gratis** dan sudah berhasil saya buat.

---

## 6. Yang sudah saya kerjakan

Semua ini **belum diuji runtime** — hanya ditulis berdasarkan pembacaan kode.

**1. Jalur ganda di `apps/api/src/modules/assistant/model.ts`**

```ts
function getOrStartWorker(): Worker | null {
  if (BRIDGE_URL) {                      // RAG_BRIDGE_URL diisi
    if (!currentWorker || currentWorker.isDead) currentWorker = createRemoteWorker();
    return currentWorker;                // Bun.spawn TIDAK pernah dieksekusi
  }
  // ... jalur Python lokal lama
```

Dua implementasi dengan antarmuka sama (`send`/`stop`/`isDead`). Kalau
`RAG_BRIDGE_URL` kosong, perilaku lama tidak berubah. Runtime tanpa `Bun.spawn`
kini mematikan fitur model dengan satu peringatan, bukan error saat impor.

**2. `deploy/hf-space/app.py`** — FastAPI dengan 4 endpoint, meniru perilaku
`ai/retraining/inference_worker.py`:

| Endpoint | Fungsi |
|---|---|
| `GET /health` | Kesiapan model & indeks |
| `POST /predict` | Label risiko stok |
| `POST /understand` | Intent + cuplikan RAG + analisis mitra |
| `POST /reload` | Unduh `daisuki.pkl` terbaru dari Hub |

Token wajib (min 16 karakter), gagal saat start kalau kosong, dibandingkan
dengan `hmac.compare_digest`.

**3. `deploy/hf-train/run-pipeline.sh`** — 7 job analisis berurutan, lalu unggah
model ke repo Hub.

**4. `deploy/prepare.mjs`** — menyalin modul Python dari `ai/` ke staging,
sehingga `ai/` tetap satu-satunya sumber kebenaran.

**5. `deploy/hf-space/Dockerfile`** dan `requirements.txt`.

---

## 7. Temuan teknis yang mungkin mengubah pendekatan

### 7.1 Label risiko dibuat oleh aritmatika, bukan ML

Dari `ai/retraining/source.py`:

```python
cover = qty / daily
if qty <= max(10, buffer * 0.2) or cover < 2 or critical >= 3:
    label = "urgent_restock"
elif has_order or cover < 6 or qty <= buffer * 0.5:
    label = "regular_order"
else:
    label = "normal"
```

Lalu `MultinomialNB` **dilatih dari label buatan rumus itu sendiri**. Artinya
model ML hanya mempelajari tiruan rumus yang sudah ada.

**Implikasi:** memindahkan rumus ini ke TypeScript (~15 baris) justru **lebih
akurat** daripada memakai `daisuki.pkl`, karena tidak ada aproksimasi.

### 7.2 Sebagian besar RAG sudah ada padanannya di TypeScript

| Isi `.pkl` | Padanan TS yang sudah ada di repo |
|---|---|
| `retrieval` | `indexMainbrain()` di `modules/assistant/company-knowledge.ts:120` |
| `analysis_retrieval` | dari PostgreSQL, bukan dari model |
| `raw_pdf_retrieval` | sumber `.public.md`, sudah ada loader-nya |
| `intent` | `modules/assistant/word-loader.ts` (frasa exact + regex) |

Dan `company-knowledge.ts:86-87` sudah punya fallback otomatis:

```ts
if (relevant.length) return { documents: relevant, memory: "daisuki.pkl" };
const fallback = markdown.slice(0, 4);
return { documents: fallback, memory: fallback.length ? ".public.md" : "none" };
```

**Implikasi:** sistem sudah dirancang untuk tetap jalan saat biner tidak
tersedia. Ini membuka opsi menghapus ketergantungan Python sepenuhnya untuk
inference — dengan konsekuensi akurasi intent turun (ML → regex).

---

## 8. Pertanyaan untuk dikonsultasikan

1. **Apakah ElysiaJS bisa berjalan di Cloudflare Workers?** Saya belum menemukan
   bukti proyek ini pernah mengujinya. Kalau tidak bisa, seluruh rencana ini
   gugur. Apa uji kelayakan paling murah untuk menjawabnya?

2. **Cara terbaik mengganti 5 pembacaan berkas level-modul?** Bundel sebagai
   import statis? Taruh di KV? R2? Mana yang paling sedikit mengubah kode?

3. **Hyperdrive untuk Neon, atau driver `postgres` langsung?** Saat ini memakai
   `{ prepare: false }` untuk PgBouncer Neon.

4. **R2 untuk uploads** — pola apa yang paling sedikit mengubah
   `lib/storage.ts`? Ada abstraksi alternatif?

5. **Cron**: cara paling bersih mengganti `@elysiajs/cron` dengan
   `scheduled()` tanpa menulis ulang `lib/analysis-runs.ts`?

6. **Cloudflare Containers vs migrasi ke Workers.** Apakah Containers lebih
   masuk akal daripada mengubah 20 berkas? Apa rencana minimum untuk
   Containers di Workers Paid?

7. **Jalur Gradio Space gratis** — apakah `gr.mount_gradio_app` dengan FastAPI
   tetap menerima `POST` dari luar pada akun gratis? Apakah direkomendasikan?

8. **Alternatif yang saya lewatkan?** Ada layanan lain yang bisa menjalankan
   FastAPI + scikit-learn gratis dan stabil?

---

## 9. Blocker saat ini

| Blocker | Keterangan |
|---|---|
| **Build web gagal** | `prettier/index.js` hilang di `node_modules`, menggagalkan TanStack Router Generator. Tercatat di changelog proyek. Tanpa build, tidak ada deploy CF sama sekali. |
| **Merge Git belum selesai** | Konflik di `AGENTS.md` dan `CLAUDE.md` belum di-commit. |
| **Model lokal gagal dimuat** | Log menunjukkan `exit code 143` (SIGTERM) — proses worker dibunuh setelah batas 30 detik. Kemungkinan `python` bukan dari `ai/.venv`. |
| **HF Space gagal dibuat** | `HTTP 402` — butuh PRO. |

---

## 10. Pertanyaan yang belum terjawab

- Apakah build deployment web ini berhasil? (belum pernah dijalankan)
- Apakah HF Jobs bisa menjangkau Neon dari jaringannya?
- Apakah bundle web muat batas ukuran Workers?
- Berapa harga Cloudflare Containers dan plan minimumnya?

---

## 11. Yang sudah selesai dan tidak perlu dikonsultasikan

- Repo model privat `candalena/daisuki-model` **berhasil dibuat** di Hugging Face.
- Staging Space berhasil dirakit: 6 modul Python + `daisuki.pkl` (10,3 MB).
- Pemisahan jalur model (bridge HTTP vs Python lokal) sudah terpasang di kode.
