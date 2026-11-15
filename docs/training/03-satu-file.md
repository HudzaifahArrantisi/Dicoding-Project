# Pilihan 3 — satu file raw_references

Gunakan pilihan ini untuk mengindeks satu dokumen tanpa memproses ulang seluruh folder. Berkas harus berada di bawah `ai/data/raw_references/` dan memiliki nama yang unik. Format yang didukung: PDF, DOCX, MD, TXT, JSON, dan CSV.

## Jalankan

Dari root proyek:

```powershell
ai/.venv/Scripts/python.exe ai/retraining/train.py --mode 3 --file "nama-file.pdf"
```

Atau jalankan `train.py` tanpa argumen, pilih `3`, lalu ketik nama file saat diminta. Dari folder `ai/retraining/` di Windows, gunakan `..\.venv\Scripts\python.exe train.py`.

Pilihan ini mengganti indeks referensi mentah privat dalam model manual dengan **hanya file terpilih**. Classifier risiko dan indeks analisis yang sudah ada tetap dipertahankan. Berkas yang tidak dapat diekstrak, seperti PDF scan tanpa OCR, menyebabkan training gagal tanpa mengganti model lama.

Jika isi dokumen aman untuk **semua mitra**, tinjau isinya lalu tambahkan `--public-source "nama-file.pdf"`. Tanpa flag tersebut, teks hanya masuk indeks privat dan tidak diberikan kepada chatbot mitra.

Hasil model berada di `ai/data/private/manual/daisuki.pkl`. Agar API memakai hasil manual, arahkan `DAISUKI_MODEL_PATH` ke berkas tersebut dan mulai ulang API.
