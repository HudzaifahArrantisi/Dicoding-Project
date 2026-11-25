# Rencana Clean Code — Daisuki Inventory

Dokumen ini berisi hasil audit kode mati (dead code), duplikasi, dan file terlalu besar,
beserta rencana eksekusi bertahap untuk memangkas baris kode yang tidak perlu.

Status: rencana (belum ada kode yang diubah).

---

## 1. Ringkasan Temuan

Hasil audit `apps/web/src`, `apps/api/src`, `packages/shared/src`, `scripts`, dan root repo:

| Temuan | Dampak baris kode |
|---|---|
| 2 file JSON duplikat dari fallback `.ts` yang sudah dipakai | **-22.806** |
| 1 komponen mati 1.270 baris (`regional-analysis.tsx`), hanya tipenya dipakai | -1.250 |
| Komponen mati lain (modal, chart, onboarding, utils) | -769 |
| Isi `mitra-ai-assistant.tsx` yang tidak dipakai (export `MitraAiAssistant`) | -366 |
| Helper format tanggal/log diduplikasi di `admin.tsx` & `mitra.tsx` | -145 |
| **Total potensi pengurangan** | **~25.300 baris** |

Selain itu ada 4 file raksasa yang tidak mengurangi jumlah baris tetapi wajib dipecah:
`routes/admin.tsx` (6.778), `routes/mitra.tsx` (3.713), `api/modules/admin/index.ts` (1.484),
`api/modules/orders/index.ts` (1.132).

---

## 2. Aturan Main (jangan dilanggar)

1. **Zero behavior change.** Setiap fase hanya memindahkan/menghapus, tidak mengubah logika bisnis.
2. Satu fase = satu commit terpisah, sehingga mudah di-*revert*.
3. Setiap fase wajib lulus:
   ```bash
   bun run typecheck
   bun --cwd apps/web run lint
   bun --cwd apps/web run build
   ```
4. Setiap fase selesai → catat ringkasan di `AGENTS.md` dan `CLAUDE.md` (protokol changelog harian).
5. Jangan hapus apa pun yang dipakai *dynamic import*, CLI (`bun run ...`), atau test — verifikasi dulu dengan `grep`.
6. Aturan bisnis di `AGENTS.md` (stok tanpa plafon, mutation boundary, `partner_id` dari JWT) tidak boleh tersentuh.

---

## 3. Fase 1 — Hapus Kode Mati (risiko rendah, dampak terbesar)

Semua file di bawah sudah diverifikasi **tidak di-import** oleh modul lain (kecuali disebut lain).

| # | File | Baris | Alasan |
|---|---|---|---|
| 1 | `apps/web/src/components/inventory/regional-analysis.tsx` | 1.270 | Hanya `RegionalActivity` yang dipakai (`lib/api/admin.ts`). Pindahkan tipe ke `lib/api/types/regional.ts` lalu hapus komponen. Cek dulu `ThreeDPieChart` tetap dipakai `ai-insights-modals.tsx` → aman. |
| 2 | `apps/web/src/components/inventory/partner-deficit-modal.tsx` | 280 | Tidak pernah di-import. |
| 3 | `apps/web/src/components/inventory/weekly-insights.tsx` | 37 | Tidak pernah di-import. |
| 4 | `apps/web/src/components/inventory/ai-pipeline-chart.tsx` | 78 | Tidak pernah di-import. |
| 5 | `apps/web/src/components/onboarding-motion-scenes.tsx` | 65 | Tidak pernah di-import. |
| 6 | `apps/web/src/lib/utils.ts` | 6 | Tidak pernah di-import (`cn` diambil dari paket `cn`). |
| 7 | `apps/web/src/integrations/tanstack-query/devtools.tsx` | 5 | Tidak dipakai `__root.tsx`. |

### 1b. Pecah `mitra-ai-assistant.tsx`

File 650 baris, tapi yang benar-benar dipakai hanya `AssistantMessageText`
(dipakai `mitra-chat-room.tsx` dan `admin-chat-room.tsx`).
Export `MitraAiAssistant` (baris 285+) **mati**.

- Pindahkan `AssistantMessageText` + helper parser Markdown/LaTeX/tabel → `components/inventory/assistant-message-text.tsx`.
- Hapus sisa `MitraAiAssistant` (~366 baris) beserta import yang jadi tidak terpakai.
- Sesuaikan import di `mitra-chat-room.tsx` dan `admin-chat-room.tsx`.
- File `mitra-ai-assistant.test.tsx` ikut dipindah/disesuaikan namanya.

