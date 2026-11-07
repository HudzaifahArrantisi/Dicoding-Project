# Perencanaan Implementasi: Efisiensi Request & Caching Berbasis SSE (Event-Driven On-Demand Loading)

Dokumen ini berisi panduan teknis dan langkah implementasi bagi Codex/Developer untuk mengoptimalkan efisiensi network request di Daisuki Inventory. 

Tujuan utama:
1. **Zero Redundant Fetch saat Navigasi**: Halaman atau tab yang sudah pernah di-load tidak boleh melakukan request ulang saat user berpindah halaman/tab.
2. **Eliminasi Polling**: Menghapus seluruh `refetchInterval` berkala yang membebani server/database.
3. **Event-Driven via SSE**: Backend hanya mengirimkan sinyal perubahan (*lightweight topic signal*) melalui Server-Sent Events (SSE). Frontend hanya me-refresh query yang relevan dan sedang aktif dilihat user.

---

## 1. Analisis Arsitektur & Masalah Saat Ini

- **Frontend Query Config**:
  - `apps/web/src/routes/admin.tsx` memiliki `staleTime: 10_000` s/d `30_000` dan `refetchInterval: 15_000` s/d `60_000`. Ini menyebabkan browser terus-menerus menembak API dan melakukan re-fetch setiap berpindah tab jika melebihi 30 detik.
- **SSE Engine**:
  - Backend sudah memiliki endpoint `/events` di `apps/api/src/realtime.ts` dengan fungsi `publishInventoryChange({ partnerId, topics })`.
  - Frontend memiliki hook `useInventoryEvents` di `apps/web/src/lib/inventory-events.ts`, tetapi query invalidation belum menggunakan opsi `{ refetchType: 'active' }`, dan portal Mitra (`apps/web/src/routes/mitra.tsx`) belum terhubung ke SSE.

---

## 2. Blueprint Solusi

```text
┌────────────────────────────────────────────────────────┐
│                   FRONTEND (BROWSER)                   │
├────────────────────────────────────────────────────────┤
│ 1. Cache TanStack Query:                               │
│    • staleTime: Infinity (Jangan re-fetch otomatis jika│
│      sudah ada di RAM).                                │
│    • gcTime: 1 jam (Data tetap tersimpan di memory).   │
│                                                        │
│ 2. Navigasi Router / Tab:                              │
│    • Pindah tab/halaman = 0 request (instan dari RAM). │
│    • Hanya fetch pertama kali saat data belum ada.     │
│                                                        │
│ 3. Listener SSE (Event-Driven Invalidation):           │
│    • Event masuk: { topics: ['orders'] }               │
│    • Invalidate dengan refetchType: 'active'           │
│      -> Jika tab aktif: auto background-refetch        │
│      -> Jika tab tidak aktif: tandai stale saja,       │
│         baru fetch saat tab diklik nanti.              │
└──────────────────────────▲─────────────────────────────┘
                           │ SSE Stream Push (Lightweight)
┌──────────────────────────┴─────────────────────────────┐
│                    BACKEND (ELYSIA)                    │
├────────────────────────────────────────────────────────┤
│ • Mutasi (Approve, Reject, Kirim, Adjust Stock, dll)   │
│ • Panggil publishInventoryChange({ topics: [...] })    │
│ • Tanpa polling, tanpa payload besar di stream         │
└────────────────────────────────────────────────────────┘
```

---

## 3. Langkah Implementasi (Step-by-Step Task Checklist)

### Tahap 1: Konfigurasi Cache TanStack Query (Frontend)

- [ ] **File: `apps/web/src/integrations/tanstack-query/root-provider.tsx`**
  - Ubah default options query agar tidak mudah dianggap usang:
    ```ts
    defaultOptions: {
      queries: {
        staleTime: Infinity, // Data yang sudah di-load tidak akan re-fetch otomatis
        gcTime: 1000 * 60 * 60, // Simpan di cache RAM selama 1 jam
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false, // Jangan fetch ulang jika data di cache sudah ada
      },
    }
    ```

- [ ] **File: `apps/web/src/routes/admin.tsx`**
  - Hapus seluruh properti `refetchInterval` pada:
    - `admin-metrics` (hapus `refetchInterval: 15_000`)
    - `admin-notifications` (hapus `refetchInterval: 60_000` dan ubah `staleTime: 0` menjadi `staleTime: Infinity`)
  - Pastikan seluruh query utama menggunakan `staleTime: Infinity`:
    - `admin-metrics`
    - `admin-stocks`
    - `admin-central-products`
    - `admin-orders`
    - `admin-shipment-logs`
    - `admin-stock-logs-partner`
    - `admin-ai-insights`

- [ ] **File: `apps/web/src/routes/mitra.tsx`**
  - Pastikan query pada portal mitra (`mitra-stocks`, `mitra-orders`, `central-products`, `mitra-stock-logs`) juga menggunakan `staleTime: Infinity` dan `refetchOnMount: false`.

---

### Tahap 2: Optimasi Invalidation Hook SSE (`useInventoryEvents`)

