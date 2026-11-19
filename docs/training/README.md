# Training manual Daisuki AI

Jalankan perintah dari root proyek. Ketiga pilihan di bawah memakai satu skrip, `ai/retraining/train.py`, tetapi membaca sumber dan memperbarui bagian model yang berbeda. Pipeline mingguan API memakai skrip yang sama dengan `DAISUKI_ANALYSIS_RUN_ID`; jalankan `--weekly` untuk laporan CSV lokal di luar pipeline API.

| Pilihan | Panduan | Sumber utama | Bagian `daisuki.pkl` yang diperbarui |
| --- | --- | --- | --- |
| 1 | [Analisis internal](01-analisis-internal.md) | Run Data Science: empat JSON dan CSV | Indeks analisis per mitra, classifier risiko, classifier intent |
| 2 | [Semua referensi mentah](02-referensi-mentah.md) | Semua PDF, DOCX, MD, TXT, JSON, dan CSV di `raw_references/` | Indeks referensi privat, indeks dokumen publik, classifier intent |
| 3 | [Satu file](03-satu-file.md) | Satu berkas yang dipilih dengan nama file | Indeks referensi privat khusus file itu, indeks dokumen publik, classifier intent |

Model manual disimpan di `ai/data/private/manual/daisuki.pkl`. File ini diabaikan Git karena dapat berisi data analisis mitra dan teks PDF mentah. Vektornya adalah TF-IDF numerik dari potongan karakter, bukan embedding neural atau model bahasa pembuat jawaban. Saat chat, API mengambil fakta operasional terbaru dari PostgreSQL; `daisuki.pkl` menyumbang klasifikasi dan cuplikan yang relevan. Hanya cuplikan analisis dengan `partner_id` dari JWT yang dapat diteruskan ke chatbot mitra.

Sebelum menjalankan salah satu pilihan, siapkan Python virtual environment dan dependensi dari `ai/requirements.txt`. Pada Windows PowerShell:

```powershell
python -m venv ai/.venv
ai/.venv/Scripts/python.exe -m pip install -r ai/requirements.txt
```

Jika API akan memakai hasil training manual, isi `DAISUKI_MODEL_PATH=ai/data/private/manual/daisuki.pkl` di `apps/api/.env` dan mulai ulang API. Ini adalah override lokal; alur publikasi run melalui Admin tetap terpisah.
