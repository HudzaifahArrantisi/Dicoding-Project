# PROMPT EKSEKUSI CODEX: Implementasi RAG Chatbot Asisten Mitra Menggunakan 9Router Proxy & Data daisuki.pkl

Salin seluruh teks di bawah ini dan masukkan ke prompt Codex untuk mengeksekusi integrasi RAG pada chatbot mitra secara otomatis.

---

```markdown
# TASK: Implementasi Sistem RAG pada Chatbot Asisten Mitra Daisuki Menggunakan 9Router Proxy (Local/Tunnel) & Otak Data Terpusat (PostgreSQL + daisuki.pkl)

Tolong implementasikan arsitektur Retrieval-Augmented Generation (RAG) pada modul Chatbot Asisten Mitra (`apps/api/src/modules/assistant/` dan `apps/web/src/components/inventory/mitra-ai-assistant.tsx`) sesuai perencanaan teknis di `docs/PLANNING_RAG_CHATBOT_MITRA.md` dengan detail instruksi berikut:

---

## 1. Aturan Bisnis & Arsitektur Wajib (Strict Rules)
1. **Strictly Bun Runtime**: Gunakan `bun` untuk seluruh eksekusi TS/JS. Dilarang menggunakan npm/yarn/pnpm.
2. **Kapasitas Stok Bebas (Unbounded Stock)**:
   - Sesuai `CLAUDE.md`, TIDAK ADA batas maksimal 40 pcs pada stok mitra. Jangan pernah membatasi stok atau menyebut kapasitas rak 40 pcs di dalam prompt sistem LLM.
3. **4 Produk Resmi Daisuki**:
   - Hanya proses 4 produk resmi: Seblak Jadul Instan, Basreng Daun Jeruk, Makaroni Daun Jeruk, Keripik Pisang Rasa Coklat.
4. **Anti-Halusinasi & Zero-Hallucination**:
   - LLM dilarang mengarang angka stok, nama produk lain, atau nomor PO imajiner. Semua angka wajib merujuk langsung ke fakta JSON yang disuplai oleh database dan model `daisuki.pkl`.
5. **Graceful Fallback**:
   - Jika 9Router offline, tunnel putus, atau request timeout (> 8 detik), sistem HARUS otomatis kembali memanggil `composeMitraReply()` eksisting tanpa melempar error 500 ke mitra.

---

## 2. Kredensial & Konfigurasi 9Router Proxy
Tambahkan variabel lingkungan di `apps/api/.env` (dan file contoh jika ada):
```env
LLM_ENABLED=true
LLM_BASE_URL=http://localhost:20128/v1
LLM_TUNNEL_URL=https://rfngsre.abc-tunnel.us/v1
LLM_API_KEY=<isi-di-env-api>
LLM_MODEL=opn
LLM_TIMEOUT_MS=8000
```
*Catatan: Buat sistem mencoba `LLM_BASE_URL` terlebih dahulu (untuk kecepatan lokal), jika gagal/unreachable dan ada `LLM_TUNNEL_URL`, gunakan fallback ke URL tunnel.*

---

## 3. Langkah-Langkah Pengerjaan Teknis

### Langkah 1: Buat Klien Pemanggil 9Router (`apps/api/src/modules/assistant/llm-client.ts`)
Buat helper function `generateLlmReply({ systemPrompt, userMessage }: { systemPrompt: string; userMessage: string }): Promise<string | null>`:
- Mengirim HTTP POST ke `${baseURL}/chat/completions` dengan header `Authorization: Bearer ${LLM_API_KEY}` dan `Content-Type: application/json`.
- Payload standar OpenAI:
  ```json
  {
    "model": process.env.LLM_MODEL || "opn",
    "messages": [
      { "role": "system", "content": systemPrompt },
      { "role": "user", "content": userMessage }
    ],
    "temperature": 0.3,
    "max_tokens": 600
  }
  ```
- Implementasikan `AbortSignal.timeout(Number(process.env.LLM_TIMEOUT_MS || 8000))` untuk mencegah proses menggantung jika koneksi lambat.
- Tangkap semua exception (network error, timeout, non-200 status) dan kembalikan `null` agar memicu fallback.

### Langkah 2: Buat RAG Prompt & Context Builder (`apps/api/src/modules/assistant/rag-prompt.ts`)
Buat function `buildMitraRagPrompt(context: MitraContext, model: ModelResult, previousIntent?: string | null): string`:
- Format fakta operasional toko secara terstruktur:
  1. Identitas Mitra (Nama Cabang, Tipe Usaha, Nama PIC, Kota/Wilayah).
  2. Data Stok Riil Toko (Nama 4 produk, Sisa Stok pcs, Buffer Pengaman, Rata-rata Penjualan 7 hari, Sisa Hari Persediaan / Days of Supply).
  3. Ketersediaan Stok Gudang Pusat Daisuki (Ready Stock per produk).
  4. Hasil Klasifikasi Model `daisuki.pkl` (Prediksi Risiko: `urgent_restock` / `regular_order` / `normal`, serta estimasi confidence).
  5. Pesanan Terakhir / Dalam Pengiriman (No PO, status, rincian barang).
- Berikan instruksi sistem (*System Instructions*):
  - Berperan sebagai Asisten Pintar Daisuki B2B yang ramah, sopan, dan sigap membantu mitra toko.
  - Jawab pertanyaan langsung ke intinya dengan bahasa Indonesia santun dan profesional.
  - Prioritaskan produk yang berlabel `urgent_restock` untuk segera direstock.
  - Jangan mengarang angka atau fakta di luar data yang diberikan.

### Langkah 3: Integrasikan ke Endpoint Assistant (`apps/api/src/modules/assistant/index.ts`)
Pada endpoint `POST /assistant/mitra/chat`:
- Setelah mengambil `context = await loadMitraContext(user.partnerId)` dan memproses `model = await predictMitraStocks(...)`:
- Cek jika `process.env.LLM_ENABLED === "true"`:
  - Bangun prompt RAG via `buildMitraRagPrompt(...)`.
  - Panggil `generateLlmReply(...)`.
  - Jika berhasil mendapatkan teks respon dari 9Router:
    - Gunakan teks tersebut sebagai `reply`.
    - Tentukan `suggestedTour` atau rekomendasi aksi jika relevan (misal tour `restock` jika mitra menanyakan cara pesan).
  - Jika `generateLlmReply` mengembalikan `null` (offline/gagal):
    - Jalankan fallback ke `composeMitraReply(message, context, model, previousIntent, classified)`.
- Simpan chat event ke database `assistant_chat_events` seperti biasa.

### Langkah 4: Optimasi Tampilan Chatbot di Frontend (`apps/web/src/components/inventory/mitra-ai-assistant.tsx`)
- Pastikan teks jawaban yang mengandung format Markdown (seperti bold `**teks**`, bullet list `- poin`, atau nomor urut) dapat dirender dengan rapi di bubble chat asisten.
- Tambahkan badge penanda kecil "AI" atau indikator responsif yang halus pada bubble chat asisten saat asisten memberikan jawaban kontekstual.
- Pertahankan tour navigation (`onStartTour`) dan tombol thumbs up / down feedback yang sudah ada.

### Langkah 5: Pengujian & Log Perubahan Harian
1. Jalankan typecheck di kedua workspace:
   ```bash
   bun --cwd apps/api run typecheck
   bun --cwd apps/web run typecheck
   ```
2. Pastikan tidak ada error TypeScript.
3. Catat ringkasan perubahan ke seksi `Catatan Perubahan Harian (Daily Changelog)` pada `CLAUDE.md` dan `AGENTS.md` sesuai format tanggal hari ini (`YYYY-MM-DD`).
```
