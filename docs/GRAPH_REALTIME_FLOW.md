# Alur Realtime Status Analisis (Graph → API)

Dokumen ini menjelaskan bagaimana `graph.daisuki.my.id` mengambil status run analisis
secara realtime dari `api.daisuki.my.id`, termasuk penyebab status terlihat "telat",
dan apa yang diubah agar tidak ada jeda yang terasa.

## 1. Arsitektur permintaan

```mermaid
flowchart LR
    subgraph Browser["Browser internal (Admin / Data Science / AI Engineer)"]
        G["graph.daisuki.my.id<br/>static dashboard"]
        C["Cookie sesi daisuki.my.id"]
    end

    subgraph CF["Cloudflare (zone daisuki.my.id)"]
        EDGE["Edge / TLS / proxy"]
        GW["Worker daisuki-graph<br/>assets + /health"]
        AW["Worker daisuki-api<br/>/v1/analysis/graph/status"]
    end

    DB[("Neon PostgreSQL<br/>analysis_runs")]
    GH["GitHub Actions runner<br/>analysis-pipeline.yml"]

    G -->|"1. muat HTML/JS/CSS"| EDGE --> GW
    G -->|"2. GET /v1/analysis/graph/status<br/>credentials: include, cache: no-store"| EDGE --> AW
    C -.->|"dikirim otomatis ke api.daisuki.my.id"| AW
    AW -->|"3. auth + role check"| AW
    AW -->|"4. SELECT runs + active_run_id (paralel)"| DB
    DB -->|"5. baris run + steps"| AW
    AW -->|"6. JSON + Cache-Control: no-store"| G
    GH -->|"7. UPDATE status/current_step/steps"| DB
```

Catatan: Worker `daisuki-graph` **tidak** mem-proxy API. Halaman statis memanggil
`https://api.daisuki.my.id/v1` langsung (dev: `http://localhost:3001/v1`), sehingga
yang menentukan kesegaran data hanya polling browser → API → Neon.

## 2. Urutan permintaan realtime

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser (graph)
    participant A as Worker daisuki-api
    participant N as Neon PostgreSQL
    participant R as GitHub Actions runner

    R->>N: UPDATE analysis_runs (status, current_step, steps)
    B->>B: scheduleRefresh() → timer 2 dtk (ada run aktif) / 8 dtk (idle)
    B->>A: GET /v1/analysis/graph/status (cookie sesi, no-store)
    activate A
    A->>A: getAuthUser() → role admin/data_science/ai_engineer
    par query paralel
        A->>N: SELECT 30 run terbaru (id, status, steps, current_step)
        A->>N: SELECT active_run_id (is_active = true)
    end
    N-->>A: baris run
    A-->>B: 200 JSON {server_time, runs, active_run_id, viewer_role} + no-store
    deactivate A
    B->>B: pilih run: pinned → run aktif terbaru → run terbaru
    B->>B: paintFlow() + renderRuns() + "Diperbarui N dtk lalu"
    B->>B: ticker 1 dtk memperbarui umur data
```

## 3. Aturan pemilihan run di dashboard

```mermaid
flowchart TD
    S["Terima daftar runs (urut created_at desc)"] --> A{"Ada run aktif?<br/>creating / processing / approved"}
    A -->|"ya, dan bukan run yang sedang di-pin"| P["Lepas pin, ikuti run aktif terbaru"]
    A -->|"tidak"| M{"Ada run yang di-pin user?"}
    P --> SP["Tampilkan run aktif"]
    M -->|"ya"| SM["Tampilkan run yang di-pin"]
    M -->|"tidak"| SN["Tampilkan run terbaru"]
```

Pin dilepas otomatis hanya bila muncul run aktif yang **lebih baru**, supaya saat
Admin menekan *Perbarui analisis* dashboard langsung pindah ke run baru tanpa klik,
tetapi inspeksi run lama yang sudah selesai tetap bisa dilakukan.

## 4. Siklus status run yang ditampilkan

```mermaid
stateDiagram-v2
    [*] --> creating: Admin klik "Perbarui analisis"
    creating --> draft: runner selesai agregasi 4 kategori
    creating --> failed: runner gagal
    draft --> approved: Admin menyetujui
    draft --> rejected: Admin menolak
    approved --> processing: Admin/AI Engineer klik "Training model"
    processing --> published: artefak + KV terbit
    processing --> failed: training gagal
    published --> [*]
    rejected --> [*]
    failed --> [*]
