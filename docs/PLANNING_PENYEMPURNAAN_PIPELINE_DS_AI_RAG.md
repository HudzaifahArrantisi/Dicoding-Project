# Rencana Penyempurnaan Pipeline Data Science, AI, dan RAG

Status: **diimplementasikan untuk satu server; validasi produksi bertahap**  
Tanggal: 2026-11-11  
Pemilik kerja: Fullstack, Data Science, AI Engineer

## 1. Kondisi Saat Ini dan Sasaran

Saat ini `user_role` hanya berisi `admin` dan `mitra`. Tombol **Perbarui saran** di AI Insights dan tombol analisis Python di Log & Data memanggil endpoint Admin yang sama. Pipeline tersebut menjalankan agregator Data Science untuk tujuh hari kalender terakhir, lalu Naive Bayes, alokasi, sintesis fakta, training `daisuki.pkl`, dan grafik. Karena agregator dijalankan ulang, laporan yang sebelumnya dibuat Data Science untuk tanggal khusus tidak menjadi serah terima yang tetap.

Laporan Data Science berada di `data-science/reports/`. File JSON/CSV per mitra dan skor lengkap bersifat privat. Beberapa snapshot ringkasan AI yang masih dilacak Git memuat nama mitra. Chatbot sudah menyaring daftar mitra lain dari konteksnya, tetapi penyimpanan artefak tetap perlu diperketat. Retrieval dokumen publik saat ini memakai indeks kata; `daisuki.pkl` mengklasifikasikan intent dan risiko, bukan menyimpan seluruh pengetahuan perusahaan.

Sasaran akhir:

```text
Data Science membuat laporan bertanggal
  -> peninjauan dan persetujuan laporan
  -> AI Engineer memproses run yang disetujui
  -> evaluasi model dan validasi fakta
  -> publikasi atomik ke dashboard dan chatbot
  -> pemantauan, jadwal mingguan, dan rollback
```

**Aturan tetap:** empat produk resmi Daisuki; stok cabang tanpa plafon tetap; mutasi melalui API; `partner_id` dari JWT server; fakta stok/PO chatbot dari PostgreSQL cabang yang login; dokumen privat tidak masuk RAG mitra. Perubahan TypeScript/JavaScript dijalankan dengan Bun.

## 2. Urutan Implementasi

### Tahap 0 — Inventarisasi dan perlindungan artefak privat

**Tujuan:** memastikan data per mitra tidak dipublikasikan melalui Git, berkas statis web, atau konteks chatbot.

**Pekerjaan:**

1. Daftar seluruh pembaca/penulis `data-science/reports/`, `ai/data/mainbrain/context_embeddings/`, model `.pkl`, dan endpoint AI Insights. Tandai artefak berisi identitas mitra, agregat publik, atau fakta tenant.
2. Pindahkan snapshot yang memuat nama/ID mitra dari berkas yang dilacak Git ke penyimpanan privat yang diabaikan Git. Sediakan skema atau fixture sintetis untuk development. Jika riwayat Git pernah disebarkan, nilai kebutuhan pembersihan riwayat sebagai pekerjaan terpisah dengan persetujuan pemilik repo.
3. Tambahkan pemeriksaan otomatis yang menolak artefak privat di direktori publik dan memastikan payload chatbot tidak berisi nama, alamat, nomor kontak, atau stok mitra lain.

**Selesai jika:** clone bersih dapat dijalankan dengan fixture atau menghasilkan laporan baru; tidak ada snapshot produksi per mitra dalam perubahan Git; tes isolasi tenant dan pemeriksaan artefak lulus.

### Tahap 1 — Serah terima Data Science yang tetap dan dapat diaudit

**Tujuan:** hasil Data Science untuk periode tertentu tidak tertimpa saat AI diproses.

**Pekerjaan:**

1. Buat direktori run privat `data-science/reports/runs/<run_id>/` dan `manifest.json`. Manifest memuat `run_id`, rentang tanggal inklusif, zona waktu Asia/Jakarta, versi skema, waktu pembuatan, jumlah baris/sumber, hash SHA-256 JSON/CSV/Markdown, dan status `draft | approved | rejected`.
2. Agregator menulis ke lokasi sementara, memvalidasi skema, tanggal, empat produk, pasangan mitra-produk unik, angka nonnegatif, dan kecocokan total JSON/CSV; hasil dipromosikan sebagai satu run hanya jika semua berkas valid. Run lama tidak diubah.
3. Pisahkan aksi **Buat laporan** (Data Science) dari **Proses laporan** (AI Engineer). Tambahkan hak akses tim pada API dan UI; skema `user_role` dan pemeriksaan `partner_id` perlu dimigrasikan karena saat ini hanya `admin/mitra`. Admin dapat melihat status dan meninjau hasil, tanpa hak mutasi stok dari chatbot.
4. Simpan metadata/status run dalam PostgreSQL. Artefak tetap di penyimpanan privat; untuk deployment dengan lebih dari satu server, gunakan penyimpanan bersama yang tahan restart, bukan hanya disk sementara mesin API.

