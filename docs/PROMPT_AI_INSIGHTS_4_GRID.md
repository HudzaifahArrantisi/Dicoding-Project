# Panduan & Prompt Implementasi: Refaktor Tab AI Insights Menjadi 4 Grid Kategori (Dengan 3D Pie Chart & Modal Detail)

Dokumen ini berisi spesifikasi teknis dan prompt siap pakai untuk merefaktor tampilan tab **AI Insights** pada dashboard admin (`apps/web/src/routes/admin.tsx`) agar menjadi antarmuka yang bersih, modern, dan tidak membingungkan.

---

## 1. Latar Belakang & Tujuan
Tampilan tab **AI Insights** saat ini dirasakan terlalu padat dan rumit (banyak sub-tab, grafik bertumpuk, panduan statis berukuran besar, dan tabel yang berulang). 

Admin Daisuki Pusat hanya membutuhkan **4 Kategori Analisis Inti** yang disajikan dalam bentuk **4 Grid Card Interaktif**:
1. **Analisis 4 Produk Paling Laku** di seluruh cabang mitra dan wilayah.
2. **Analisis Mitra Paling Laku** di semua wilayah (berdasarkan pengeluaran nominal/kuantitas stok barang dan restock mingguan).
3. **Analisis Wilayah Paling Laku** (berdasarkan serapan jumlah restock barang dari mitra di wilayah tersebut).
4. **Analisis Mitra Paling Aktif Update Stok** (terhitung dari frekuensi data logs pembaruan stok fisik harian).

Setiap kategori menampilkan kartu ringkasan di halaman utama. Ketika kartu diklik, sistem akan membuka **Modal Detail** yang menampilkan **Grafik 3D Pie Chart (`ThreeDPieChart`)** interaktif lengkap dengan metrik kunci dan tabel data mendalam.

---

## 2. Arsitektur & Sumber Data 4 Kategori

| No | Kategori Analisis | Sumber Data Backend / API | Visualisasi Utama di Modal | Tabel & Metrik Detail |
|---|---|---|---|---|
| **1** | **4 Produk Paling Laku** | `data?.weekly_facts?.top_selling_products` atau kalkulasi dari `fast_moving_products` / `stock_logs` | **3D Pie Chart (4 Slice)** porsi pangsa pasar 4 produk resmi | Peringkat 1-4, Kategori, Total Unit Terjual (pcs), Rata-rata per Hari, Pangsa Pasar (%), Status Stok Pusat |
| **2** | **Mitra Paling Laku** | `partnerFastMovingGroups` & `data?.weekly_facts?.top_performers_partners` | **3D Pie Chart** kontribusi penjualan per cabang mitra | Peringkat Mitra, Wilayah, Total Pengeluaran Stok (pcs), Frekuensi/Unit Restock, Turnover Rate (%), Produk Dominan |
| **3** | **Wilayah Paling Laku** | `data?.regional_activity?.regions` & `data?.market_hotspots?.regions` | **3D Pie Chart** sebaran volume restock per Kabupaten/Kota | Peringkat Wilayah, Total Restock (Diajukan & Disetujui), Jumlah Cabang Mitra, Rata-rata Restock/Cabang |
| **4** | **Mitra Paling Aktif Update Stok** | `getWeeklySummary()` (`/admin/weekly-summary`) -> `partner_daily_log_breakdown` (`source = 'manual_update'`) | **3D Pie Chart** proporsi frekuensi pembaruan stok fisik antar mitra | Peringkat Kepatuhan, Total Log Update (7 hari), Hari Aktif (Senin-Minggu), Waktu Laporan Terakhir, Status Kepatuhan |

---

## 3. Desain Komponen & Antarmuka

### A. Tampilan Halaman Utama (`AIInsightsPanel`)
- **Header Bersih**: Judul "AI Insights", deskripsi ringkas, tombol "Perbarui Saran", dan waktu analisis terakhir.
- **Wadah Grid Responsif**:
  ```tsx
  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
    {/* Card 1: 4 Produk Paling Laku */}
    {/* Card 2: Mitra Paling Laku */}
    {/* Card 3: Wilayah Paling Laku */}
    {/* Card 4: Mitra Paling Aktif Update Stok */}
  </div>
  ```
