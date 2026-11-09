# AI Guardrails & Context Grounding Workspace (Daisuki AI Assistant)

Workspace mandiri di dalam direktori `ai/guardrails/` yang menyediakan sistem pertahanan berlapis (*Defense-in-Depth*) untuk Chatbot Inventaris Daisuki B2B yang menggunakan **RAG (Retrieval-Augmented Generation)** dan terkoneksi ke **LLM Lokal via 9Router**.

---

## 📁 Struktur Workspace

```text
ai/guardrails/
├── __init__.py           # Package exports
├── rules.py              # Definisi 4 produk resmi, status stok, batasan unbounded stock
├── threats.py            # Detektor Prompt Injection, Jailbreak, & System Leakage
├── faithfulness.py       # Engine Context Grounding (Verifikasi angka, PO, dan klaim aksi)
├── prompt.py             # Generator Master Unified System Prompt
├── pipeline.py           # Pipeline orkestrasi (Pre-check -> LLM -> Post-check)
├── test_guardrails.py    # Test suite komprehensif (Unit tests)
└── README.md             # Panduan arsitektur & dokumentasi
```

---

## 🛡️ Lapisan Perlindungan (4-Layer Security Pipeline)

```
[Input Pesan Mitra]
         │
         ▼
[Layer 1: Pre-Guardrail (threats.py)]
  ├─ Cek Upaya Prompt Injection ("Abaikan instruksi sebelumnya...")
  ├─ Cek Upaya Jailbreak ("Mode developer aktif...")
  └─ Cek Penyelidikan Data Sensitif (DB connection, JWT, 9router probe)
         │ (Jika lolos)
         ▼
[Layer 2: Prompt Assembly (prompt.py)]
  ├─ Injeksi FAKTA_JSON (Hanya data mitra terautentikasi / Tenant Isolation)
  ├─ Injeksi Aturan Bisnis Daisuki (Unbounded Stock, 4 Produk Resmi)
  └─ Injeksi Instruksi Read-Only (Larangan klaim mutasi)
         │
         ▼
[Layer 3: 9Router Local LLM Inference]
  └─ Model lokal mengeksekusi inferensi dengan prompt terstruktur
         │
         ▼
[Layer 4: Post-Guardrail (faithfulness.py & threats.py)]
  ├─ Deteksi Kebocoran Format/Sistem (Anti-Leakage & No-HTML/Script)
  ├─ Grounding Angka Numerik (Dilarang ada angka di luar FAKTA_JSON)
  ├─ Grounding Nomor PO (Hanya nomor PO nyata mitra)
  ├─ Larangan Istilah Plafon/Kapasitas Rak (Unbounded Stock Enforcement)
  └─ Larangan Klaim Mutasi ("Sudah mengubah/menambah stok")
         │
    ┌────┴────────────────────────┐
 [Lolos]                       [Gagal]
    │                             │
    ▼                             ▼
Kirim Jawaban Asli         Fallback Aman Terverifikasi
```

---

## 🚀 Cara Menjalankan & Pengujian

### 1. Menjalankan Unit Tests
Jalankan perintah berikut di terminal:
```bash
python -m unittest ai/guardrails/test_guardrails.py
```

### 2. Contoh Penggunaan di Python
```python
from ai.guardrails import GuardrailPipeline

pipeline = GuardrailPipeline()

# 1. Pre-check pesan user
is_safe, error_reply = pipeline.pre_check("Berapa stok Dimsum Udang saya?")
if not is_safe:
    return error_reply

# 2. Buat prompt untuk dikirim ke 9Router
system_prompt = pipeline.create_prompt(facts=partner_facts, memory=chat_memory)

# 3. Post-check setelah LLM menjawab
is_valid, final_reply, status = pipeline.post_check(llm_response, facts=partner_facts)
print(f"Status: {status}")
print(f"Jawaban ke user: {final_reply}")
```

---

## 📌 Keselarasan dengan Sistem Utama
- **TypeScript API ([apps/api/src/modules/assistant/](apps/api/src/modules/assistant/))**: Logika di workspace Python ini selaras 100% dengan validator `isGroundedLlmReply` dan pembangun prompt `buildMitraRagPrompt` di API Elysia.
- **CLAUDE.md & Shared Rules**: Mematuhi aturan *Unbounded Partner Stock* (tanpa batas 40 pcs) dan isolasi multi-tenant berbasis JWT.
