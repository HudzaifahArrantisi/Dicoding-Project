# Plan Bertahap — Performa Data Fetching (Rollup & Async Analysis)

> Fokus: menjaga dashboard tetap ringan & cepat saat volume `stock_logs` bertambah (skala bulanan/tahunan).
> Bukan perubahan UI. Setiap fase bisa dirilis independen.

---

## Fase 0 — Selesai (2026-11-24)
- Partial index `stock_logs (created_at desc) where source='manual_update'` dan `stock_logs (product_id, created_at desc)` sudah ditambahkan ke `neon/init.sql` dan diterapkan ke DB.
- Polling frontend yang redundan (finance 60s, live weekly-summary 30s, log-partners 30s, mitra stocks 10s, mitra finance 60s) dimatikan; data tetap ter-update lewat SSE `inventory` (debounce 250ms).

---

## Fase 1 — Tabel rollup harian `stock_logs_daily`
**Tujuan:** query laporan (mingguan/bulanan/keuangan) tidak lagi memindai `stock_logs` mentah.

Skema:
```sql
create table if not exists stock_logs_daily (
  day date not null,
  partner_id uuid not null references partners(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  log_count int not null default 0,
  consumed  int not null default 0,
  primary key (day, partner_id, product_id)
);
create index if not exists stock_logs_daily_day_idx on stock_logs_daily (day);
```

Pengisian (pilih salah satu):
1. **On-write (disarankan):** di transaksi yang sama saat insert `stock_logs`, jalankan upsert:
   ```sql
   insert into stock_logs_daily (day, partner_id, product_id, log_count, consumed)
   values (($1 AT TIME ZONE 'Asia/Jakarta')::date, $2, $3, 1, greatest($4-$5,0))
   on conflict (day, partner_id, product_id)
   do update set log_count = stock_logs_daily.log_count + 1,
                 consumed  = stock_logs_daily.consumed + excluded.consumed;
   ```
2. **Backfill/nightly:** job harian recompute N hari terakhir dari `stock_logs` (idempotent: `DELETE` lalu `INSERT … SELECT`).

Migrasi pembaca (tanpa ubah bentuk respons API):
- `/admin/weekly-summary/live` → agregasi dari `stock_logs_daily`.
- `/orders/finance/summary` (hari ini/7/30 hari) → dari rollup.
- AI Insights window 7/30 hari → dari rollup.
- `/orders/finance/weekly-history` → dari rollup.

Kriteria selesai: hasil angka identik dengan query lama (uji paralel 1 minggu), latency endpoint < 200 ms.

---

## Fase 2 — Analisis async (hilangkan 22 detik di request)
**Tujuan:** `POST /analysis/runs` tidak menunggu agregator Python.

- `createAnalysisDraft`: insert run `status='creating'` → **balas `202`** segera.
- Jalankan `weekly_analytics_aggregator.py` di background (Bun.spawn detached / worker queue). Jalur Worker produksi sudah memakai GitHub Actions — samakan pola untuk jalur Bun.
- Update status `draft`/`failed` + `current_step` di DB; frontend sudah polling status run (analysis.tsx) — pertahankan.
- Fallback: bila job gagal, `error` terisi, tombol bisa retry.

Kriteria selesai: respons `POST /analysis/runs` < 500 ms; run selesai di background.

---

## Fase 3 — Retensi & partisi `stock_logs`
**Tujuan:** tabel aktif tetap kecil walau bertahun-tahun.

- Partisi deklaratif per bulan (`stock_logs_2026_11`, dst.) atau arsipkan >12 bulan ke tabel `stock_logs_archive`.
- Job bulanan: buat partisi bulan depan + pindahkan/arsipkan bulan tertua.
- Setelah backfill besar: `VACUUM (ANALYZE)`.

---

## Fase 4 — Cache & materialized view
- **Materialized view** ringkasan mingguan per mitra-produk; `refresh ... concurrently` terjadwal.
- Cache ETag / `Cache-Control: stale-while-revalidate` untuk endpoint ringkasan (admin & mitra).
- Pastikan kompresi respons (brotli/gzip) aktif di Worker/API.

---

## Catatan operasional
- Jalankan `create index concurrently` saat jam sepi di produksi.
- Uji setiap fase dengan EXPLAIN (ANALYZE, BUFFERS) sebelum/sesudah; target: index scan + exec < 50 ms untuk window 30 hari.
