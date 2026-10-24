# Alur tiga peran pengembangan Daisuki Inventory saat ini

Dokumen ini menjelaskan kerja tiga **peran tim pengembang**: Fullstack Developer, Data Science, dan AI Engineer. Ketiganya berbeda dari **peran pengguna aplikasi**, yang saat ini hanya Admin Pusat dan Mitra Cabang.

## Gambaran singkat

| Peran tim | Pertanyaan yang dijawab | Hasil kerja utama |
| --- | --- | --- |
| Fullstack Developer | Bagaimana Admin dan Mitra memakai sistem dengan aman? | Web, API, aturan pesanan, dan penyimpanan data |
| Data Science | Seberapa cepat stok habis dan kapan perlu pesan lagi? | Data log yang bersih, perkiraan konsumsi, safety stock, dan reorder point |
| AI Engineer | Cabang mana yang perlu diprioritaskan dan berapa saran alokasinya? | Klasifikasi risiko, rekomendasi restock, dan skrip notifikasi |

Alurnya sederhana: **Mitra melaporkan stok → Fullstack menyimpan transaksi → Data Science menghitung pola konsumsi → AI Engineer membuat saran → Fullstack menampilkan hasil untuk Admin.** Keputusan menyetujui dan mengirim barang tetap dilakukan Admin.

## 1. Fullstack Developer: menjalankan transaksi harian

Fullstack mengelola `apps/web/`, `apps/api/`, `packages/shared/`, dan skema di `neon/init.sql`. Ada dua jalur pengguna yang dibuatnya:

1. **Mitra Cabang** melihat stok sendiri dan stok gudang pusat, melaporkan jumlah barang fisik, lalu mengajukan restock beberapa produk dalam satu pesanan.
2. **Admin Pusat** memantau stok cabang, menerima notifikasi, menentukan jumlah yang disetujui per barang, dan menandai pesanan sudah dikirim. Pada tahap pengiriman ini, stok pusat berkurang sesuai `qty_approved`.
3. Saat barang tiba, **Mitra** mengonfirmasi penerimaan. Stok cabang bertambah sesuai `qty_approved` dan perubahan dicatat di `stock_logs`. Mitra dapat menyertakan foto bukti. Jika foto belum ada, Admin mendapat penanda dan dapat meminta bukti susulan.

Status pesanan berjalan dari `diproses` → `disetujui` → `dalam_pengiriman` → `selesai`. Pesanan juga dapat `ditolak` atau `dibatalkan` sesuai tahapnya. Perubahan stok dan status dilakukan melalui API, bukan langsung dari browser ke database. API menentukan identitas cabang Mitra dari JWT.

Data yang diserahkan ke tim lain adalah riwayat `stock_logs`. Admin sudah memiliki tombol ekspor `raw_stock_logs.csv` di tab **Log & Data**. API juga menyediakan data rekomendasi dari tabel `restock_recommendations`.

Contoh: Mitra melaporkan Seblak tersisa 30 dari 40 pcs. API menyimpan stok terbaru dan log perubahan. Log itu dapat dipakai untuk menghitung laju pemakaian Seblak di cabang tersebut.

## 2. Data Science: mengubah log menjadi ukuran kebutuhan stok

Data Science bekerja di `data-science/`. Masukannya adalah `data/raw_stock_logs.csv` dari ekspor Admin, atau pembacaan database dengan akun `ds_readonly`. Skrip saat ini ada di `data-science/src/clean_logs.py`.

Alur skrip tersebut:

1. Membaca log stok dan data stok cabang saat ini.
2. Memilih log `manual_update` untuk memperkirakan pemakaian. Log `order_received` tidak dihitung sebagai barang terjual karena merupakan barang masuk.
3. Menyaring data yang kosong, tidak masuk akal, atau berulang dalam waktu dekat.
4. Menghitung rata-rata pemakaian harian (`adu`), persediaan pengaman (`safety_stock`), titik pesan ulang (`rop`), dan perkiraan berapa hari stok cukup (`days_of_cover`). Perhitungan saat ini memakai asumsi lead time 6 hari.
5. Menulis `data-science/data/cleaned_inventory_summary.csv` sebagai bahan untuk AI Engineer.

