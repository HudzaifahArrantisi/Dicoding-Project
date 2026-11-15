# Runtime model Daisuki dan RAG

Jalankan `bun run dev` dari root proyek. Perintah ini menjalankan frontend dan Elysia API. Saat API menyala, server membuat worker Python persisten dan memuat `daisuki.pkl` ke memori. API menutup worker saat server dihentikan. Python harus tersedia beserta dependensi `ai/requirements.txt`; `DAISUKI_PYTHON_BIN` dapat menunjuk Python virtual environment.

Log startup menunjukkan lokasi artefak serta status `intent aktif, retrieval biner aktif`. Jika indeks retrieval belum siap, API dapat memakai pencarian dokumen publik dari berkas sebagai cadangan.

## Alur pesan

1. API menentukan mitra dari JWT dan memuat memori UUID sesi.
2. Guardrail menolak prompt injection, permintaan konfigurasi internal, dan akses mitra lain, termasuk saat `ASSISTANT_RELAXED_CHAT=true`. Pertanyaan aman dapat ditulis ulang untuk membantu pencarian.
3. Worker menerima pertanyaan, lalu mengembalikan label intent Naive Bayes dan cuplikan relevan dari indeks TF-IDF dalam `.pkl`. Karakter n-gram membantu mencocokkan variasi penulisan dan typo.
4. Saat indeks biner siap, API hanya memakai cuplikan yang relevan dari `daisuki.pkl` dan sumbernya tercantum dalam kebijakan publik. API tidak membaca `.public.md` untuk pertanyaan tersebut. Jika tidak ada cuplikan yang cocok, konteks dokumen tetap kosong. Pencarian kata kunci `.public.md` hanya dipakai bila indeks biner belum siap atau worker tidak tersedia.
5. API mengambil stok, profil, pesanan, dan log PostgreSQL khusus mitra dari JWT untuk setiap pesan. Pertanyaan tentang kondisi sekarang memakai angka database ini; cuplikan training adalah snapshot historis. Gudang saya memakai `current_stock`; gudang pusat memakai `central_stock_available`.
6. Intent, sumber pengetahuan terpilih, fakta database, dan memori percakapan masuk ke prompt 9Router. Analisis mingguan privat dari `.pkl` hanya diambil untuk `partner_id` JWT yang sama, dan jawaban membedakannya dari kondisi database terbaru.
7. Jawaban serta metadata intent, kesiapan retrieval, jenis memori publik, dan sumber dokumen disimpan bersama UUID sesi. Worker yang sama melayani pesan berikutnya.

TF-IDF adalah indeks vektor angka untuk pencarian teks, bukan embedding neural atau LLM yang dilatih ulang. Mode training referensi menyimpan vektor dokumen mentah ke dalam `.pkl` privat. Dokumen mentah tidak otomatis masuk konteks chatbot mitra atau menjadi `.public.md`: publikasi memerlukan `--public-source`, lolos filter privasi, dan tercatat dalam `rag_policy.json`. Cadangan Markdown hanya mencakup sumber publik yang disetujui. Setelah sumber publik baru diterbitkan saat API masih berjalan, mulai ulang API agar daftar izin dan indeks Markdown yang dimuat saat startup ikut diperbarui. Angka stok dalam training merupakan snapshot analitik; angka stok yang dijawab chatbot diambil dari database terbaru. Memperbarui `.pkl` tidak memperbaiki gangguan koneksi penyedia 9Router.

Chat AI Admin mencari indeks referensi mentah privat dan dokumen publik dari `daisuki.pkl`, termasuk CV, dengan nama file sebagai petunjuk saat pertanyaan pendek seperti "siapa itu Dea?". Selama salah satu indeks biner siap, Admin tidak melakukan pencarian Markdown. Cuplikan privat hanya dikirim melalui endpoint yang memverifikasi role Admin. Chat AI Mitra tetap hanya menerima sumber publik yang disetujui; menambahkan CV ke `raw_references` saja tidak menerbitkannya untuk Mitra. Jika LLM gagal, Admin mendapat cuplikan referensi yang cocok sebagai jawaban cadangan.

## Memilih model

`DAISUKI_MODEL_PATH` yang diisi secara eksplisit diprioritaskan. Path relatif dihitung dari root workspace. Jika kosong, API menggunakan model run analisis aktif, atau `ai/data/mainbrain/models/daisuki.pkl` jika belum ada run aktif.

Untuk pengembangan lokal, `.env` API dapat berisi:

```dotenv
DAISUKI_MODEL_PATH=ai/data/mainbrain/models/daisuki.pkl
```

Override ini juga memilih classifier risiko dari berkas lokal. Kosongkan variabel untuk kembali mengikuti model run analisis yang dipublikasikan.

Training manual `python ai/retraining/train.py --mode 1|2|3` menyimpan hasil ke `ai/data/private/manual/daisuki.pkl`. Agar chatbot memakai hasil training manual tersebut, atur `DAISUKI_MODEL_PATH=ai/data/private/manual/daisuki.pkl` di `apps/api/.env`, lalu mulai ulang API. Jika path masih menunjuk `ai/data/mainbrain/models/daisuki.pkl`, chatbot tetap memakai model lama di lokasi itu.

## Memperbarui model

Untuk memperbarui intent dan indeks dokumen publik tanpa mengubah classifier risiko, jalankan dari root:

```powershell
python ai/retraining/train.py --intent-only
```

Untuk melatih intent, risiko, dan indeks dokumen sekaligus setelah laporan Data Science tersedia:

```powershell
python ai/retraining/train.py --weekly
```

Indeks publik di dalam biner hanya memuat dokumen `*.public.md` yang terdaftar di `ai/data/mainbrain/corporate_knowledge/rag_policy.json` dan lolos penyaringan konten. Indeks referensi mentah di biner terpisah dan hanya tersedia untuk Admin. Worker memeriksa perubahan waktu berkas saat inferensi; restart API diperlukan jika lokasi model atau konfigurasi `.env` diubah. Alur publikasi analisis memuat ulang worker ketika run baru diaktifkan.
