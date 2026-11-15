# Daisuki Inventory  B2B Inventory & Order Management

Platform manajemen inventaris dan pemesanan restock multi-tenant B2B antara **Admin Daisuki Pusat** dan **Mitra Cabang** (hotel, kafe, restoran, dan minimarket).

---

## Tech Stack

| Kategori | Teknologi & Framework | Keterangan |
|---|---|---|
| **Runtime & Monorepo** | ![Bun](https://img.shields.io/badge/Bun-000000?style=flat-square&logo=bun&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) | Bun Monorepo workspace & runtime berkecepatan tinggi |
| **Frontend Web** | ![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB) ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) | TanStack Start, Tailwind v4, TanStack Query |
| **Backend API** | ![ElysiaJS](https://img.shields.io/badge/ElysiaJS-000000?style=flat-square&logo=elysia&logoColor=white) ![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=flat-square&logo=drizzle&logoColor=black) | Bun runtime, Jose JWT, End-to-end Type Safety (Eden Treaty) |
| **Database** | ![Neon PostgreSQL](https://img.shields.io/badge/Neon_PostgreSQL-00E599?style=flat-square&logo=postgresql&logoColor=black) | Serverless PostgreSQL via connection pooling |
| **Data Science & AI** | ![Python](https://img.shields.io/badge/Python_3.10+-3776AB?style=flat-square&logo=python&logoColor=white) ![Scikit-Learn](https://img.shields.io/badge/scikit--learn-F7931E?style=flat-square&logo=scikit-learn&logoColor=white) | Multi-Factor Naive Bayes, Text Filtering, & Demand Forecasting |

---

## Arsitektur RAG & Alur Kerja LLM (Sebelum Training hingga User Prompt)

Sistem AI pada **Daisuki Inventory** menggabungkan **Retrieval-Augmented Generation (RAG)**, **klasifikasi Machine Learning lokal (`daisuki.pkl`)**, dan **data operasional real-time PostgreSQL** untuk menghasilkan asisten cerdas yang akurat dan bebas halusinasi.

Berikut adalah diagram alir (*flowchart*) menyeluruh dari persiapan data sebelum training hingga respons diterima pengguna:

```mermaid
flowchart TD
    %% Subgraph 1: Sebelum Training
    subgraph P1 ["Fase 1: Persiapan Data dan Sanitasi (Sebelum Training)"]
        D1["Dokumen Referensi Mentah: Karya Ilmiah Hudzaifah, Jurnal 1-5, PDF, DOCX"]
        D2["Data Profil dan SOP Perusahaan: Profil Daisuki, SOP, Kamus Intent"]
        D3["Data Analisis Historis: JSON Analitik dan CSV Handoff dari PostgreSQL"]
        
        P_NORM["Normalisasi dan Sanitasi Teks: Pembersihan spasi PDF dan penyamaran data sensitif PII"]
        P_CHUNK["Pemotongan Dokumen (Chunking): Pemisah Section dan potongan ~1.500 karakter"]
        
        D1 --> P_NORM
        D2 --> P_NORM
        D3 --> P_NORM
        P_NORM --> P_CHUNK
    end

    %% Subgraph 2: Training & Indexing
    subgraph P2 ["Fase 2: Training, Indexing dan Kebijakan Hak Akses"]
        T_VECT["Ekstraksi Fitur TF-IDF: N-gram kata kunci domain dan istilah ilmiah"]
        T_MODEL["Pelatihan Model Klasifikasi: Multinomial Naive Bayes untuk Intensi dan Prediksi Risiko"]
        T_POLICY["Pemisahan Kebijakan Akses RAG: Dokumen Publik Mitra vs Dokumen Privat Admin"]
        T_EXPORT["Serialisasi Artefak: Pembentukan daisuki.pkl dan Dokumen Markdown Publik"]
        
        P_CHUNK --> T_VECT
        T_VECT --> T_MODEL
        T_MODEL --> T_POLICY
        T_POLICY --> T_EXPORT
    end

    %% Subgraph 3: Runtime & Context Aggregation
    subgraph P3 ["Fase 3: Runtime Background Worker dan Agregasi Konteks"]
        W_WORKER["Python Inference Worker: Menjaga model daisuki.pkl aktif di RAM (IPC stdin/stdout)"]
        API_CORE["ElysiaJS Backend API Engine: Modul asisten cerdas terintegrasi JWT"]
        DB_LIVE[("Neon PostgreSQL Real-time: Ready stock pusat, stok cabang, pesanan diproses")]
        DB_MEM[("Memori Sesi Percakapan: Ringkasan riwayat sesi dan sliding window pesan")]
        
        T_EXPORT -.->|Dimuat saat worker startup| W_WORKER
        W_WORKER <-->|Pertukaran data inferensi via JSON| API_CORE
        DB_LIVE -->|Data mutasi dan stok riil terkini| API_CORE
        DB_MEM -->|Konteks percakapan aktif| API_CORE
    end

    %% Subgraph 4: User Prompt & Augmented Retrieval
    subgraph P4 ["Fase 4: User Prompt, Pre-Guardrails dan RAG Assembly"]
        USER["Pengguna: Mitra Cabang atau Admin Pusat"]
        UI_CHAT["Antarmuka Chat Web: Tab Chat AI dengan Multi-Sesi dan Saran Cepat"]
        
        G_PRE["Pre-Guardrails dan Isolasi Tenant: Pencegahan Prompt Injection dan Validasi Hak Akses Cabang"]
        RAG_RETRIEVE["Hybrid RAG Retrieval: Vektor TF-IDF daisuki.pkl dan Pencarian Cuplikan Markdown"]
        PROMPT_BUILD["Penyusunan Augmented Prompt: Penggabungan Fakta DB, Hasil ML, RAG, dan Memori"]
        
        USER -->|Kirim Pertanyaan atau Perintah| UI_CHAT
        UI_CHAT -->|Permintaan HTTP REST / SSE| API_CORE
        API_CORE --> G_PRE
        G_PRE --> RAG_RETRIEVE
        RAG_RETRIEVE --> PROMPT_BUILD
    end

    %% Subgraph 5: LLM Inference & Post-Verification
    subgraph P5 ["Fase 5: Eksekusi LLM, Grounding Check dan Presentasi"]
        LLM_CALL["LLM Gateway Eksternal: 9Router / Google Gemini / Groq Cloud"]
        G_POST["Post-Guardrails dan Grounding Check: Verifikasi angka stok riil dan anti-halusinasi nomor PO"]
        FALLBACK["Local Deterministic Fallback: Jawaban faktual langsung jika LLM timeout atau offline"]
        UI_OUT["Presentasi Respons: Rendering Markdown, Tabel Data, dan Badge Status"]
        
        PROMPT_BUILD --> LLM_CALL
        LLM_CALL -->|Berhasil mendapatkan respons| G_POST
        LLM_CALL -.->|Gagal atau Timeout| FALLBACK
        G_POST -->|Lolos verifikasi fakta| UI_OUT
        FALLBACK --> UI_OUT
        UI_OUT --> UI_CHAT
        UI_OUT -.->|Penyimpanan ringkasan sesi| DB_MEM
    end
```

### Tahapan Alur Kerja Sistem RAG Daisuki:

1. **Fase 1: Persiapan Data & Sanitasi (Sebelum Training)**
   - Dokumen sumber berupa naskah ilmiah (*Karya Ilmiah Hudzaifah Ar-Rantisi* dan jurnal referensi), profil perusahaan, SOP inventaris, kamus intensi pengguna, serta data historis PostgreSQL dibaca dan dinormalisasi.
   - Dilakukan sanitasi otomatis: teks PDF yang terpecah per kata disatukan kembali, watermark dibersihkan, dan informasi sensitif (PII seperti nomor kontak/email korespondensi) disamarkan.
   - Dokumen dipecah menjadi potongan (*chunks*) terstruktur per bagian (`\n---\n`) berukuran ~1.500 karakter dengan tetap mempertahankan tabel empiris dan terminologi domain.

2. **Fase 2: Training, Indexing & Kebijakan Hak Akses**
   - Skrip training mengekstraksi bobot kata menggunakan TF-IDF (unigram & bigram) untuk kata kunci operasional dan penelitian (`nlp`, `sgd`, `mbg`, `sentiment`, `logistic regression`, `rop`, `safety stock`).
   - Melatih model klasifikasi **Multinomial Naive Bayes** untuk membedakan intensi percakapan dan memprediksi risiko kehabisan stok cabang (*urgent_restock*, *regular_order*, *normal*).
   - Menerapkan kebijakan batas akses (*RAG policy*): dokumen yang disetujui publik diekspor ke `.public.md` untuk Mitra Toko, sedangkan naskah privat dan data internal diindeks khusus untuk Admin Pusat.
   - Seluruh bobot, kamus, dan classifier diserialisasi ke dalam satu artefak model biner `daisuki.pkl`.

3. **Fase 3: Runtime Background Worker & Agregasi Konteks**
   - Backend ElysiaJS menjalankan proses latar belakang Python (`inference_worker.py`) menggunakan `Bun.spawn` yang menjaga model `daisuki.pkl` tetap aktif di RAM agar inferensi berjalan instan (< 50ms) tanpa overhead pembacaan berkas berulang.
   - API secara langsung melakukan agregasi data terkini dari Neon PostgreSQL: stok ready gudang pusat, kuantitas riil cabang, status buffer dinamis, pesanan yang sedang menunggu persetujuan, dan pengiriman aktif.
   - Memori percakapan memuat riwayat 4–6 pesan terakhir ditambah ringkasan padat sesi terdahulu dari PostgreSQL.

4. **Fase 4: User Prompt, Pre-Guardrails & RAG Assembly**
   - Ketika pengguna (Mitra atau Admin) mengirimkan pesan melalui UI chat:
     - **Pre-Guardrails** memvalidasi token JWT pengguna, menegakkan isolasi tenant (Mitra hanya dapat melihat data cabangnya sendiri, Admin memiliki akses jaringan penuh), dan menyaring upaya *prompt injection* atau pertanyaan di luar lingkup.
     - **Hybrid Retrieval** mencocokkan intensi pengguna via `daisuki.pkl`, mengambil skor prediksi risiko, dan mengambil hingga 4 cuplikan dokumen Markdown yang paling relevan.
     - **Penyusunan Prompt Terpadu (*Augmented Prompt*)**: Menggabungkan fakta operasional JSON database, hasil prediksi model Naive Bayes, cuplikan naskah RAG, dan ringkasan riwayat ke dalam format prompt terstruktur.

5. **Fase 5: Eksekusi LLM, Grounding Check & Presentasi**
   - Prompt dikirimkan ke LLM (9Router, Gemini, atau Groq) dengan streaming SSE untuk respon yang interaktif.
   - **Post-Guardrails & Grounding Verification**: Memastikan jawaban LLM tidak mengarang angka kuantitas stok atau nomor pesanan yang tidak ada di fakta database.
   - **Fallback Deterministik**: Jika layanan LLM eksternal mengalami gangguan atau melampaui batas waktu (*timeout*), mesin fallback lokal secara otomatis menyusun jawaban faktual langsung dari database dan dokumen RAG tanpa membiarkan pengguna menunggu pesan error kosong.
   - Respons akhir dirender secara kaya di frontend React dengan format Markdown, tabel data HTML responsif, dan chip saran pertanyaan berikutnya.

---

## Panduan Setup Cepat (Mulai dari Nol)

Pastikan sudah menginstal **[Git](https://git-scm.com/)** dan **[Bun](https://bun.sh/)** di komputer Anda.  
*(Wajib menggunakan runtime **Bun**. Jangan gunakan npm, yarn, atau pnpm).*

### 1. Clone Repository & Masuk ke Folder
```bash
git clone https://github.com/HudzaifahArrantisi/Dicoding-Project.git daisuki-inventory
cd daisuki-inventory
```

### 2. Install Dependensi
Jalankan perintah ini di root folder untuk menginstal seluruh dependensi workspace:
```bash
bun install
```

### 3. Konfigurasi File Environment (.env)

Salin template file `.env.example` ke `.env`:

**Windows (PowerShell):**
```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

**Linux / macOS / Git Bash:**
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Buka dan sesuaikan file berikut:
- **`apps/api/.env`**:
  ```env
  PORT=3001
  DATABASE_URL=postgresql://<user>:<password>@<host-neon>/neondb?sslmode=require
  WEB_ORIGIN=http://localhost:3000
  JWT_SECRET=daisuki-super-secret-key-min-32-characters-change-in-production
  ```
  *(Ambil connection string `DATABASE_URL` dari dashboard [Neon DB](https://neon.tech) pada menu **Connect**).*

- **`apps/web/.env`**:
  ```env
  VITE_API_URL=http://localhost:3001
  ```

---

### 4. Setup Database & Data Demo

1. **Setup Skema Database & Data Demo**:  
   Buka menu **SQL Editor** di console database Anda ([Neon DB](https://neon.tech)), lalu salin dan jalankan seluruh isi file skema database terpadu:  
    **`neon/init.sql`**  
   *(File tunggal ini sudah mencakup seluruh ekstensi, enum, tabel, kolom wilayah, optimasi index, hak akses RLS, dan seed data awal).*

   Pilihan provinsi, kabupaten/kota, kecamatan, dan kelurahan/desa diambil melalui API backend dari [Wilayah.id](https://wilayah.id/). Server API memerlukan akses HTTPS ke layanan tersebut saat daftar wilayah belum tersedia di cache.

2. **Isi Data Awal (Seeding)**:  
   Setelah tabel berhasil dibuat, isi data awal demo (cabang, 4 produk resmi, dan akun demo) dengan perintah:
   ```bash
   bun --cwd apps/api run seed
   ```

---

### 5. Jalankan Aplikasi

Jalankan frontend web dan backend API sekaligus:
```bash
bun run dev
```

Aplikasi siap diakses di browser:
- **Web Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:3001`
- **Cek Koneksi Database**: `http://localhost:3001/health/db`

---

---

##  Perintah Pengembangan Harian

| Perintah | Keterangan |
|---|---|
| `bun run dev` | Menjalankan Web (port 3000) & API (port 3001) secara bersamaan |
| `bun run dev:web` | Menjalankan hanya Frontend web |
| `bun run dev:api` | Menjalankan hanya Backend API |
| `bun run typecheck` | Pemeriksaan tipe TypeScript di seluruh workspace |
| `bun --cwd apps/web run lint` | Menjalankan ESLint pada frontend |
| `bun --cwd apps/web run build` | Build production frontend |
| `bun --cwd apps/api run seed` | Menjalankan ulang pengisian data demo database |
| `bun run qa:api` | Memeriksa route API lokal dan menampilkan hasil QA per fitur dalam tabel terminal |

---

## QA API saat Development

Jalankan backend API lokal, lalu buka terminal kedua untuk pemeriksaan QA:

```powershell
bun --cwd=apps/api run dev
# Di terminal lain:
bun run qa:api --json qa-reports/api-latest.json
```

Perintah `qa:api` membaca route Elysia langsung dari kode. Output terminal berupa tabel ringkasan dan tabel detail yang dikelompokkan menurut fitur: **Login & Sesi**, **Admin**, **Mitra**, **Pesanan**, **Stok & Produk**, **Wilayah**, serta **Sistem & Berkas**. Kolom `Route` menghitung endpoint unik; kolom `Lulus`, `Gagal`, dan `Skip` menghitung pemeriksaan, sehingga jumlahnya dapat lebih besar dari jumlah route.

Contoh ringkasan terminal:

```text
+---------------------------------+-------+-------+-------+-------+
| Fitur                           | Route | Lulus | Gagal | Skip  |
+---------------------------------+-------+-------+-------+-------+
| Login & Sesi                    | 4     | 4     | 0     | 2     |
| Admin · Dashboard & AI          | 5     | 8     | 0     | 1     |
| Pesanan · Admin & Mitra         | 10    | 4     | 0     | 8     |
+---------------------------------+-------+-------+-------+-------+
```

Untuk menguji GET sebagai pengguna yang sudah login, isi akun **development** melalui environment variable PowerShell sebelum menjalankan `qa:api`:

```powershell
$env:QA_ADMIN_EMAIL = 'email-admin-development'
$env:QA_ADMIN_PASSWORD = 'kata-sandi-admin'
$env:QA_MITRA_EMAIL = 'email-mitra-development'
$env:QA_MITRA_PASSWORD = 'kata-sandi-mitra'
bun run qa:api --json qa-reports/api-latest.json
```

`PASS` berarti status sesuai harapan: HTTP 401 untuk endpoint privat tanpa login, atau HTTP 2xx setelah login. `FAIL` menunjukkan status tidak sesuai, timeout, atau server tidak terjangkau; perintah keluar dengan kode `1`. `SKIP` berarti pemeriksaan belum dijalankan. Mutasi stok dan pesanan sengaja tidak dikirim agar data development tidak berubah. Laporan JSON tersimpan di `qa-reports/api-latest.json` dan memuat kategori setiap pemeriksaan. Petunjuk fixture untuk route dinamis dan opsi lain tersedia di [panduan QA API](docs/API_QA.md).

---

##  Setup Modul Python (Data Science & AI) — *Opsional*

Khusus anggota tim yang mengerjakan modul analisis atau model cerdas di `data-science/` atau `ai/`:

```bash
cd data-science   # atau: cd ai
python -m venv .venv

# Aktivasi virtual environment:
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate

pip install -r requirements.txt
```
