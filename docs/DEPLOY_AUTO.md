# Deploy otomatis setelah push

Setiap push ke `main` memicu satu workflow **Deploy Daisuki Workers**
(`.github/workflows/deploy.yml`). Pull request ke `main` juga menjalankan
pemeriksaan (`checks` dan `tests`) tanpa melakukan deploy. Workflow menjalankan
pemeriksaan kode lebih dulu, baru menerbitkan tiga Worker beserta smoke test
health pasca-deploy:

| Job | Jenis | Isi | Syarat |
|---|---|---|---|
| `checks` | gerbang | `bun install --frozen-lockfile`, `bun run typecheck` (web + API), `bun run --cwd apps/web lint`, `node --check apps/graph/public/app.js`, `py_compile` (`ai/` + `data-science/`), `bun run test:ci` (unit test offline), `bun run build` web | wajib lulus |
| `tests` | laporan | `bun test` penuh (JUnit diunggah sebagai artefak `bun-test-report`) | tidak memblokir deploy |
| `api` | deploy | `daisuki-api` dari `apps/api/wrangler.jsonc` + smoke test `/v1/health` | `needs: checks`, bukan PR |
| `graph` | deploy | `daisuki-graph`, aset `apps/graph/public` + smoke test `/health` | `needs: checks`, bukan PR |
| `web` | deploy | `daisuki-inventory`, `bun run build`, `wrangler deploy` + smoke test `/` | `needs: checks`, bukan PR |

Jika `checks` gagal, ketiga deploy tidak dijalankan. Job `tests` sengaja
`continue-on-error` karena sebagian suite membutuhkan database dan LLM live;
hasilnya tetap terlihat di tab Actions dan artefak, tetapi tidak menahan rilis.

Tidak ada filter path: perubahan di mana pun (web, API, graph, dokumentasi,
Python) tetap menerbitkan ketiga Worker. Ketiga job deploy berjalan paralel,
jadi gagal di satu Worker tidak membatalkan dua lainnya. Untuk mengulang, buka
GitHub → Actions → **Deploy Daisuki Workers** → **Run workflow** pada `main`.

Workflow `deploy-graph.yml` dan `deploy-api.yml` sudah dihapus; semuanya
ditangani satu pipeline ini.

### Menjalankan pemeriksaan yang sama secara lokal

```powershell
bun install --frozen-lockfile
bun run typecheck
bun run --cwd apps/web lint
node --check apps/graph/public/app.js
python -c "import pathlib, py_compile; files=[p for d in ('ai','data-science') for p in pathlib.Path(d).rglob('*.py') if '.venv' not in p.parts]; [py_compile.compile(str(f), doraise=True) for f in files]"
bun run test:ci
bun run --cwd apps/web build
bun test   # opsional, sebagian butuh DB/LLM
```

## Setup satu kali

1. Buat Cloudflare API token dengan template **Edit Cloudflare Workers**.
   Batasi resource ke akun proyek dan zone `daisuki.my.id`. Token harus dapat
   menerbitkan Worker, mengakses binding KV, serta mengelola route pada zone ini.
   Panduan resmi: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
2. Di GitHub repo → Settings → Environments → **model-LLM**, tambahkan
   **secret** `CLOUDFLARE_API_TOKEN` berisi token tersebut. Token
   `CLOUDFLARE_KV_TOKEN` untuk pipeline model tetap terpisah.
3. Di environment yang sama, pastikan **variable** `CLOUDFLARE_ACCOUNT_ID`
   berisi Account ID Cloudflare. Tanpa required reviewers agar berjalan otomatis.
4. **Matikan Cloudflare Workers Builds** untuk Worker `daisuki-inventory`
   (Cloudflare → Workers & Pages → `daisuki-inventory` → Settings → Build →
   Nonaktifkan koneksi Git). Web kini dibangun dan diterbitkan oleh workflow,
   jadi build kedua akan bertabrakan dengan deploy ini.

Secret runtime API seperti `DATABASE_URL`, `LLM_API_KEY`, dan
`GITHUB_ACTIONS_TOKEN` tetap berada di Cloudflare. Workflow ini tidak menyalin
secret database pipeline ke Worker. Variabel biasa, routes, binding, dan cron
mengikuti konfigurasi Git `*/wrangler.jsonc` saat deploy. Build web memakai
`VITE_API_URL=https://api.daisuki.my.id` dari `apps/web/.env.production`.

## DNS dan route

- `daisuki.my.id` → Worker `daisuki-inventory` (custom domain).
- `api.daisuki.my.id` → Worker `daisuki-api` (route `api.daisuki.my.id/*`, atau tunnel lokal pada mode dev).
- `graph.daisuki.my.id` → Worker `daisuki-graph` (route `graph.daisuki.my.id/*`).
  Tambahkan record DNS `graph` bertipe `AAAA` dengan nilai `100::` dan proxy
  aktif agar route Worker dapat menempel. Setelah deploy sukses, dashboard
  Cloudflare menampilkan baris tersebut sebagai type `Worker`.

## Pemakaian

```powershell
git add .
git commit -m "Perbarui fitur"
git push origin main
```

Lalu cek GitHub → Actions → **Deploy Daisuki Workers**: tiga job (`api`,
`graph`, `web`) harus hijau. Tidak perlu menjalankan Wrangler manual lagi.

Push kode Python memperbarui skrip yang akan digunakan pada job analisis/training
berikutnya; tidak otomatis melatih atau menerbitkan model. Admin tetap menjalankan
**Perbarui analisis** dan **Training model** sesuai alur persetujuan aplikasi.
Migrasi database juga tidak dijalankan otomatis oleh workflow deploy ini.
