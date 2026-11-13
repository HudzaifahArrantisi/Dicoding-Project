# Training manual Daisuki AI

Jalankan perintah dari root proyek. Ketiga pilihan di bawah memakai skrip yang sama, `ai/retraining/train_daisuki.py`, tetapi membaca sumber dan memperbarui bagian model yang berbeda.

| Pilihan | Panduan | Sumber utama | Bagian `daisuki.pkl` yang diperbarui |
| --- | --- | --- | --- |
| 1 | [Analisis internal](01-analisis-internal.md) | Run Data Science: empat JSON dan CSV | Indeks analisis per mitra, classifier risiko, classifier intent |
| 2 | [Referensi mentah](02-referensi-mentah.md) | PDF di `raw_references/pdf/`; dokumen yang dipilih di `pdf/` atau `docs/` | Indeks PDF privat, indeks dokumen publik, classifier intent |
| 3 | [Gabungan](03-gabungan.md) | Kedua kelompok sumber di atas | Seluruh bagian pada pilihan 1 dan 2 |

Model manual disimpan di `ai/data/private/manual/daisuki.pkl`. File ini diabaikan Git karena dapat berisi data analisis mitra dan teks PDF mentah. Vektornya adalah TF-IDF numerik dari potongan karakter, bukan embedding neural atau model bahasa pembuat jawaban. Saat chat, API mengambil fakta operasional terbaru dari PostgreSQL; `daisuki.pkl` menyumbang klasifikasi dan cuplikan yang relevan. Hanya cuplikan analisis dengan `partner_id` dari JWT yang dapat diteruskan ke chatbot mitra.

Sebelum menjalankan salah satu pilihan, siapkan Python virtual environment dan dependensi dari `ai/requirements.txt`. Pada Windows PowerShell:

```powershell
python -m venv ai/.venv
ai/.venv/Scripts/python.exe -m pip install -r ai/requirements.txt
```

Jika API akan memakai hasil training manual, isi `DAISUKI_MODEL_PATH=ai/data/private/manual/daisuki.pkl` di `apps/api/.env` dan mulai ulang API. Ini adalah override lokal; alur publikasi run melalui Admin tetap terpisah.