Contoh: bila cabang memakai sekitar 5 bungkus Seblak per hari dan stoknya 20 bungkus, perkiraan stok cukup sekitar 4 hari. Karena pengiriman memerlukan beberapa hari, cabang itu perlu diperhatikan sebelum stok habis.

Data Science menyiapkan angka dan metode perhitungan. Persetujuan pesanan dan mutasi stok tetap berada pada alur Admin, Mitra, dan API.

## 3. AI Engineer: mengurutkan prioritas dan membuat saran

AI Engineer bekerja di `ai/`. Saat ini ada dua skrip utama untuk alur rekomendasi:

1. `ai/jobs/analyze_stockouts.py` membaca CSV bersih lalu memberi tingkat risiko `HIGH_STOCKOUT_RISK`, `MODERATE_RISK`, atau `SAFE`. Hasilnya ditulis ke `ai/data/stockout_risks.csv`.
2. `ai/jobs/smart_allocation.py` membaca CSV bersih, membandingkan kebutuhan cabang dengan sisa stok pusat, memprioritaskan cabang yang lebih berisiko, lalu menulis saran ke `restock_recommendations`. Untuk risiko tinggi, skrip ini juga mencoba membuat notifikasi Admin bertipe `low_stock`.

Contoh: dua cabang membutuhkan Basreng, tetapi stok pusat terbatas. Cabang dengan perkiraan stok cukup kurang dari dua hari diproses lebih dahulu. Hasilnya adalah **saran jumlah**, bukan persetujuan pesanan otomatis. Admin tetap memeriksa ketersediaan dan menetapkan `qty_approved`.

Ada pula `ai/jobs/stale_stock_reminder.py` untuk pengingat laporan stok lebih dari 24 jam dan `ai/jobs/emergency_restock_alert.py` untuk stok yang sangat rendah. Keduanya sudah berupa skrip, tetapi belum terlihat penjadwal yang menjalankannya otomatis dalam aplikasi.

## Serah terima antarperan

```text
Mitra / Admin
    │  laporan stok, pesanan, persetujuan, penerimaan
    ▼
Fullstack: web + API + Neon DB
    │  stock_logs atau raw_stock_logs.csv
    ▼
Data Science: clean_logs.py
    │  cleaned_inventory_summary.csv
    ▼
AI Engineer: analyze_stockouts.py + smart_allocation.py
    │  tingkat risiko + restock_recommendations
    ▼
Fullstack: API /admin/ai-insights dan /stocks/recommendations
    │
    ▼
Admin meninjau saran, lalu memutuskan pesanan
```

## Kondisi pengembangan saat dokumen ini ditulis

- Alur operasional Admin dan Mitra, log stok, ekspor CSV, serta endpoint untuk membaca rekomendasi sudah ada.
- Skrip pembersihan data, klasifikasi risiko, dan alokasi rekomendasi sudah ada, tetapi perlu dijalankan berurutan. Belum terlihat scheduler yang menjalankan rangkaian ini secara otomatis.
- Dashboard Admin memiliki tampilan **AI Insights** untuk membaca rekomendasi. Portal Mitra belum terlihat menggunakan endpoint `/stocks/recommendations`, jadi saran AI belum otomatis muncul di formulir restock Mitra.
- Dua skrip notifikasi tambahan memakai tipe `stale_stock` dan `emergency_restock`. Tipe tersebut belum ada dalam constraint `notifications_type_check` yang dipakai migrasi saat ini. Constraint perlu diselaraskan sebelum kedua skrip dijalankan pada database tersebut.
- Folder dan README AI menyebut rencana asisten dan bot, tetapi implementasi yang tampak saat ini berfokus pada skrip analisis, alokasi, dan notifikasi.

## Berkas rujukan

- Aturan alur pesanan: `packages/shared/src/index.ts`
- API pesanan dan stok: `apps/api/src/modules/orders/index.ts`, `apps/api/src/modules/stocks/index.ts`
- Ekspor log dan AI Insights: `apps/api/src/modules/admin/index.ts`
- Pengolahan data: `data-science/src/clean_logs.py`
- Klasifikasi dan alokasi: `ai/jobs/analyze_stockouts.py`, `ai/jobs/smart_allocation.py`
- Rancangan awal proyek: `docs/ALUR_SISTEM_DAN_ROLE.md`
