# Runtime model Daisuki dan RAG

Jalankan `bun run dev` dari root proyek. Perintah ini menjalankan frontend dan Elysia API. Saat API menyala, server membuat worker Python persisten dan memuat `daisuki.pkl` ke memori. API menutup worker saat server dihentikan. Python harus tersedia beserta dependensi `ai/requirements.txt`; `DAISUKI_PYTHON_BIN` dapat menunjuk Python virtual environment.

Log startup menunjukkan lokasi artefak serta status `intent aktif, retrieval biner aktif`. Jika retrieval belum dilatih, API tetap dapat memakai pencarian dokumen publik dari berkas sebagai cadangan.

## Alur pesan

1. API menentukan mitra dari JWT dan memuat memori UUID sesi.
2. Worker menerima pesan, lalu mengembalikan label intent Naive Bayes dan cuplikan relevan dari indeks TF-IDF dalam `.pkl`. Karakter n-gram membantu mencocokkan variasi penulisan dan typo.
3. API mengambil stok, profil, pesanan, dan log PostgreSQL khusus mitra tersebut. Gudang saya memakai `current_stock`; gudang pusat memakai `central_stock_available`.
4. Intent, cuplikan publik, fakta database, dan memori masuk ke prompt 9Router. Cuplikan biner diperiksa kembali terhadap daftar sumber publik yang diizinkan.
5. Jawaban serta metadata intent, kesiapan retrieval, dan sumber dokumen disimpan bersama UUID sesi. Worker yang sama melayani pesan berikutnya.

TF-IDF adalah indeks vektor pencarian teks, bukan embedding neural atau LLM. Angka stok dalam training merupakan snapshot analitik; angka stok yang dijawab chatbot diambil dari database terbaru. Memperbarui `.pkl` tidak memperbaiki gangguan koneksi penyedia 9Router.

## Memilih model

`DAISUKI_MODEL_PATH` yang diisi secara eksplisit diprioritaskan. Path relatif dihitung dari root workspace. Jika kosong, API menggunakan model run analisis aktif, atau `ai/data/mainbrain/models/daisuki.pkl` jika belum ada run aktif.

Untuk pengembangan lokal, `.env` API dapat berisi:

```dotenv
DAISUKI_MODEL_PATH=ai/data/mainbrain/models/daisuki.pkl
```

Override ini juga memilih classifier risiko dari berkas lokal. Kosongkan variabel untuk kembali mengikuti model run analisis yang dipublikasikan.

## Memperbarui model

Untuk memperbarui intent dan indeks dokumen publik tanpa mengubah classifier risiko, jalankan dari root:

```powershell
python ai/retraining/refresh_identity.py
```

Untuk melatih intent, risiko, dan indeks dokumen sekaligus setelah laporan Data Science tersedia:

```powershell
python ai/retraining/train.py
```

Hanya dokumen `*.public.md` yang terdaftar di `ai/data/mainbrain/corporate_knowledge/rag_policy.json` dan lolos penyaringan konten yang masuk indeks biner. PDF mentah tidak otomatis dipublikasikan. Worker memeriksa perubahan waktu berkas saat inferensi; restart API diperlukan jika lokasi model atau konfigurasi `.env` diubah. Alur publikasi analisis memuat ulang worker ketika run baru diaktifkan.
