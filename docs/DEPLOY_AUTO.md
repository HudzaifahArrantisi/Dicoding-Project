# Deploy otomatis setelah push

Setiap push ke `main`, termasuk perubahan dokumentasi atau Python, memicu
workflow **Deploy Daisuki API** (`.github/workflows/deploy-api.yml`). Workflow
memeriksa tipe API lalu menerbitkan `apps/api/wrangler.jsonc` ke `daisuki-api`.
Jika pemeriksaan gagal, deploy tidak dijalankan. Deploy API diproses bergantian;
jika banyak push berdekatan, antrean dapat mengganti push yang masih menunggu
dengan push terbaru.

## Setup satu kali

1. Buat Cloudflare API token dengan template **Edit Cloudflare Workers**.
   Batasi resource ke akun proyek dan zone `daisuki.my.id`. Token harus dapat
   menerbitkan Worker, mengakses binding KV, serta mengelola route pada zone ini.
   Panduan resmi: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
2. Di GitHub repo → Settings → Environments → **model-LLM**, tambahkan
   **secret** `CLOUDFLARE_API_TOKEN` berisi token tersebut. Token
   `CLOUDFLARE_KV_TOKEN` untuk pipeline model tetap terpisah.
3. Di environment yang sama, pastikan **variable** `CLOUDFLARE_ACCOUNT_ID`
   berisi Account ID Cloudflare. Gunakan nilai yang sudah dipakai pipeline analisis.
   Agar berjalan tanpa persetujuan manual, environment tidak memakai required
   reviewers atau wait timer; deployment branch harus mengizinkan `main`.
4. Untuk web, pertahankan Cloudflare Workers Builds pada `daisuki-inventory`:
   repository `HudzaifahArrantisi/Dicoding-Project`, branch `main`, builds aktif,
   koneksi GitHub aktif, root direktori repo, deploy command
   `cd apps/web && bun run deploy`. Include paths `*`, tanpa exclude yang
   mencakup kode sumber. Jangan memasang deploy API kedua di Workers Builds.

Secret runtime API seperti `DATABASE_URL`, `LLM_API_KEY`, dan
`GITHUB_ACTIONS_TOKEN` tetap berada di Cloudflare. Workflow ini tidak menyalin
secret database pipeline ke Worker. Variabel biasa, routes, binding, dan cron
mengikuti konfigurasi Git `apps/api/wrangler.jsonc` saat deploy.

## Pemakaian

```powershell
git add .
git commit -m "Perbarui fitur"
git push origin main
```

- **API:** GitHub → Actions → Deploy Daisuki API → pastikan sukses.
- **Web:** Cloudflare → daisuki-inventory → Deployments → pastikan commit terbaru aktif.

Tidak perlu menjalankan Wrangler manual lagi setelah setup selesai. Kedua deploy
berjalan terpisah: sukses API tidak menjamin build web berhasil, dan sebaliknya.
Untuk mengulang API, pilih workflow → Run workflow pada branch `main`.

Push kode Python memperbarui skrip yang akan digunakan pada job analisis/training
berikutnya; tidak otomatis melatih atau menerbitkan model. Admin tetap menjalankan
**Perbarui analisis** dan **Training model** sesuai alur persetujuan aplikasi.
Migrasi database juga tidak dijalankan otomatis oleh workflow deploy ini.
