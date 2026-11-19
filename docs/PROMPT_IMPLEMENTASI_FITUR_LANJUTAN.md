# MASTER PROMPT: PENGEMBANGAN FITUR LANJUTAN & PENYEMPURNAAN SISTEM DAISUKI INVENTORY

> **Petunjuk Penggunaan:**  
> Salin dan gunakan prompt ini ke AI Coding Agent (Antigravity / Claude Code / Cursor) untuk menjalankan implementasi fitur-fitur lanjutan secara bertahap dan terstruktur tanpa merusak kode atau aturan bisnis yang sudah berjalan.

---

```markdown
Anda adalah Senior Fullstack Developer & AI Engineer yang bertugas mengembangkan fitur lanjutan pada platform **Daisuki B2B Inventory & Order Management System**.

Bacalah seluruh pedoman bisnis, arsitektur teknis, dan batasan sistem di bawah ini sebelum membuat atau memodifikasi kode apa pun.

---

## 1. KONTEKS BISNIS & ATURAN RANTAI PASOK (SANGAT KRUSIAL)

1. **Entitas & Model Manufaktur**:
   - **Brand Principal**: PT Yan Group GFS (pemegang lisensi merek HAKI Daisuki).
   - **Pabrik Maklon**: PT Kim Manufaktur (menangani produksi makanan ringan hingga pengemasan).
   - **4 Produk Resmi**: 
     1. Seblak Jadul Instan
     2. Basreng Daun Jeruk
     3. Makaroni Daun Jeruk
     4. Keripik Pisang Rasa Coklat

2. **Skema Distribusi**:
   - **Titip Jual**: Barang yang diterima mitra menjadi stok cabang. Estimasi penjualan dihitung dari log penurunan stok fisik yang dicatat mitra, dengan harga normal Rp27.500/pcs untuk Seblak dan Rp25.000/pcs untuk produk lain.
   - **Aturan Deadstock (Pencegahan Macet)**: Barang yang tidak terjual dalam waktu 1 bulan (maksimal 3 bulan) wajib diberi tanda peringatan untuk ditarik kembali oleh tim direct sales lapangan agar perputaran kas sehat dan mencegah barang kadaluarsa.

3. **Siklus Restock Pabrik & Pre-Order (PO)**:
   - Pengiriman pabrik ke gudang pusat dilakukan 2x per bulan dengan kapasitas 6.000–10.000 pcs (sekitar 1 ton).
   - Jika stok gudang pusat siap (`central_stock` > 0), pesanan mitra dapat dikirim hari itu juga.
   - Jika stok gudang pusat 0, masa Pre-Order pabrik memakan waktu hingga 2 minggu. Pesanan tidak boleh ditolak mentah-mentah, melainkan masuk ke status **Ditunda / Backorder**.

4. **Area Pasar & Karakteristik Pengguna**:
   - Pasar lokal terpusat di wilayah Bekasi; pasar ekspor sudah ke Jepang dan rencana ekspansi ke Malaysia pada 2027.
   - PIC Mitra di lapangan mencakup kalangan senior di hotel, restoran, dan kafe yang terbiasa menggunakan WhatsApp. Antarmuka harus sangat mudah dipahami, minim teks padat, dengan tombol AI Chatbot yang ditonjolkan di bagian paling atas layar.

---

## 2. ATURAN ARSITEKTUR KODE (STRICT GUIDELINES)

1. **Runtime & Package Manager**: Wajib menggunakan **Bun** (`bun run`, `bun test`, `bun add`). Dilarang keras memakai npm/yarn/pnpm.
2. **Tipografi & Desain**: Seluruh tampilan menggunakan font **Google Sans** dengan angka tabular (`tabular-nums` / `.num`). Target sentuh di mobile minimal 48px.
3. **Batasan Mutasi Database**: Frontend TanStack Start **tidak boleh** melakukan mutasi langsung ke database. Semua mutasi stok, status pesanan, dan approval wajib melalui Elysia API (`apps/api`).
4. **Kalkulasi Stok Cabang**: Stok cabang hanya bertambah sebesar `qty_approved` saat pesanan berpindah ke status `selesai` melalui konfirmasi pemindaian QR/Barcode resi. Tidak ada plafon stok 40 pcs.

---

## 3. RENCANA TUGAS & TAHAPAN IMPLEMENTASI (PHASE-BY-PHASE)

### FASE 1: Estimasi Penjualan Titip Jual
- [x] **API & Backend**: Agregasi log `manual_update` dengan `qty_before > qty_after` untuk estimasi penjualan 7 dan 30 hari, terisolasi menurut mitra pada portal Mitra.
- [x] **Frontend**: Tampilkan estimasi penjualan mitra dan seluruh cabang di dashboard; rincian per mitra tersedia di daftar Stok Cabang.
- [ ] **Verifikasi lapangan**: Cocokkan penurunan stok fisik dengan penjualan sebelum dipakai untuk penagihan.

### FASE 2: Penyempurnaan Alur Pesanan (`Dipacking` & `Ditunda / Backorder`)
- [ ] **Siklus Status Baru**:
  - Alur lengkap: `diproses` ➔ `disetujui` (atau `ditunda`) ➔ `dipacking` ➔ `dalam_pengiriman` ➔ `selesai`.
  - Jika `central_stock < qty_requested`, tawarkan opsi status `ditunda` (*Pre-Order Pabrik*).
  - Admin dapat mengubah pesanan dari `disetujui` ke `dipacking` saat staf gudang menyiapkan barang sebelum kurir tiba.
- [ ] **Auto-Alokasi FIFO saat Stok Masuk**:
  - Saat Admin menambah `central_stock` dari pabrik, buat alur rekomendasi alokasi untuk pesanan berstatus `ditunda` secara FIFO (*First-In First-Out*).

### FASE 3: Redesain UI Portal Mitra Ramah PIC Senior & Penonjolan AI Chatbot
- [ ] **Highlight AI Chatbot**:
  - Tempatkan kartu/hero banner akses cepat Chatbot di paling atas layar portal Mitra: tombol berukuran besar dengan ikon resmi Daisuki, teks jelas: *"Tanya Asisten Daisuki (Stok & Penjualan)"*.
  - Sediakan tombol pintas (*quick prompt chips*) dengan gaya bahasa WhatsApp sederhana (misal: *"Cek sisa stok saya"*, *"Berapa penjualan minggu ini?"*, *"Bantu pesan barang"*).
- [ ] **Sederhanakan Dashboard Mitra**:
  - Perbesar ukuran font angka stok fisik dan gunakan kontras tinggi.
  - Hilangkan teks instruksi panjang yang membingungkan; gunakan kartu visual bersih dengan 3 warna status: Hijau (Aman / Baru Update), Kuning (Waspada < 20 pcs), Merah (Kritis < 10 pcs).
  - Tombol aksi utama (Lapor Stok, Restock, Scan Resi) berukuran minimal 48px ramah jempol.

### FASE 4: Intelegensi Bisnis, Deteksi Deadstock, & Audit Kecurangan
- [ ] **Deteksi Deadstock**:
  - Identifikasi produk di mitra yang tidak mengalami pergerakan fisik / penjualan selama 30–90 hari berturut-turut.
  - Tampilkan penanda *"Potensi Deadstock - Tarik ke Direct Sales"* di dashboard admin.
- [ ] **Skor Anomali & Suspicious Ranking**:
  - Buat algoritma pemeringkatan audit berdasarkan selisih mutasi tidak wajar atau cabang yang tidak lapor stok > 7 hari.
  - Tampilkan daftar prioritas sidak tim lapangan untuk mencegah manipulasi laporan.
- [ ] **Rekomendasi Pemesanan ke Pabrik untuk Admin**:
  - Prediksi total kebutuhan stok seluruh cabang dalam 2 minggu ke depan dan rekomendasikan kuantitas PO ke PT Kim Manufaktur (kelipatan 1 ton / 6.000–10.000 pcs).

### FASE 5: Isolasi RAG Chatbot & Kesiapan Server Pay-on-Demand
- [ ] **Penguatan Guardrail RAG**:
  - Pastikan backend API chat mitra membatasi konteks hanya pada `partner_id` terotentikasi; tolak segala bentuk prompt injection yang berusaha menanyakan data omzet atau identitas mitra lain.
- [ ] **Kesiapan Infrastruktur Pay-on-Demand**:
  - Konfigurasi Dockerfile berbasis `oven/bun` + `python:3.11-slim` untuk backend API dan model `daisuki.pkl` agar siap dijalankan pada platform serverless container *pay-as-you-go* (seperti Koyeb / Railway / Render).

---

## 4. STANDAR VERIFIKASI SEBELUM MENYELESAIKAN PEKERJAAN

1. Jalankan `bun run typecheck` di root workspace; pastikan 0 error TypeScript.
2. Jalankan `bun run --cwd apps/web build`; pastikan build client dan server SSR sukses.
3. Jalankan `bun test`; pastikan seluruh unit test lolos.
4. Catat ringkasan pekerjaan ke seksi `Catatan Perubahan Harian (Daily Changelog)` pada `AGENTS.md` dan `CLAUDE.md`.
```
