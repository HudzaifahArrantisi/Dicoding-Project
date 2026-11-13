# Pilihan 3 — analisis internal dan referensi mentah

Gunakan pilihan ini ketika run Data Science yang baru dan dokumen referensi perlu masuk ke model manual yang sama. Skrip menjalankan kedua kelompok pekerjaan sebelum menyimpan `daisuki.pkl`.

## Persiapan

Pastikan satu run Data Science memiliki `manifest.json`, empat JSON kategori, dan CSV yang cocok dengan checksum manifest. Letakkan PDF berbasis teks di `ai/data/raw_references/pdf/`. Tinjau setiap file yang akan dibuka untuk semua mitra; PDF lain tetap berada dalam indeks privat.

## Jalankan

```powershell
ai/.venv/Scripts/python.exe ai/retraining/train_daisuki.py --mode 3
```

Untuk memilih run dan menyetujui artikel tertentu sebagai sumber chatbot:

```powershell
ai/.venv/Scripts/python.exe ai/retraining/train_daisuki.py --mode 3 --run-id "30b2d67b-7dc6-4cb9-b63e-d49e04005921" --public-source "nama-artikel.pdf"
```

Ganti UUID dan nama artikel contoh sesuai berkas yang tersedia.

Perintah ini memverifikasi empat kategori analisis, melatih classifier risiko dari CSV run, membangun vektor analisis per mitra, membuat indeks seluruh PDF yang terbaca sebagai data privat, dan membangun ulang indeks dokumen publik yang disetujui. Classifier intent juga diperbarui. Hasilnya disimpan di `ai/data/private/manual/daisuki.pkl`; skrip tidak mengubah stok atau pesanan di PostgreSQL.

Periksa tiga baris keluaran: `Analisis privat`, `Cuplikan retrieval`, dan `Cuplikan PDF privat dalam biner`. Jika salah satu sumber tidak valid, baca pesan kegagalan sebelum mengulang. Dokumen publik yang dipilih bisa ditulis sebelum penyimpanan model selesai; bila proses terhenti setelah tahap publikasi, periksa `.public.md` dan `rag_policy.json` sebelum mengulang training.

## Contoh alur jawaban

Untuk permintaan “rangkum kegiatan saya seminggu”, worker mencari analisis yang `partner_id`-nya sesuai JWT. API lalu membaca stok dan konsumsi terbaru dari PostgreSQL. Prompt meminta LLM memisahkan hasil periode model dari kondisi saat ini; bila jawaban LLM tidak dapat digunakan, balasan cadangan juga menampilkan dua bagian tersebut. Dokumen referensi publik dapat menambah konteks umum, sedangkan PDF privat tidak dikirim ke prompt mitra.

Setelah training, pastikan `DAISUKI_MODEL_PATH` menunjuk model privat manual dan mulai ulang API jika sumber publik baru diterbitkan. Model ini memakai vektor TF-IDF, bukan embedding semantik neural; mutu ringkasan LLM tetap bergantung pada respons 9Router dan fakta yang tersedia.