- [ ] **File: `apps/web/src/lib/inventory-events.ts`**
  - Perbaiki fungsi `flush()` agar menggunakan `{ refetchType: 'active' }`:
    ```ts
    const flush = () => {
      invalidateTimer = null
      if (pending.size === 0) return
      const keys = new Map<string, string[]>()
      for (const topic of pending) {
        for (const key of queryKeys[role][topic] ?? []) {
          keys.set(key.join(':'), key)
        }
      }
      pending.clear()
      for (const key of keys.values()) {
        // Hanya re-fetch jika query sedang aktif di layar (active)
        // Jika query sedang tidak aktif (tab lain), query hanya ditandai stale
        // dan baru di-fetch saat user membuka tab/komponen tersebut.
        void queryClientRef.current.invalidateQueries({
          queryKey: key,
          refetchType: 'active',
        })
      }
    }
    ```
  - Periksa query mapping untuk `admin` dan `mitra` agar topic benar-benar presisi memetakan query key terkait.

- [ ] **File: `apps/web/src/routes/mitra.tsx`**
  - Aktifkan listener SSE untuk portal Mitra:
    ```tsx
    useInventoryEvents(Boolean(user && user.role === 'mitra'), 'mitra')
    ```
  - Dengan ini, ketika ada perubahan status pesanan atau alokasi dari admin pusat, data di layar mitra ter-update otomatis secara real-time tanpa perlu me-reload halaman.

---

### Tahap 3: Verifikasi Backend Trigger (Elysia SSE)

- [ ] **File: `apps/api/src/modules/orders/index.ts` (atau handler mutasi terkait)**
  - Pastikan setiap mutasi memanggil `publishInventoryChange` dengan topics dan `partnerId` yang sesuai:
    - **Create Restock Order**:
      ```ts
      publishInventoryChange({
        partnerId: user.partnerId,
        topics: ["orders", "metrics", "notifications"],
      });
      ```
    - **Approve / Reject Order**:
      ```ts
      publishInventoryChange({
        partnerId: order.partner_id,
        topics: ["orders", "stocks", "metrics", "notifications"],
      });
      ```
    - **Ship Order (`dalam_pengiriman`)**:
      ```ts
      publishInventoryChange({
        partnerId: order.partner_id,
        topics: ["orders", "logs"],
      });
      ```
    - **Confirm Delivery (`selesai`)**:
      ```ts
      publishInventoryChange({
        partnerId: order.partner_id,
        topics: ["orders", "stocks", "logs", "metrics"],
      });
      ```

- [ ] **File: `apps/api/src/modules/stocks/index.ts`**
  - Saat ada penyesuaian stok manual / opname fisik:
    ```ts
    publishInventoryChange({
      partnerId,
      topics: ["stocks", "logs", "metrics"],
    });
    ```

---

## 4. Kriteria Pengujian & Verifikasi (Acceptance Criteria)

1. **Uji Navigasi Tab (Admin)**:
   - Buka tab *Stok Cabang*, lalu pindah ke *Persetujuan Pesanan*, lalu ke *Log Pengiriman*, lalu kembali ke *Stok Cabang*.
   - **Hasil**: Tidak boleh ada network request baru yang keluar di Network Tab browser (0 request). Transisi antar tab instan (0 ms loading).
2. **Uji Polling Diam (Idle)**:
   - Biarkan dashboard admin terbuka selama 2 menit tanpa melakukan aksi apa pun.
   - **Hasil**: Tidak boleh ada request HTTP GET berkala (hanya ada koneksi persisten SSE `/events`).
3. **Uji Realtime Update via SSE**:
   - Buka portal Admin dan Mitra di dua jendela browser berdampingan.
   - Mitra mengajukan pesanan restock baru.
   - **Hasil**:
     - Backend mengirim event SSE topic `orders` & `metrics`.
     - Angka notifikasi dan daftar pesanan di Admin otomatis ter-update seketika tanpa refresh manual.
4. **Uji Lazy Load Tab Non-Aktif**:
   - Admin sedang membuka tab *Log Pengiriman*.
   - Mitra membuat pesanan baru (event topic `orders` masuk).
   - **Hasil**: Browser admin tidak langsung me-fetch daftar pesanan saat masih di tab *Log Pengiriman*. Begitu admin mengklik tab *Persetujuan Pesanan*, data terbaru langsung di-load.

---

## 5. Ringkasan File Terkait

| Bagian | Path File | Aksi Utama |
| :--- | :--- | :--- |
| **Global Query** | `apps/web/src/integrations/tanstack-query/root-provider.tsx` | Ubah `staleTime: Infinity`, `gcTime: 1h`, `refetchOnMount: false` |
| **Admin Route** | `apps/web/src/routes/admin.tsx` | Hapus seluruh `refetchInterval` dan jadikan `staleTime: Infinity` |
| **Mitra Route** | `apps/web/src/routes/mitra.tsx` | Pasang `useInventoryEvents` & samakan query options |
| **SSE Invalidation** | `apps/web/src/lib/inventory-events.ts` | Gunakan `{ refetchType: 'active' }` saat `invalidateQueries` |
| **Backend SSE** | `apps/api/src/realtime.ts` | Endpoint stream `/events` & fungsi publisher topic |
| **Backend Mutations**| `apps/api/src/modules/orders/` & `stocks/` | Pastikan `publishInventoryChange` terpanggil di tiap mutasi |