---

## 4. Fase 2 — Konsolidasi Data Fallback (dampak terbesar)

Kondisi sekarang: data fallback disimpan **dua kali** dalam format berbeda.

| File | Baris | Dipakai? |
|---|---|---|
| `apps/web/src/data/weekly-absorption-matrix-fallback.ts` | 21.413 | **Ya** (`weekly-absorption-matrix.tsx`) |
| `apps/web/src/data/weekly_absorption_matrix.json` | 21.411 | Tidak |
| `apps/web/src/data/operational-insight-fallback.ts` | 1.450 | **Ya** (`lib/api/analysis.ts`) |
| `apps/web/src/data/operational_insight.json` | 1.395 | Tidak |

Langkah:
1. Hapus kedua file `.json` yang tidak dipakai (**-22.806 baris, ~1 MB**).
2. Tambahkan catatan di header file `.ts` bahwa isinya dihasilkan dari
   `data-science/data/*.json` oleh script generator, **jangan disunting manual**.
3. Opsional (fase lanjutan): buat `scripts/generate-web-fallback.ts` yang membaca
   output Data Science lalu menulis file `.ts` tersebut, supaya tidak drift lagi.
4. Masukkan file fallback ke `prettier-ignore` agar tidak diperiksa ulang oleh tooling.

---

## 5. Fase 3 — Hilangkan Duplikasi Helper

Helper berikut ditulis dua kali hampir identik:

| Helper | `admin.tsx` | `mitra.tsx` |
|---|---|---|
| `formatDetailedDateTime` | 225 | 3.012 |
| `toLocalDateStr` | 1.460 | 3.052 |
| `getWeekDays` | 1.468 | 3.060 |
| `formatDayDate` | 1.504 | 3.091 |
| `groupLogsByBatch` | 1.515 | 3.104 |
| `formatWeekRange` / `formatWeekDateRange` | 1.484 | 3.076 |
| `formatOrderDate` / `formatCompactDateTime` | — | 2.998 / 3.037 |

Buat 2 modul baru:
- `apps/web/src/lib/date-format.ts` → `formatDetailedDateTime`, `formatOrderDate`,
  `formatCompactDateTime`, `formatDayDate`, `formatWeekRange`, `toLocalDateStr`,
  `getWeekDays`, `wibMonthKey`, `shiftMonthKey`.
- `apps/web/src/lib/stock-logs.ts` → `groupLogsByBatch`, tipe `StockLogBatch`.

Dampak: ~145 baris duplikat hilang dan format tanggal konsisten di dua portal.

Catatan tambahan: `apps/web/src/routes/__root.tsx` menuliskan `<link>` Google Fonts dua kali
(baris 42–53 dan 100–108). Cukup satu.

---

## 6. Fase 4 — Pecah File Route Raksasa

### `apps/web/src/routes/admin.tsx` — 6.778 baris → target < 1.500

Route tetap menyimpan state tab, query, dan layout. Sisanya dipindah ke `components/admin/`:

| Komponen (baris sekarang) | File baru |
|---|---|
| `ShipmentLogPanel` (248–351) | `components/admin/shipment-log-panel.tsx` |
| `DataSciencePanel` (405–711) | `components/admin/data-science-panel.tsx` |
| `PartnerDailyLogChart` (712–1.459) | `components/admin/partner-daily-log-chart.tsx` |
| `PartnerStockLogDialog` (1.579–2.161) | `components/admin/partner-stock-log-dialog.tsx` |
| `AiOverviewCard`, `AIInsightsPanel`, `PARTNER_COLUMNS`, `PartnerAnalysisTable` (2.162–2.811) | `components/admin/ai-insights-panel.tsx` |
| `WeeklySalesHistoryModal` (3.451–3.584) | `components/admin/weekly-sales-history-modal.tsx` |
| `AdminFloatingNavbar` + `AdminSidebar` (3.585–3.895) | `components/admin/admin-navigation.tsx` |
| `PartnerManagementPanel` (3.935–4.515) | `components/admin/partner-management-panel.tsx` |
| `StockPanel` (4.516–5.268) | `components/admin/stock-panel.tsx` |
| `OrderPanel` (5.269–5.695) | `components/admin/order-panel.tsx` |
| `ApprovalDialog` (5.696–6.622) | `components/admin/approval-dialog.tsx` |
| `NotificationModal` + `parseAndFormatAlert` (6.623–akhir) | `components/admin/notification-modal.tsx` |