**Selesai jika:** AI memilih `run_id` yang sudah disetujui; tombol AI tidak menjalankan ulang agregator; periode khusus tetap sama sampai publikasi; akses antar-role diuji (401/403); run ganda atau berkas tidak cocok ditolak.

### Tahap 2 — Pemrosesan AI yang konsisten dan aman diulang

**Tujuan:** semua hasil dashboard dan model berasal dari run Data Science yang sama.

**Pekerjaan:**

1. Ubah job `regional_stockout_naive_bayes.py`, `smart_allocation.py`, `weekly_facts_aggregator.py`, `train.py`, dan `chart_data.py` agar menerima `--run-id` atau path manifest yang tervalidasi. Jangan bergantung hanya pada umur modifikasi CSV.
2. Simpan `source_run_id`, versi aturan, dan hash input pada setiap output: skor risiko, rekomendasi, fakta mingguan, grafik, dan metadata model. Tolak gabungan JSON, CSV, atau skor dari run berbeda.
3. Hitung hasil sebagai **draft** terlebih dahulu. Validasi semua output sebelum memperbarui snapshot aktif dan `restock_recommendations`. Publikasi harus aman diulang untuk `run_id` yang sama; jika tahap gagal, snapshot/model aktif sebelumnya tetap tersedia. Catat kegagalan per langkah dan sediakan rollback ke run aktif sebelumnya.
4. Dashboard menampilkan periode, waktu pembaruan, sumber run, status model, dan angka dari satu versi laporan. Bedakan **konsumsi terukur dari penurunan laporan stok fisik** dengan penjualan kasir; jangan beri label “unit terjual” tanpa data penjualan terverifikasi.

**Selesai jika:** seluruh output aktif memiliki `source_run_id` yang identik; kegagalan di tengah pipeline tidak menampilkan hasil campuran; pemrosesan ulang run yang sama tidak menggandakan rekomendasi/notifikasi; grafik dan empat kartu cocok dengan laporan.

### Tahap 3 — Evaluasi risiko Naive Bayes sebelum dipakai sebagai prioritas

**Tujuan:** probabilitas dan zona risiko dapat dipertanggungjawabkan dengan kejadian stok nyata.

**Pekerjaan:**

1. Definisikan label evaluasi dari kejadian **sesudah** waktu prediksi, misalnya stok mencapai nol sebelum pasokan diterima. Pisahkan data training dan evaluasi menurut waktu agar log masa depan tidak bocor ke fitur.
2. Buat baseline aturan stok yang sekarang, lalu bandingkan dengan Gaussian/Categorical Naive Bayes. Ukur precision, recall, PR-AUC, Brier score/kalibrasi, dan jumlah peringatan keliru per minggu; laporkan hasil per produk dan tipe mitra bila sampelnya mencukupi.
3. Tentukan ambang `ZONA_HIJAU/KUNING/MERAH` dari evaluasi dan biaya operasional, bukan hanya angka tetap di kode. Jika data kejadian nyata belum cukup atau model tidak mengungguli baseline, pertahankan aturan saat ini dan tandai probabilitas sebagai estimasi yang belum terkalibrasi.
4. Simpan laporan evaluasi dan versi dataset bersama model. Restock tetap dibatasi stok pusat terkini; saran AI tidak mengajukan PO secara otomatis.

**Selesai jika:** ada laporan evaluasi yang dapat direproduksi untuk setiap kandidat model; keputusan menerima/menolak model tercatat; output model tidak mengklaim probabilitas terkalibrasi tanpa bukti.

### Tahap 4 — Retrieval RAG, NLP, dan guardrail

**Tujuan:** chatbot menemukan pengetahuan perusahaan secara lebih konsisten tanpa memakai dokumen privat sebagai fakta mitra.

**Pekerjaan:**

1. Pisahkan tiga jalur data: **intent/risk** dilatih ke `daisuki.pkl`; **profil/SOP** diambil saat menjawab dari dokumen `*.public.md` yang disetujui `rag_policy.json`; **regex/guardrail** dibaca sebagai aturan versi tertentu saat API berjalan. Tidak ada tahap “latih semua file `ai/data/` ke LLM 9Router”.
2. Buat set pertanyaan evaluasi untuk profil, SOP, sinonim, typo, stok cabang, data kosong, dan percobaan prompt injection. Ukur keberhasilan retrieval indeks kata saat ini sebelum menambah pencarian semantik. Jika perlu, gabungkan pencarian kata dan embedding pada dokumen publik saja, dengan fallback indeks kata saat embedding/9Router gagal.
3. Sertakan sumber dan versi dokumen pada konteks RAG internal. Pertahankan guardrail sebelum dan sesudah LLM: batas domain, tenant, empat produk, angka dan nomor PO dari fakta terverifikasi, larangan klaim mutasi, serta fallback lokal saat 9Router timeout.
4. Tinjau dokumen hasil ekstraksi sebelum membuat versi `*.public.md`; jangan memublikasikan file secara otomatis. Perubahan kamus/policy dimuat melalui mekanisme reload yang jelas dan tercatat versinya.

