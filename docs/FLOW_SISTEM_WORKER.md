# Flow Sistem per Worker

Dokumen ini memuat diagram Mermaid untuk tiga Worker yang berjalan di Cloudflare:
`daisuki-inventory` (web), `daisuki-api` (backend), dan `daisuki-graph` (monitor).
Semua label memakai istilah yang sama dengan kode di repo.

## 1. Gambaran menyeluruh

```mermaid
flowchart TB
    B["Browser: Admin / Mitra"]
    CF["Cloudflare DNS + Proxy"]

    subgraph WEB["Worker daisuki-inventory"]
        W1["daisuki.my.id"]
    end

    subgraph API["Worker daisuki-api"]
        A1["api.daisuki.my.id/v1"]
    end

    subgraph GRAPH["Worker daisuki-graph"]
        G1["graph.daisuki.my.id"]
    end

    DB[("Neon PostgreSQL")]
    KV[("Cloudflare KV<br/>DAISUKI_MODEL")]
    LLM["LLM provider<br/>LLM_BASE_URL"]
    GHA["GitHub Actions<br/>analysis-pipeline.yml"]
    PIPE["Python: data-science + ai<br/>daisuki.pkl"]

    B --> CF
    CF --> W1
    CF --> A1
    CF --> G1
    W1 -->|"fetch JSON + SSE<br/>cookie sesi"| A1
    G1 -->|"polling status run"| A1
    A1 -->|"Drizzle / SQL"| DB
    A1 -->|"intent + retrieval model"| KV
    A1 -->|"jawaban generatif"| LLM
    A1 -->|"workflow_dispatch"| GHA
    GHA --> PIPE
    PIPE -->|"artefak per run"| DB
    PIPE -->|"daisuki-worker.json"| KV
```

## 2. Worker `daisuki-inventory` (web)

```mermaid
flowchart TD
    REQ["Request HTTP ke daisuki.my.id"] --> SSR["TanStack Start SSR<br/>worker entry"]
    SSR --> ROUTE{"Rute"}

    ROUTE -->|"/login"| LOGIN["Form login"]
    ROUTE -->|"/admin"| ADMIN["Dashboard Admin"]
    ROUTE -->|"/mitra"| MITRA["Portal Mitra"]
    ROUTE -->|"/analysis"| ANALYSIS["Halaman analisis internal"]

    LOGIN -->|"POST /v1/auth/login"| API["API Worker"]
    API -->|"Set-Cookie HttpOnly<br/>SameSite Strict"| COOKIE["Cookie sesi"]
    COOKIE --> ADMIN
    COOKIE --> MITRA

    ADMIN --> Q["TanStack Query<br/>fetch VITE_API_URL/v1"]
    MITRA --> Q
    ANALYSIS --> Q
    Q -->|"GET/POST JSON"| API

    ADMIN --> SSE["EventSource /v1/events"]
    MITRA --> SSE
    SSE -->|"event: inventory<br/>topics: orders, stocks, logs, ai"| Q

    Q -->|"401 dari API"| CLEAR["Bersihkan sesi + redirect login"]
    SSR -->|"aset statis + font"| ASSET["dist/client"]
```

Catatan: web tidak pernah menyentuh database. Semua mutasi lewat API (`apps/api`).

## 3. Worker `daisuki-api`

```mermaid
flowchart TD
    IN["Request ke api.daisuki.my.id/v1"] --> CORS["CORS check<br/>WEB_ORIGIN, GRAPH_ORIGIN, localhost"]
    CORS --> AUTH{"getAuthUser dari cookie"}

    AUTH -->|"tidak ada"| R401["401 Unauthorized"]
    AUTH -->|"ada"| ROLE{"Role"}

    ROLE -->|"admin"| MODA["Modul admin, orders, analysis, assistant admin"]
    ROLE -->|"mitra"| MODM["Modul stok, restock, penerimaan, assistant mitra"]
    ROLE -->|"data_science / ai_engineer"| MODI["Modul analysis run + graph status"]

    MODA --> TX["Transaksi Drizzle<br/>FOR UPDATE pada produk"]
    MODM --> TX
    MODI --> READ["Query baca analysis_runs"]

    TX --> DB[("Neon PostgreSQL")]
    READ --> DB

    MODM --> SSE["publishInventoryChange<br/>topics"]
    MODA --> SSE
    SSE --> CLIENT["Stream /v1/events"]

    MODA --> KV[("KV DAISUKI_MODEL")]
    MODM --> KV
    MODA --> LLM["LLM_BASE_URL"]
    MODM --> LLM

    MODA -->|"POST /analysis/runs"| DISPATCH["GitHub workflow_dispatch<br/>draft / train"]
    DISPATCH --> GHA["GitHub Actions"]
    GHA -->|"UPDATE analysis_runs.status<br/>current_step, steps"| DB

    CRON["Cron Worker<br/>22:00 UTC Minggu, 02:00 UTC harian"] --> JOB["Draft mingguan +<br/>pengingat laporan"]
    JOB --> DB
```

