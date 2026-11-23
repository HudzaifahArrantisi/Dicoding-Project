# Analisis dan training di GitHub Actions

Workflow `.github/workflows/analysis-pipeline.yml` menjalankan Python di runner GitHub.
API `daisuki-api` tetap menangani login, stok, pesanan, dan chat. Laptop tidak
dibutuhkan untuk analisis dan training setelah alur ini dipasang.

## Siapkan akses

1. Push workflow dan kode API terbaru ke branch `main` pada repo
   `HudzaifahArrantisi/Dicoding-Project`. Workflow dispatch tidak bisa dipakai
   sebelum berkas workflow ada di branch tersebut.
2. Gunakan GitHub Environment bernama `model-LLM`; workflow memakai environment
   ini. Tambahkan **secrets** `ANALYSIS_DATABASE_URL`
   (koneksi Neon khusus pipeline, dengan izin membaca
   sumber data dan menulis tabel hasil run) serta `CLOUDFLARE_KV_TOKEN`
   (Cloudflare API Token berizin **Workers KV Storage Write**). Tambahkan
   **variables** `CLOUDFLARE_ACCOUNT_ID` dan `CLOUDFLARE_KV_NAMESPACE_ID`.
   Namespace ID harus sama dengan binding `DAISUKI_MODEL` pada
   `apps/api/wrangler.jsonc`.
   Jika koneksi memakai role `ai_job`, jalankan migrasi
   `neon/migrations/20261123_analysis_pipeline_permissions.sql` di Neon SQL
   Editor memakai role owner sebelum menjalankan workflow.
3. Buat GitHub fine-grained token atau GitHub App untuk repo ini, dengan izin
   repository **Actions: write**. Simpan token itu sebagai **secret runtime**
   `GITHUB_ACTIONS_TOKEN` pada Worker `daisuki-api`. Jangan taruh token di
   `wrangler.jsonc`, `.env.production`, atau Git. `GITHUB_ACTIONS_REPOSITORY`
   adalah variabel biasa di `wrangler.jsonc`.
4. Deploy ulang **hanya** Worker API dari `apps/api` setelah secret tersedia:
   `bunx wrangler deploy --config wrangler.jsonc`. Secret Worker tetap dikelola
   sebagai secret Cloudflare, bukan oleh GitHub Actions.

## Cara kerja

- Tombol **Perbarui analisis** membuat run berstatus `creating`, lalu Worker
  memicu stage `draft`. Runner menjalankan agregator mingguan, memverifikasi
  manifest, dan menyimpan delapan artefak Data Science di Neon. Run menjadi
  `draft` untuk ditinjau Admin.
- Sesudah persetujuan, tombol **Training model** memicu stage `train`. Runner
  memulihkan artefak laporan dari Neon, mengunduh referensi Admin dari Neon,
  menjalankan tujuh langkah AI, menyimpan artefak per run, dan mengekspor
  `daisuki.pkl` menjadi JSON untuk Workers.
- Runner menulis JSON ke key KV `daisuki`, lalu menerbitkan run dan rekomendasi
  di Neon. API Worker membaca key itu. Pembacaan KV dapat menampilkan versi
  sebelumnya sementara karena cache global dan cache model Worker 60 detik.
- Bila stage gagal, status run menjadi `failed` dan pesan singkat tampil di
  aplikasi. Lihat log lengkap pada GitHub Actions, tanpa mencetak secret.

## Pemeriksaan pertama

1. Pada GitHub Actions, pastikan workflow `Daisuki analysis and model training`
   muncul setelah push. Jangan menjalankannya manual dengan UUID buatan;
   workflow memerlukan run yang sudah dibuat oleh API.
2. Klik **Perbarui analisis** pada akun Data Science/Admin. Lihat status
   `creating` lalu `draft`, empat kategori, dan manifest di aplikasi.
3. Setujui laporan dan jalankan training dari AI Insights. Lihat tujuh langkah
   berhasil, status `published`, dan key `daisuki` di KV berubah.
4. Uji pertanyaan chatbot yang memakai data mitra dan cek bahwa model baru
   terbaca. KV menampung JSON inferensi, bukan file `.pkl`.
   Untuk training pertama, pilih sumber hasil analisis Data Science. Mode
   referensi mentah mempertahankan classifier risiko dari run aktif bila ada.

## Batas yang perlu diperhatikan

- Runner GitHub berjalan saat job diminta; ia bukan server untuk setiap chat.
- Satu nilai KV maksimal 25 MiB. JSON model lokal yang pernah diperiksa sekitar
  21 MiB, sehingga pertumbuhan indeks RAG dapat melewati batas. Pipeline
  menghentikan publikasi bila batas tercapai.
- GitHub Actions untuk repo privat memakai jatah compute akun. Periksa pemakaian
  pada GitHub Billing agar tetap dalam jatah gratis.
- Publikasi KV dan transaksi Neon tidak atomik. Jika publikasi Neon gagal setelah
  KV terbarui, status run menjadi `failed` tetapi model KV mungkin sudah baru;
  jangan mengulang training sebelum memeriksa kedua versi. Ini perlu ditingkatkan
  dengan key model per versi dan pointer aktif sebelum penggunaan luas.
- Pipeline tidak membuat data historis yang tidak ada. Pertanyaan stok gudang
  pada tanggal lampau memerlukan snapshot bertanggal di database.