### `apps/web/src/routes/mitra.tsx` — 3.713 baris → target < 1.200

| Komponen (baris sekarang) | File baru |
|---|---|
| `NumericStockInput` (708–776) | `components/mitra/numeric-stock-input.tsx` |
| `StocksPanel` (777–1.082) | `components/mitra/stocks-panel.tsx` |
| `OrderForm` (1.083–1.589) | `components/mitra/order-form.tsx` |
| `OrderHistory`, `StatusFilterClass`, `DeliveryTourSimulation` (1.590–2.405) | `components/mitra/order-history.tsx` |
| `EditOrderModal` (2.406–2.752) | `components/mitra/edit-order-modal.tsx` |
| `ProfilePanel` (2.753–2.997) | `components/mitra/profile-panel.tsx` |
| `MitraLogsPanel`, `MitraInsightMetric` (3.168–akhir) | `components/mitra/mitra-logs-panel.tsx` |

Aturan pemecahan: props eksplisit, tanpa `any`, tipe query dari `lib/api/*` (bukan didefinisikan ulang).

---

## 7. Fase 5 — Rapikan Modul API

| File | Baris | Rencana |
|---|---|---|
| `apps/api/src/modules/admin/index.ts` | 1.484 | Pecah per domain: `admin/stock.ts`, `admin/partners.ts`, `admin/analytics.ts`, `admin/ai-insights.ts`. Blok SQL besar (baris 820–1.200) dipindah ke `admin/queries/*.sql.ts`. |
| `apps/api/src/modules/orders/index.ts` | 1.132 | Pecah: `orders/create.ts`, `orders/approval.ts`, `orders/shipping.ts`, `orders/finance.ts`. Transaksi stok tetap utuh dan memakai `FOR UPDATE` seperti sekarang. |
| `apps/api/src/modules/assistant/index.ts` | 843 | Pisahkan handler route dari orkestrasi jawaban (`assistant/handlers.ts` vs `assistant/answer.ts`). |

Tambahan: magic number `0.20` / `GREATEST(10, par_level * 0.2)` muncul berulang di
`modules/admin/index.ts` dan `modules/stocks/index.ts`, padahal `packages/shared` sudah punya
`STOCK_THRESHOLDS`. Angkat ke satu konstanta bersama (hati-hati: nilai dipakai di SQL, perlu
parameter binding, bukan interpolasi mentah).

---

## 8. Fase 6 — Higiene Repo & Dependency

### Dependency web yang tidak terpakai (hapus dari `apps/web/package.json`)
- `@faker-js/faker`
- `@tanstack/react-table`
- `@tanstack/match-sorter-utils`
- `@tanstack/react-form`
- `tw-animate-css`
- `clsx` + `tailwind-merge` (hanya dipakai `lib/utils.ts` yang dihapus di Fase 1)

### File hasil generate yang ikut ter-commit
- `apps/api/src/generated/data.ts` (1.070 baris) — dibuat oleh `apps/api/scripts/bundle-data.mjs`.
  Rekomendasi: tambahkan ke `.gitignore` dan panggil generator di step build/deploy
  (pastikan CI memanggil `bun apps/api/scripts/bundle-data.mjs` sebelum build Worker).

### Utilitas DB di dalam `src/`
`apps/api/src/db/{backfill-analysis-artifacts,check-analysis-storage,migrate-analysis-storage,migrate-assistant-memory,migrate-assistant}.ts`
adalah script sekali pakai (total 111 baris). Pindahkan ke `apps/api/scripts/` agar `src/` hanya berisi kode runtime.
`seed-mitra.ts` dan `seed-synthetic-stock-logs.ts` **dipertahankan** (dipakai `bun run seed:mitra`), pindah ke `scripts/` dengan entry `package.json` yang disesuaikan.

### Root repo — perlu keputusan pemilik proyek (jangan dihapus tanpa konfirmasi)
- `bun` (file kosong 0 KB, ter-track git)
- `debug.log` (tidak ter-track)
- `stack.md` (14 KB catatan lepas)
- `figcraft/` (eksperimen desain `moodly-app`, `bento-app` — tidak berhubungan dengan aplikasi)

---

## 9. Daftar File yang Harus Dikerjakan

