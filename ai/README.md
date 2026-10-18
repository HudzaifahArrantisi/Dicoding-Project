# AI Engineering — Daisuki Inventory

## 1. Tujuan
Menjalankan hasil model Data Science secara otomatis dan menyediakan fitur berbasis AI:
- Job harian rekomendasi restock otomatis.
- Asisten admin berbasis LLM (*tool calling*).
- Input stok cabang via chat.
- Ringkasan laporan mingguan (*weekly summary*).

## 2. Pemilik
Tim AI Engineer.

## 3. Struktur Folder

| Folder | Keterangan |
|---|---|
| `jobs/` | Skrip background job harian yang menghitung dan menulis ke tabel `restock_recommendations` |
| `assistant/` | Modul asisten admin LLM yang terintegrasi dengan *tool calling* API |
| `bot/` | Layanan input stok via antarmuka chat (prototipe Telegram) |
| `evals/` | Skrip pengujian akurasi parsing input chat dan performa respon asisten AI |

## 4. Setup (PowerShell)

Jalankan perintah berikut di PowerShell untuk menyiapkan lingkungan kerja:

```powershell
cd ai
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

> **Catatan:** Jika eksekusi `Activate.ps1` diblokir oleh PowerShell, jalankan perintah berikut sekali di terminal:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```

## 5. Akses dan Keamanan
- `DATABASE_URL` menggunakan role PostgreSQL `ai_job` (memiliki hak baca tabel inti dan hak tulis hanya ke tabel `restock_recommendations`).
- Asisten admin hanya boleh memanggil endpoint API berstatus *read-only* melalui `API_BASE_URL` dan **dilarang keras** mengeksekusi perintah SQL mentah secara bebas.
- Mitra tidak boleh memiliki akses atau melihat data mitra lain melalui respon AI (wajib mematuhi batasan *tenant isolation*).
- Semua API key (LLM, Telegram token, database) hanya disimpan dalam file `.env`.

## 6. Output yang Diharapkan
- Job harian yang mengeksekusi inferensi model dan menyimpan rekomendasi ke database.
- Asisten cerdas untuk dashboard admin dengan kemampuan *function/tool calling*.
- Prototipe bot input stok chat yang menyertakan tahap konfirmasi data sebelum menyimpan transaksi.
- Modul pembuatan ringkasan performa dan kebutuhan inventaris mingguan.
- Dokumentasi hasil pengujian dan akurasi di folder `evals/`.

## 7. Aturan
- Jangan pernah meng-commit file `.env`, API key, atau token ke repositori git.
