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

TF-IDF adalah indeks vektor angka untuk pencarian teks, bukan embedding neural atau LLM yang dilatih ulang. Mode training referensi menyimpan vektor dokumen mentah ke dalam `.pkl` privat. Dokumen mentah tidak otomatis masuk konteks chatbot mitra. Dokumen publik penuh memerlukan `--public-source`, lolos filter privasi, dan tercatat dalam `rag_policy.json`. Ringkasan terbatas untuk Mitra diberikan melalui `--mitra-summary "nama-file.pdf=ringkasan"`; izin, alias dari nama file, hash sumber, dan ringkasannya tersimpan di `daisuki.pkl`, tanpa daftar nama orang di kode atau `.public.md`. Pada training berikutnya, ringkasan dari file sumber yang berubah tidak dipertahankan sampai ditinjau ulang. Cadangan Markdown hanya mencakup dokumen `.public.md` yang disetujui. Angka stok dalam training merupakan snapshot analitik; angka stok yang dijawab chatbot diambil dari database terbaru. Memperbarui `.pkl` tidak memperbaiki gangguan koneksi penyedia 9Router.

Chat AI Admin mencari indeks referensi mentah privat dan dokumen publik dari `daisuki.pkl`, termasuk CV, dengan nama file sebagai petunjuk saat pertanyaan pendek seperti "siapa itu [nama di CV]?". Selama salah satu indeks biner siap, Admin tidak melakukan pencarian Markdown. Cuplikan privat hanya dikirim melalui endpoint yang memverifikasi role Admin. Chat AI Mitra hanya menerima ringkasan sumber yang diberi akses `mitra` saat training, bukan isi CV lengkap. Pertanyaan yang cocok dengan alias ringkasan dijawab langsung dari cuplikan biner agar respons umum LLM tidak menggantikan fakta dokumen.

## Memilih model

`DAISUKI_MODEL_PATH` yang diisi secara eksplisit diprioritaskan. Path relatif dihitung dari root workspace. Jika kosong, API menggunakan model run analisis aktif, atau `ai/data/mainbrain/models/daisuki.pkl` jika belum ada run aktif.

Untuk pengembangan lokal, `.env` API dapat berisi:

```dotenv
DAISUKI_MODEL_PATH=ai/data/mainbrain/models/daisuki.pkl
```

Override ini juga memilih classifier risiko dari berkas lokal. Kosongkan variabel untuk kembali mengikuti model run analisis yang dipublikasikan.

Training manual `python ai/retraining/train.py --mode 1|2|3` menyimpan hasil ke `ai/data/private/manual/daisuki.pkl`. Agar chatbot memakai hasil training manual tersebut, atur `DAISUKI_MODEL_PATH=ai/data/private/manual/daisuki.pkl` di `apps/api/.env`, lalu mulai ulang API. Jika path masih menunjuk `ai/data/mainbrain/models/daisuki.pkl`, chatbot tetap memakai model lama di lokasi itu.

## Memperbarui model

Run yang sudah diterbitkan disimpan sebagai artefak Data Science dan AI Engineer per run di Neon. Saat training run baru, runner mengambil kembali versi terbit terbaru dari tiap periode awal yang artefaknya lengkap, membangun ulang indeks analisis lintas periode, lalu menyimpan indeks lengkap dalam `daisuki.pkl` run aktif. Ekspor JSON menyimpan model utama di kunci KV `daisuki` dan indeks per periode di kunci berversi `daisuki-history-<run-id>-YYYY-MM-DD`; Worker memilih kunci dari tanggal pertanyaan. Training dari referensi mentah mempertahankan indeks analisis lama. Empat kategori, laporan mingguan, dan hasil job AI tetap tersedia secara utuh di artefak Neon; model menyimpan cuplikan yang bisa dicari. Satu nilai KV dibatasi 25 MiB, sehingga arsip utuh tidak dipindahkan seluruhnya ke satu kunci KV.

Laporan Data Science baru juga menyimpan konsumsi per mitra per hari di `weekly_analytics_summary.json`. Indeks lokal dan JSON Worker dapat mengambil tanggal spesifik serta merangking mitra menurut konsumsi hari tersebut. Untuk pertanyaan Admin yang menyebut tanggal, API menghitung kembali konsumsi dari `stock_logs` jika data mentah masih tersedia; ini juga melayani arsip lama yang belum mempunyai rincian harian. Log yang ditambahkan setelah sebuah run dibuat tidak mengubah snapshot run itu. Buat dan terbitkan run analisis baru agar data tambahan masuk ke `daisuki.pkl` dan KV.

Untuk pertanyaan Admin dengan nama mitra, tanggal, dan jam sampai menit (misalnya `Kafe Langit Tangerang pada 18 nov jam 12.32 WIB`), API membaca log penurunan stok pada menit WIB tersebut langsung dari Neon dan menampilkan produk, stok sebelum/sesudah, waktu, sumber, serta total pcs keluar. Jika tidak ada log pada menit itu, jawaban menyatakan tidak ada catatan; hal tersebut tidak membuktikan tidak ada penjualan. Jalur ini hanya tersedia pada Chat Admin yang terautentikasi.

Di Cloudflare Worker production, indeks hasil training dibaca dari KV. Ketika pertanyaan menyebut tanggal historis, API juga mengambil artefak run `published` terbaru yang mencakup tanggal itu langsung dari Neon sebagai sumber RAG cadangan. Chat Admin dapat melihat ringkasan produk, peringkat mitra, dan hasil AI Engineer dari arsip tersebut; Chat Mitra hanya menerima baris analisis milik `partner_id` dari JWT. Untuk Mitra, API juga menyusun fakta konsumsi harian dari `stock_logs` milik cabangnya pada tanggal yang diminta. Semua cuplikan menyertakan sumber dan periode, sehingga snapshot analisis lama tidak disamakan dengan stok real time. Jalur arsip ini tetap berjalan sebelum indeks KV dari training berikutnya diterbitkan.

Untuk memperbarui intent dan indeks dokumen publik tanpa mengubah classifier risiko, jalankan dari root:

```powershell
python ai/retraining/train.py --intent-only
```

Untuk melatih intent, risiko, dan indeks dokumen sekaligus setelah laporan Data Science tersedia:

```powershell
python ai/retraining/train.py --weekly
```

Indeks publik di dalam biner memuat dokumen `*.public.md` yang disetujui dan ringkasan dengan izin Mitra dari metadata training. Indeks referensi mentah di biner terpisah dan hanya tersedia untuk Admin. Worker memeriksa perubahan waktu berkas saat inferensi; training ulang di path model yang sama dibaca otomatis. API memuat ulang kebijakan dan indeks `.public.md` ketika file kebijakan berubah. Restart API hanya diperlukan jika lokasi model atau konfigurasi `.env` diubah. Alur publikasi analisis memuat ulang worker ketika run baru diaktifkan.