### Hapus
```
apps/web/src/data/weekly_absorption_matrix.json
apps/web/src/data/operational_insight.json
apps/web/src/components/inventory/partner-deficit-modal.tsx
apps/web/src/components/inventory/weekly-insights.tsx
apps/web/src/components/inventory/ai-pipeline-chart.tsx
apps/web/src/components/onboarding-motion-scenes.tsx
apps/web/src/lib/utils.ts
apps/web/src/integrations/tanstack-query/devtools.tsx
```

### Ubah / pecah
```
apps/web/src/components/inventory/regional-analysis.tsx      -> sisakan tipe
apps/web/src/components/inventory/mitra-ai-assistant.tsx      -> pindahkan AssistantMessageText, hapus sisanya
apps/web/src/components/inventory/mitra-chat-room.tsx         -> sesuaikan import
apps/web/src/components/inventory/admin-chat-room.tsx         -> sesuaikan import
apps/web/src/routes/admin.tsx                                 -> pecah ke components/admin/*
apps/web/src/routes/mitra.tsx                                 -> pecah ke components/mitra/*
apps/web/src/routes/__root.tsx                                -> hapus <link> font duplikat
apps/web/src/lib/api/admin.ts                                 -> import tipe dari lokasi baru
apps/api/src/modules/admin/index.ts                           -> pecah per domain
apps/api/src/modules/orders/index.ts                          -> pecah per domain
apps/api/src/modules/assistant/index.ts                       -> pisah handler & orkestrasi
apps/web/package.json                                         -> hapus 6 dependency mati
apps/api/package.json                                         -> sesuaikan entry seed setelah script dipindah
```

### Tambah
```
apps/web/src/lib/date-format.ts
apps/web/src/lib/stock-logs.ts
apps/web/src/lib/api/types/regional.ts
apps/web/src/components/inventory/assistant-message-text.tsx
apps/web/src/components/admin/*.tsx            (12 file, lihat Fase 4)
apps/web/src/components/mitra/*.tsx            (7 file, lihat Fase 4)
apps/api/src/modules/admin/*.ts                (stock, partners, analytics, ai-insights)
apps/api/src/modules/orders/*.ts               (create, approval, shipping, finance)
apps/api/scripts/*.ts                          (migrasi utilitas DB)
scripts/generate-web-fallback.ts               (opsional)
```

---

## 10. Urutan Eksekusi yang Disarankan

1. Fase 1 + Fase 2 (hapus kode mati & JSON duplikat) → **commit terpisah, langsung -23.000 baris**.
2. Fase 3 (dedup helper) → commit.
3. Fase 6 bagian dependency (hapus 6 paket) → commit + `bun install` untuk refresh lockfile.
4. Fase 4a (`admin.tsx`) → commit per 3–4 komponen agar review mudah.
5. Fase 4b (`mitra.tsx`) → commit.
6. Fase 5 (API) → commit.
7. Fase 6 bagian generated file & pindah script DB → commit (butuh uji deploy Worker).

---

## 11. Risiko

| Risiko | Mitigasi |
|---|---|
| Menghapus file yang ternyata dipakai dynamic import / route generator TanStack | Jalankan `bun --cwd apps/web run build` setelah setiap penghapusan |
| `generated/data.ts` dihapus dari git tapi CI tidak menjalankan generator | Tambahkan generator ke workflow sebelum build; uji `wrangler deploy` dry-run |
| Pemecahan `admin.tsx`/`mitra.tsx` memicu regresi UI | Pindahkan kode apa adanya (copy-paste murni), tanpa mengubah JSX/logika |
| Pindah `seed-mitra.ts` merusak `bun run seed:mitra` | Update `scripts` di `apps/api/package.json` pada commit yang sama |
| Perubahan konstanta threshold stok | Tunda sampai ada test untuk `getStockStatus`; jangan menyentuh SQL reservasi stok |

---

## 12. Verifikasi Akhir

```bash
bun install
bun run typecheck
bun --cwd apps/web run lint
bun --cwd apps/web run build
bun --cwd apps/api run test     # ulangi test order-transitions
git diff --stat                 # pastikan hanya file di daftar yang berubah
```

Kriteria selesai:
- 0 file mati tersisa (diverifikasi dengan tool `knip` bila diinstal).
- `admin.tsx` < 1.500 baris, `mitra.tsx` < 1.200 baris.
- Tidak ada helper tanggal/stok yang terduplikasi.
- Typecheck, lint, dan build tetap hijau.
