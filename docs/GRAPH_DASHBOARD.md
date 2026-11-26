# Daisuki System Graph

`apps/graph` is a static dashboard served by the `daisuki-graph` Cloudflare Worker at `graph.daisuki.my.id`. It polls `GET https://api.daisuki.my.id/v1/analysis/graph/status` every five seconds while the page is visible. That API endpoint requires a valid Daisuki session and permits only `admin`, `data_science`, and `ai_engineer` roles.

## What the dashboard reports

- Web reachability for `daisuki.my.id` (a browser `HEAD` request with opaque response; this confirms network reachability, not the application HTTP status).
- API availability from `GET /v1/health`.
- Run snapshots and pipeline stages from Neon `analysis_runs`.
- Python aggregation, the seven AI jobs, model export, KV publication, and final publication from runner-written `current_step` and `steps` fields.
- Two lanes mirror the operating flow: **Data Science** (`Perbarui analisis` → API → Neon `creating` → GitHub Actions → Python 4 kategori → simpan laporan → run `draft` → tinjau di AI Insights, dengan node samping *Hasil aktif tetap dipakai*) and **AI Engineer** (`Mulai training` → GitHub Actions job AI → tujuh job → model `daisuki.pkl` → simpan artefak → ekspor JSON → KV → terbit → muat ulang grafik), plus a dashed *Hasil lama tetap dipakai* branch when training fails.
- The canvas has a **Lokal / Produksi** switch. `Lokal` shows the same runner replaced by local execution (`Bun` spawns Python directly, `daisuki.pkl` is read from disk, no JSON export and no Cloudflare KV, then the local model worker reloads). `Produksi` shows GitHub Actions, the JSON export, and the `DAISUKI_MODEL` KV publication. The host decides the default (`localhost` → Lokal), an explicit click is remembered in `localStorage`, and `?flow=local|production` overrides it for previews.
- Generic link to GitHub Actions for detailed workflow logs. The dashboard never exposes raw runner error text.

Stages are reported at the boundaries the runner can observe. The Python weekly aggregator is one tracked stage; it does not publish internal per-category percentages. Do not present invented percentages as telemetry.

## Cloudflare setup

1. Add a proxied DNS record for `graph` in the `daisuki.my.id` zone so the Worker route can serve the hostname.
2. Deploy `apps/graph/wrangler.jsonc`; it attaches `graph.daisuki.my.id/*` to Worker `daisuki-graph` and serves static files from `apps/graph/public`.
3. Deployment is handled by the `graph` job in `.github/workflows/deploy.yml`, which runs on every push to `main` (no path filter) alongside the API and web jobs, using GitHub environment `model-LLM` with its `CLOUDFLARE_API_TOKEN` secret and `CLOUDFLARE_ACCOUNT_ID` variable.
4. The API Worker needs `GRAPH_ORIGIN=https://graph.daisuki.my.id` in its Wrangler variables for credentialed CORS. This repository's `apps/api/wrangler.jsonc` includes it; deploy the API Worker after this change.
5. Open the dashboard while signed in to `daisuki.my.id` with an Admin, Data Science, or AI Engineer account. The API session cookie is sent to `api.daisuki.my.id` by the browser; no token is stored in the graph page.

## Local preview

From repository root, run `bun run dev` to start the local web (port 3000), API + Python `daisuki.pkl` worker (port 3001), and Graph dashboard (port 8787) together. For a graph-only preview, run `bun run dev:graph` (or `bun run --cwd apps/graph dev`), though run data requires the API to be available locally. On `localhost` or `127.0.0.1`, the dashboard calls the local API directly on port 3001. The local Graph Worker adds those two origins to its response CSP only in dev mode; production keeps the restrictive CSP. Sign in to the local web app first with an internal account so the browser can send that session cookie to the local API.
