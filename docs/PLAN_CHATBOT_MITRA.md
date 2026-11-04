# Spesifikasi & Rencana Implementasi: Chatbot AI Mitra & Interactive Product Tour

Dokumen spesifikasi arsitektur, guardrail keamanan, dan alur integrasi fitur **Chatbot AI Mitra** terhubung langsung dengan **Interactive In-App Product Tour Controller** pada platform Daisuki B2B Inventory.

---

## 1. Latar Belakang & Tujuan Fitur

1. **Khusus Lingkup Daisuki (*Strict Scope Guardrail*)**:
   Chatbot bertindak sebagai asisten operasional toko mitra. AI **hanya** melayani pertanyaan yang relevan dengan ekosistem inventaris Daisuki (laporan stok fisik harian, alur pemesanan restock, penerimaan barang & scan barcode resi, riwayat pesanan, log mutasi, serta data profil cabang).
   *Jika pengguna bertanya di luar inventaris Daisuki (misal resep makanan, gosip, coding, politik), AI akan menolak dengan ramah dan mengarahkan kembali ke topik Daisuki.*

2. **Kepatuhan Aturan Bisnis Daisuki**:
   - **Kapasitas Stok Bebas Tanpa Batas Maksimal (*Unbounded Partner Stock*)**: Tidak menggunakan angka 40 pcs atau rasio `/par` sebagai batas maksimal. Buffer minimal / par level adalah batas pengaman (*safety buffer*), bukan kapasitas rak.
   - **State Machine Pesanan**: `diproses` → `disetujui` (atau `ditolak`/`dibatalkan`) → `dalam_pengiriman` → `selesai`.
   - **Pertambahan Stok Fisik**: Stok toko bertambah hanya saat mitra melakukan verifikasi penerimaan barang fisik (`dalam_pengiriman` → `selesai`).

3. **Tombol Pintasan Pertanyaan (*Quick Shortcut Buttons*)**:
   Menyediakan tombol cepat di antarmuka chat:
   - 📦 *"Bagaimana cara restock barang?"*
   - 📝 *"Bagaimana cara lapor stok harian?"*
   - 🚚 *"Bagaimana cara konfirmasi barang sampai (scan resi)?"*
   - 📊 *"Bagaimana cara membaca status stok & log?"*
   - 🏢 *"Bagaimana cara melengkapi profil toko?"*

4. **Interactive In-App Product Tour Trigger**:
   Ketika mitra bertanya atau mengklik salah satu shortcut fitur:
   - Chatbot memberikan penjelasan langkah ringkas.
   - Chatbot menyertakan tombol aksi: **`[ 🚀 Mulai Panduan Langsung (Product Tour) ]`**.
   - Saat diklik:
     1. Widget chat terminimize secara mulus ke samping.
     2. Tab aktif portal mitra otomatis berpindah ke tab fitur yang dituju (`stocks`, `order`, `history`, `logs`, atau `profile`).
     3. Spotlight overlay interaktif menyorot elemen-elemen di layar secara bertahap (*step-by-step spotlight tooltip*).

---

## 2. Diagram Alur Sistem

```text
Portal Mitra (/mitra)
  │
  ├── 1. Floating AI Assistant Widget (MitraAiAssistant)
  │      ├── Floating Trigger Button (kanan bawah, mobile safe-area aware)
  │      ├── Chat Window Drawer / Popover
  │      │    ├── Header: "Daisuki AI Assistant" · "Asisten Operasional Mitra"
  │      │    ├── Message Feed (Bubble percakapan mitra & AI)
  │      │    ├── Quick Shortcut Pills (Restock, Lapor Stok, Scan Resi, Log, Profil)
  │      │    └── Input Text & Send Button
  │      │
  │      └── Action Button: "Mulai Panduan Langsung"
  │             │
  │             ▼
  └── 2. Product Tour Spotlight Controller (MitraProductTour)
         ├── Pindah tab aktif secara otomatis (setTab)
         ├── Overlay Spotlight dengan cutout fokus ke elemen target (data-tour)
         └── Tooltip Popover (Langkah X dari Y, instruksi, tombol Mundur / Lanjut / Selesai)
```

---

## 3. Rincian Desain & Modul yang Dikerjakan

### A. Backend Knowledge & Intent Engine (`apps/api/src/modules/assistant/index.ts`)
- **Endpoint**: `POST /assistant/mitra/chat`
- **Autentikasi**: JWT Bearer token mitra (`getAuthUser`).
- **Skema Permintaan**:
  ```typescript
  {
    message: string // Pertanyaan atau teks dari mitra
  }
  ```
- **Skema Respons**:
  ```typescript
  {
    reply: string,
    suggestedTour?: 'restock' | 'stock_report' | 'delivery' | 'logs' | 'profile',
    tourLabel?: string,
    quickReplies: string[]
  }
  ```
- **Katalog Pengetahuan Internal (Knowledge Base)**:
  - Definisi status stok: *Aman (>50%)*, *Waspada (20%-50%)*, *Kritis (<=20%)*, dan *Belum update (>24 jam)*.
  - Alur restock: Pengajuan mitra → persetujuan admin pusat → alokasi stok gudang pusat → pengiriman armada logistik → verifikasi resi / barcode dus di toko.
  - Alur verifikasi resi: Pindai kamera barcode atau input kode resi fisik yang tertera pada kardus paket pengiriman.

