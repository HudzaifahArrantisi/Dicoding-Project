# Deploy otomatis setelah push

Setiap push ke `main` memicu satu workflow **Deploy Daisuki Workers**
(`.github/workflows/deploy.yml`). Workflow menjalankan tiga job paralel yang
masing-masing menerbitkan satu Worker:

| Job | Worker | Konfigurasi | Catatan |
|---|---|---|---|
| `api` | `daisuki-api` | `apps/api/wrangler.jsonc` | Dijalankan setelah `typecheck` API lulus |
| `graph` | `daisuki-graph` | `apps/graph/wrangler.jsonc` | Aset statik dari `apps/graph/public` |
| `web` | `daisuki-inventory` | `apps/web/wrangler.jsonc` | `bun run build` lalu `wrangler deploy` |

Tidak ada filter path: perubahan di mana pun (web, API, graph, dokumentasi,
Python) tetap menerbitkan ketiga Worker. Job berjalan paralel, jadi gagal di
satu Worker tidak membatalkan dua lainnya. Untuk mengulang, buka
GitHub → Actions → **Deploy Daisuki Workers** → **Run workflow** pada `main`.

Job yang sama juga menangani deploy Graph, sehingga workflow
`deploy-graph.yml` dan `deploy-api.yml` sudah dihapus.

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