**Selesai jika:** tes retrieval dan jawaban mencakup pertanyaan parafrasa serta serangan; tidak ada kebocoran data lintas mitra; jawaban numerik hanya merujuk fakta; kegagalan 9Router tetap memberi respons tanpa 500.

### Tahap 5 — Jadwal mingguan, observabilitas, dan peluncuran

**Tujuan:** alur tidak bergantung pada ingatan operator dan mudah dipulihkan.

**Pekerjaan:**

1. Tambahkan jadwal mingguan untuk **membuat draft laporan**, bukan langsung menerbitkan hasil AI. Data Science meninjau dan menyetujui, AI Engineer memproses, Admin melihat hasil. Sediakan pengingat bila run mingguan belum selesai.
2. Tampilkan status per langkah, durasi, error singkat, `run_id`, periode, versi model, dan waktu publikasi di UI/log. Simpan audit siapa membuat, menyetujui, memproses, dan menerbitkan run.
3. Lakukan uji staging menggunakan data sintetis dan satu run historis yang sudah dianonimkan; uji restart server, timeout DB/9Router, duplikasi klik, dan rollback. Rilis bertahap; snapshot lama tetap tersedia sampai run baru lolos seluruh validasi.

**Selesai jika:** satu siklus mingguan dapat diselesaikan dan diulang tanpa data campur, notifikasi ganda, atau 500 pada chatbot; operator dapat melihat penyebab gagal dan mengembalikan run sebelumnya.

## 3. Urutan Eksekusi yang Disarankan

| Prioritas | Tahap | Alasan |
|---|---|---|
| P0 | 0 → 1 | Lindungi artefak privat dan pastikan laporan Data Science tidak tertimpa. |
| P1 | 2 | Jadikan laporan, rekomendasi, model, grafik, dan dashboard satu versi yang dapat diulang. |
| P2 | 3 | Periksa manfaat model dengan kejadian stok nyata sebelum mempercayai probabilitas. |
| P3 | 4 | Tingkatkan kualitas jawaban RAG setelah data dan versi sumber stabil. |
| P4 | 5 | Otomatiskan operasi setelah jalur manual dan rollback terbukti benar. |

## 4. Keputusan Sebelum Eksekusi

1. **Akun tim:** gunakan role login baru `data_science` dan `ai_engineer`, atau izin terpisah pada akun Admin yang sudah ada. Rencana ini mengasumsikan role baru karena pengguna meminta tombol per role.
2. **Persetujuan laporan:** tentukan apakah Data Science boleh menyetujui run sendiri atau Admin harus meninjau. Rencana ini mengasumsikan Admin menyetujui sebelum AI memproses.
3. **Penyimpanan produksi:** tentukan direktori bersama privat atau object storage untuk artefak lintas server. Penyimpanan lokal hanya memadai untuk satu mesin.
4. **Kualitas label:** sepakati definisi kejadian stokout dan sumber data historis yang cukup sebelum menetapkan ambang evaluasi model.

## 5. Hasil Implementasi 2026-11-11

- Role `data_science` dan `ai_engineer`, halaman `/analysis`, tabel `analysis_runs`, audit, persetujuan Admin, pemrosesan AI bertahap, rollback, dan jadwal draft mingguan telah ditambahkan. Migrasi `neon/migrations/20261111_analysis_runs.sql` telah diterapkan pada database pengembangan.
- Handoff privat `data-science/reports/runs/<run_id>/` memiliki manifest dan hash SHA-256. Satu uji laporan historis berisi 424 pasangan mitra-produk; semua tahap AI dan validasi run lulus. Run uji tersebut **belum dipublikasikan** ke dashboard atau chatbot.
- Evaluasi historis pada data yang tersedia hanya memiliki 13 sampel uji dan nol kejadian stok habis. Karena bukti belum cukup, skor Naive Bayes ditandai belum terkalibrasi dan prioritas pasokan tetap mengikuti aturan stok. Ambang zona kandidat belum dioptimalkan berdasarkan kejadian nyata.
- Dokumen publik RAG diuji dengan pertanyaan parafrasa; alias retrieval dan versi sumber ditambahkan. Embedding 9Router belum dipasang karena pengujian retrieval yang ditambahkan dapat dijawab oleh indeks kata. Pemantauan kualitas jawaban di data lapangan masih diperlukan.
- Penyimpanan lokal mengasumsikan satu server dengan volume persisten. Publikasi pointer berkas dan transaksi PostgreSQL memiliki mekanisme pemulihan saat transaksi gagal, tetapi tidak dapat menjadi satu transaksi atomik lintas disk dan database. Deployment multi-server memerlukan object storage/volume bersama dan koordinasi worker sebelum diaktifkan.