- **Struktur Kartu Grid**:
  - Header kartu dengan ikon tematik (`Sparkles`, `Flame`, `MapPin`, `History`).
  - Metrik Utama (#1 Leader): Nama pemenang teratas + angka numerik besar (`tabular-nums`).
  - Bar visual ringkas atau badge perbandingan.
  - Footer kartu interaktif: Tombol *"Buka Analisis & Grafik 3D →"* dengan efek hover elevasi.

### B. Komponen Modal Detail (`apps/web/src/components/inventory/ai-insights-modals.tsx`)
Menggunakan `@radix-ui/react-dialog` dan mengintegrasikan `ThreeDPieChart` (`apps/web/src/components/inventory/three-d-pie-chart.tsx`):
1. `ProductSalesDetailModal`: Menampilkan 3D Pie Chart 4 produk resmi dan tabel performa penjualan.
2. `TopPartnersDetailModal`: Menampilkan 3D Pie Chart kontribusi mitra dan tabel penjualan/restock cabang.
3. `TopRegionsDetailModal`: Menampilkan 3D Pie Chart serapan restock per wilayah dan tabel kebutuhan logistik.
4. `ActiveReportingPartnersModal`: Menampilkan 3D Pie Chart proporsi log laporan stok dan tabel kepatuhan mitra.

---

## 4. Prompt Siap Pakai untuk Eksekusi (Copy-Paste)

Gunakan prompt di bawah ini untuk menginstruksikan AI Agent / Developer mengeksekusi perubahan:

```text
Refaktor tab "AI Insights" pada dashboard admin Daisuki Inventory (apps/web/src/routes/admin.tsx) agar hanya menampilkan 4 Grid Kategori Analisis Utama dengan 3D Pie Chart dan Modal Detail:

1. SPESIFIKASI 4 GRID KATEGORI UTAMA:
   Gantikan seluruh tampilan tab AI Insights yang rumit (tabel panjang, accordion bertumpuk, panduan statis) dengan tata letak grid 2x2 yang bersih (grid-cols-1 md:grid-cols-2 gap-5):
   - Grid 1: Analisis 4 Produk Paling Laku di semua mitra dan wilayah.
   - Grid 2: Analisis Mitra Paling Laku (berdasarkan pengeluaran nominal stok dan restock mingguan).
   - Grid 3: Analisis Wilayah Paling Laku (berdasarkan jumlah restock barang dari mitra di wilayah tersebut).
   - Grid 4: Analisis Mitra Paling Aktif Update Stok (terhitung dari frekuensi logs data manual_update via getWeeklySummary()).

2. MODAL DETAIL DENGAN GRAFIK 3D PIE CHART:
   Buat file komponen baru di `apps/web/src/components/inventory/ai-insights-modals.tsx` yang mengekspor 4 modal detail menggunakan Radix Dialog dan `ThreeDPieChart` (`@/components/inventory/three-d-pie-chart`):
   - Saat Card 1 diklik: Buka ProductSalesDetailModal dengan 3D Pie Chart 4 produk resmi Daisuki (Seblak, Keripik Pisang, Basreng, Makaroni) dan tabel pangsa pasar.
   - Saat Card 2 diklik: Buka TopPartnersDetailModal dengan 3D Pie Chart kontribusi penjualan antar mitra dan tabel konsumsi & restock mingguan.
   - Saat Card 3 diklik: Buka TopRegionsDetailModal dengan 3D Pie Chart sebaran restock wilayah (Kabupaten/Kota) dan tabel serapan pasokan.
   - Saat Card 4 diklik: Buka ActiveReportingPartnersModal dengan 3D Pie Chart frekuensi update stok fisik dan tabel kepatuhan laporan harian mitra.

3. KETENTUAN TEKNIS & KODE:
   - Gunakan data yang sudah tersedia di `useQuery` AI Insights (`data?.weekly_facts`, `data?.regional_activity`, `data?.fast_moving_products`, dll).
   - Tambahkan pemanggilan hook `getWeeklySummary()` di `admin.tsx` untuk menghitung data keaktifan log mitra di Grid 4.
   - Pertahankan tombol "Perbarui saran" dan status sinkronisasi model di header.
   - Pastikan seluruh angka menggunakan class `.num` / `tabular-nums` dan font display `Bricolage Grotesque`.
   - Pastikan TypeScript bersih tanpa error kompilasi (jalankan `bun --cwd apps/web run typecheck`).
   - Catat pembaruan di CLAUDE.md dan AGENTS.md sesuai Daily Changelog Protocol.
```