```

## 5. Parameter waktu

| Parameter | Nilai | Arti |
|---|---|---|
| `REFRESH_ACTIVE_MS` | 2000 ms | Polling saat ada run `creating`/`processing`/`approved` |
| `REFRESH_IDLE_MS` | 8000 ms | Polling saat semua run sudah selesai |
| `REFRESH_TIMEOUT_MS` | 9000 ms | Batas satu permintaan; lewat dari ini di-abort lalu diulang |
| Ticker umur data | 1000 ms | Memperbarui teks "Diperbarui N dtk lalu" tanpa request baru |
| `checkServices()` | 30000 ms | Cek `/health` API dan reachability web |
| Tab tersembunyi | — | Polling dihentikan; langsung `refresh()` saat tab kembali terlihat |

Loop memakai `setTimeout` berantai, bukan `setInterval`, sehingga satu permintaan
lambat **tidak** menahan antrean berikutnya (penyebab tampilan "beku lalu melompat").
Tombol segarkan membatalkan permintaan yang sedang berjalan sebelum memulai yang baru.

## 6. Kenapa dulu terasa delay

1. **Interval tetap 5 dtk + guard `refreshInFlight`.** Permintaan yang lambat (cold start
   Worker, latensi Neon) membuat tick berikutnya dilewati, jadi UI diam lalu melompat.
2. **Dua query berurutan** pada endpoint status (`SELECT runs` lalu `active_run_id`)
   menambah satu round trip setiap polling.
3. **Tidak ada batas waktu request**, jadi kegagalan jaringan bisa menggantung lama.
4. **Urutan tahap hanya di-update runner** di batas tahap (GitHub Actions queue bisa
   10–60 dtk sebelum job mulai). Selama masa itu `status` masih `creating`; ini delay
   nyata dari pipeline, bukan dari dashboard.

Perbaikan: polling adaptif 2 dtk/8 dtk, query paralel, `AbortController` 9 dtk,
`Cache-Control: no-store` pada `/graph/status`, umur data berjalan tiap detik, dan
auto-follow run aktif terbaru.

## 7. Referensi kode

- `apps/graph/public/app.js` — `VERSIONS`, `refresh()`, `scheduleRefresh()`, `formatRelative()`, `REFRESH_*`.
- `apps/api/src/modules/analysis/index.ts` — handler `GET /analysis/graph/status`.
- `apps/api/src/realtime.ts` — SSE `/events` (topik inventori, bukan untuk pipeline).
- `apps/graph/src/index.ts` — Worker aset statis + `/health` + CSP dev.

## 8. Dua versi alur di kanvas

Kanvas punya sakelar **Lokal / Produksi**. Keduanya membaca `analysis_runs` yang sama;
perbedaannya hanya siapa yang menjalankan Python dan bagaimana model didistribusikan.

### 8.1 Alur lokal (`bun run dev`)

```mermaid
flowchart TD
    A["Admin klik<br/>Perbarui analisis"]
    API["Worker lokal daisuki-api<br/>:3001"]
    DB[("Neon PostgreSQL")]
    PYD["Bun.spawn<br/>weekly_analytics_aggregator.py"]
    ART["Simpan laporan + 4 kategori"]
    DRAFT["Run berstatus draft"]
    OLD["Grafik final tetap memakai<br/>hasil aktif sebelumnya"]
    REVIEW["Admin meninjau di AI Insights"]
    TCLICK["Admin klik<br/>Mulai analisis & training"]
    JOBS["Bun.spawn tujuh job Python<br/>risk, evaluasi, alokasi, fakta,<br/>train, grafik, validasi"]
    PKL[("daisuki.pkl di mesin lokal")]
    PERSIST["Simpan artefak AI ke Neon"]
    PUBLISH["Run terbit & aktif<br/>rekomendasi disimpan"]
    RELOAD["API lokal muat ulang<br/>worker model .pkl"]
    FAIL["Gagal: hasil lama tetap dipakai"]

    A --> API
    API -->|"status creating"| DB
    API --> PYD
    PYD -->|"baca stock_logs"| DB
    PYD --> ART --> DB
    DB --> DRAFT --> REVIEW
    DRAFT --> OLD
    REVIEW --> TCLICK --> API
    API -->|"status processing"| DB
    API --> JOBS
    JOBS -->|"train.py menulis"| PKL
    JOBS --> PERSIST --> DB
    PERSIST --> PUBLISH --> DB
    PUBLISH --> RELOAD
    JOBS -.->|"exit code != 0"| FAIL
```

Tidak ada GitHub Actions, tidak ada ekspor JSON, dan tidak ada Cloudflare KV: API lokal
membaca `daisuki.pkl` langsung dari folder artefak run lalu memuat ulang worker model.

### 8.2 Alur produksi (`api.daisuki.my.id`)

```mermaid
flowchart TD
    A["Admin klik<br/>Perbarui analisis"]
    API["Worker daisuki-api"]
    DB[("Neon PostgreSQL")]
    GHD["GitHub Actions<br/>stage draft"]
    PYD["Skrip Python Data Science<br/>4 kategori"]
    ART["Simpan laporan + 4 kategori"]
    DRAFT["Run berstatus draft"]
    OLD["Grafik final tetap memakai<br/>hasil aktif sebelumnya"]
    REVIEW["Admin meninjau di AI Insights"]
    TCLICK["Admin klik<br/>Mulai analisis & training"]
    GHT["GitHub Actions<br/>tujuh job AI"]
    PKL["daisuki.pkl dibuat"]
    JSON["Ekspor JSON<br/>daisuki-worker.json"]
    KV[("Cloudflare KV<br/>DAISUKI_MODEL")]
    PERSIST["Simpan artefak AI ke Neon"]
    PUBLISH["Run terbit & aktif"]
    REFRESH["Web memuat ulang<br/>grafik + ringkasan"]
    FAIL["Gagal: hasil lama tetap dipakai"]

    A --> API
    API -->|"status creating"| DB
    API -->|"workflow_dispatch draft"| GHD
    GHD --> PYD
    PYD -->|"baca stock_logs"| DB
    PYD --> ART --> DB
    DB --> DRAFT --> REVIEW
    DRAFT --> OLD
    REVIEW --> TCLICK --> API
    API -->|"status processing"| DB
    API -->|"workflow_dispatch train"| GHT
    GHT --> JOBS["tujuh job AI berurutan"]
    JOBS --> PKL --> JSON
    JSON -->|"PUT /values/daisuki"| KV
    KV -->|"dibaca API Worker"| API
    JOBS --> PERSIST --> DB
    PERSIST --> PUBLISH --> DB
    PUBLISH --> REFRESH
    JOBS -.->|"exit code != 0"| FAIL
```

Di produksi, API Worker tidak menjalankan Python; ia hanya mengirim `workflow_dispatch`
ke GitHub Actions dan membaca model hasil publikasi KV.