### B. Komponen Product Tour Controller (`apps/web/src/components/inventory/mitra-product-tour.tsx`)
Mengelola sorotan spotlight interaktif untuk 5 modul utama:

1. **`tour-restock` (Alur Restock Barang)**:
   - **Step 1**: Sorot kartu *Stok Gudang Pusat Daisuki* (cek stok pusat yang siap kirim).
   - **Step 2**: Sorot input kuantitas *Tambah Pesanan* (jelaskan mitra bebas menentukan jumlah kebutuhan toko).
   - **Step 3**: Sorot kolom *Catatan Cabang* (opsional untuk catatan pengiriman logistik).
   - **Step 4**: Sorot tombol *Kirim Permintaan Restock*.

2. **`tour-stock-report` (Laporan Stok Harian Toko)**:
   - **Step 1**: Sorot kartu *Laporan Harian - Stok Saya*.
   - **Step 2**: Sorot kontrol tombol counter `+` / `-` sisa fisik di rak.
   - **Step 3**: Sorot badge status stok (*Aman*, *Waspada*, *Kritis*).
   - **Step 4**: Sorot tombol *Simpan Laporan Stok*.

3. **`tour-delivery` (Penerimaan Barang & Scan Resi)**:
   - **Step 1**: Pindah ke tab *Riwayat*.
   - **Step 2**: Sorot kartu pesanan yang berstatus *Dalam Pengiriman*.
   - **Step 3**: Sorot tombol *Konfirmasi Barang Sampai / Scan Resi*.
   - **Step 4**: Jelaskan modal scanner barcode untuk memvalidasi fisik kiriman sebelum stok toko otomatis bertambah.

4. **`tour-logs` (Riwayat & Log Mutasi)**:
   - **Step 1**: Sorot daftar riwayat pesanan (filter status & catatan admin).
   - **Step 2**: Sorot tab *Log* yang mencatat rekaman pengurangan stok manual harian dan penambahan restock.

5. **`tour-profile` (Profil & Wilayah Cabang)**:
   - **Step 1**: Sorot informasi nama PIC dan nomor telepon cabang.
   - **Step 2**: Sorot pemilihan wilayah hierarkis (Provinsi hingga Desa/Kelurahan) agar rute distribusi kurir akurat.

### C. Komponen Chatbot Widget (`apps/web/src/components/inventory/mitra-ai-assistant.tsx`)
- Desain antarmuka profesional (*clean anti-slop*):
  - Mengikuti palet sistem desain Daisuki (`--color-text`, `--color-paper`, `--color-line`).
  - Menggunakan font *Bricolage Grotesque* untuk judul dan *Figtree* untuk teks chat.
  - Posisi melayang di pojok kanan bawah dengan elevasi yang tidak menutupi navigasi mobile.
- Fitur chat:
  - Welcome greeting otomatis dengan 5 tombol pintasan cepat (*quick pills*).
  - Indikator mengetik (*typing animation*).
  - Tombol aksi *"Mulai Panduan Ini"* pada pesan AI yang memiliki panduan tur terkait.
  - Dukungan pengetikan manual pertanyaan bebas.

### D. Integrasi pada Portal Mitra (`apps/web/src/routes/mitra.tsx`)
- Menambahkan atribut target `data-tour="..."` pada elemen-elemen kunci di halaman mitra:
  - `data-tour="central-stock-card"`
  - `data-tour="daily-report-card"`
  - `data-tour="daily-report-counter"`
  - `data-tour="save-stock-button"`
  - `data-tour="restock-item-input"`
  - `data-tour="restock-note-input"`
  - `data-tour="submit-order-button"`
  - `data-tour="order-history-list"`
  - `data-tour="delivery-confirm-button"`
  - `data-tour="profile-section"`
- Menghubungkan callback pemilihan tour dengan fungsi `setTab(targetTab)` agar perpindahan tab berjalan mulus sebelum spotlight muncul.

---

## 4. Rencana Verifikasi & Pengujian

| Pengujian | Langkah Pengujian | Hasil yang Diharapkan |
|---|---|---|
| **Shortcut Restock** | Klik shortcut *"Bagaimana cara restock barang?"* | AI merespons penjelasan dan memunculkan tombol *"Mulai Panduan Restock"* |
| **Product Tour Restock** | Klik tombol panduan pada chat restock | Chat terminimize, tab berpindah ke `Restock/Pesan`, spotlight menyorot Step 1 sampai 4 |
| **Shortcut Lapor Stok** | Klik shortcut *"Bagaimana cara lapor stok harian?"* | AI merespons, tab berpindah ke `Stok`, spotlight menyorot kartu laporan fisik harian |
| **Shortcut Scan Resi** | Klik shortcut *"Bagaimana cara konfirmasi barang sampai?"* | AI merespons, tab berpindah ke `Riwayat`, spotlight menyorot tombol verifikasi resi |
| **Pertanyaan di Luar Topik** | Ketik pertanyaan umum (misal: *"Siapa penemu listrik?"*) | AI menolak dengan sopan dan menegaskan fungsinya khusus inventaris Daisuki |
| **Tampilan Mobile** | Buka portal mitra pada resolusi ponsel (375px–480px) | Widget chat dan spotlight tour pas di layar tanpa merusak layout floating nav bar |