Endpoint yang dipanggil Worker lain: `GET /v1/health`, `GET /v1/analysis/graph/status`,
dan `POST /v1/analysis/runs` (memicu tahap draft).

## 4. Worker `daisuki-graph`

```mermaid
flowchart TD
    OPEN["Buka graph.daisuki.my.id"] --> ASSET["Worker menyajikan<br/>apps/graph/public"]
    ASSET --> BOOT["app.js: init tema, versi, kanvas"]
    BOOT --> PICK{"Versi alur"}
    PICK -->|"host localhost"| LOKAL["VERSIONS.local<br/>5 fase, Bun + Python lokal"]
    PICK -->|"graph.daisuki.my.id"| PROD["VERSIONS.production<br/>GitHub Actions + KV"]
    PICK -->|"?flow=local atau production"| FORCE["Paksa versi untuk pratinjau"]

    BOOT --> HEALTH["GET /health + HEAD daisuki.my.id"]
    BOOT --> POLL["scheduleRefresh()"]

    POLL -->|"ada run aktif: 2 dtk"| FETCH["GET api/v1/analysis/graph/status"]
    POLL -->|"idle: 8 dtk"| FETCH
    FETCH -->|"200 JSON runs + active_run_id"| PAINT["paintFlow + renderRuns<br/>umur data tiap 1 dtk"]
    FETCH -->|"401 / 403"| STOP["Hentikan polling<br/>tampilkan ajakan login"]
    FETCH -->|"timeout 9 dtk"| RETRY["Abort lalu ulangi 2 dtk"]

    PAINT --> POLL
    STOP -->|"tab fokus / klik segarkan"| FETCH
```

## 5. Pipeline CI/CD dan analisis

```mermaid
flowchart LR
    PUSH["git push ke main"] --> CHECKS["checks (wajib)<br/>install, typecheck, lint,<br/>syntax, test:ci, build web"]
    CHECKS -->|"gagal"| STOP["Tidak ada deploy"]
    CHECKS -->|"lulus"| D1["deploy daisuki-api"]
    CHECKS -->|"lulus"| D2["deploy daisuki-graph"]
    CHECKS -->|"lulus"| D3["deploy daisuki-inventory"]
    D1 --> SM1["smoke /v1/health"]
    D2 --> SM2["smoke /health"]
    D3 --> SM3["smoke /"]

    ADMINCLICK["Admin: Perbarui analisis<br/>atau Training model"] --> APIRUN["API -> workflow_dispatch"]
    APIRUN --> RUNNER["analysis-pipeline.yml"]
    RUNNER --> AGG["weekly_analytics_aggregator.py"]
    AGG --> JOBS["7 job AI"]
    JOBS --> PKL["daisuki.pkl"]
    PKL --> JSON["export_worker_classifier.py"]
    JSON --> KV[("KV DAISUKI_MODEL")]
    RUNNER -->|"artefak + status"| DB[("Neon")]
```

## 6. Tabel ringkas per Worker

| Worker | Domain | Tanggung jawab | Sumber data | Dipanggil oleh |
|---|---|---|---|---|
| `daisuki-inventory` | `daisuki.my.id` | SSR TanStack Start, UI Admin dan Mitra, tidak pernah akses DB langsung | API `/v1`, SSE `/v1/events` | Browser |
| `daisuki-api` | `api.daisuki.my.id` | Auth, aturan bisnis, mutasi stok dan pesanan, analysis run, assistant, cron, SSE | Neon, KV `DAISUKI_MODEL`, LLM | Web, Graph, Browser (langsung untuk Graph) |
| `daisuki-graph` | `graph.daisuki.my.id` | Dashboard pipeline: aset statis, `/health`, polling status run | API `/v1/analysis/graph/status` | Browser |
