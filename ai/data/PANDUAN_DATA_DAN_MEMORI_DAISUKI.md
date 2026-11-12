# Panduan data dan memori Daisuki AI

Dokumen ini menjelaskan apa yang disimpan di `ai/data/`, kapan datanya dipakai, dan perintah yang perlu dijalankan saat menambah pengetahuan. Istilah *training* di proyek ini merujuk pada pelatihan classifier lokal `daisuki.pkl`. Dokumen artikel untuk chatbot masuk melalui proses ekstraksi dan pencarian RAG; artikel tidak disimpan sebagai isi model `.pkl`.

## Peta folder

| Lokasi | Isi dan fungsi | Dibaca oleh |
| --- | --- | --- |
| `raw_references/pdf/` | PDF sumber perusahaan atau artikel. | `ai/retraining/doc_loader.py` saat ekstraksi. |
| `raw_references/docs/` | DOCX, Markdown, TXT, dan dokumen sumber lainnya. | Ekstraktor dokumen. |
| `raw_references/csv/` | CSV referensi dan ringkasan analisis internal. | Pipeline terkait; file di sini tidak otomatis menjadi fakta chatbot. |
| `mega_data_word/intent/` | Pola pertanyaan, sapaan, identitas, dan pemicu panduan fitur. `training/` dan `training_examples.json` berisi contoh berlabel untuk classifier intent. | `word-loader.ts` saat API hidup dan skrip training intent Python. |
| `mega_data_word/guardrails/` | Pola prompt injection, probe sistem, permintaan lintas mitra, dan kategori topik. | Pemeriksaan pesan di API dan modul guardrail Python. |
| `mega_data_word/dictionary/` | Alias produk, sinonim pencarian, stopwords, dan frasa singkat. | Pengenal kata dan pencarian dokumen. |
| `mega_data_word/tests/` | Contoh pesan beserta hasil yang diharapkan untuk pengujian. | Test assistant; ini bukan sumber fakta operasional. |
| `mainbrain/corporate_knowledge/` | Profil dan SOP terstruktur, aturan bisnis, teks jawaban cadangan, serta `rag_policy.json`. | API dan prompt chatbot. |
| `mainbrain/context_embeddings/` | Markdown hasil ekstraksi privat, dokumen `*.public.md` yang disetujui, dan sebagian snapshot analitik. Nama folder ini bersifat historis: pencarian chatbot saat ini memakai indeks kata di RAM, belum vektor embedding. | Retrieval RAG di API. |
| `mainbrain/models/` | `daisuki.pkl`, hasil pelatihan classifier intent dan risiko stok. | Worker inferensi Python yang dipanggil API. |
| `mainbrain/session_memory/` | Dokumentasi memori sesi. Percakapan aktif dan ringkasannya disimpan oleh server dan PostgreSQL, bukan sebagai kumpulan file JSON di folder ini. | Pengembang yang menelusuri alur memori. |
| `private/runs/<run_id>/` | Artefak analisis dan model per run yang belum atau sudah dipublikasikan menurut alur persetujuan. Bisa berisi data sensitif mitra. | Pipeline AI dan API admin; tidak dipakai sebagai dokumen publik mitra. |
| `private/active_run.json` | Penunjuk run analisis aktif. | Pipeline pembaca hasil AI. |

Data laporan mingguan Data Science berasal dari `data-science/reports/` di luar `ai/data/`. Pipeline AI membaca laporan itu untuk skor risiko, rekomendasi, grafik, dan training. Sumber angka stok dan PO yang berlaku saat mitra bertanya tetap PostgreSQL sesuai akun yang login.

## Tiga jenis pengetahuan yang berbeda

1. **Kamus dan contoh intent** di `mega_data_word/` membantu sistem mengenali maksud pesan. Perubahan JSON pola dibaca saat API dimulai ulang. Perubahan contoh berlabel baru memengaruhi `daisuki.pkl` setelah classifier dilatih ulang.
2. **Model lokal** `mainbrain/models/daisuki.pkl` mengklasifikasikan intent dan risiko stok. Training model juga memerlukan data CSV Data Science yang sesuai ketika menjalankan `retraining/train.py`. File model tidak menghafal seluruh PDF atau DOCX dan tidak melakukan fine tuning LLM 9Router.
3. **Dokumen RAG** di `mainbrain/context_embeddings/` menyediakan cuplikan relevan ketika chatbot menjawab. Hanya `*.public.md` yang namanya terdaftar di `corporate_knowledge/rag_policy.json` boleh dibaca untuk konteks mitra. Dokumen mentah dan hasil ekstraksi privat tidak otomatis terbit.

Memori percakapan adalah jenis data lain. API menyimpan giliran aktif dengan `session_id` dan ringkasan sesi di tabel PostgreSQL `assistant_conversation_memory`. Memori membantu memahami rujukan seperti “yang tadi”, tetapi tidak menjadi bukti angka stok atau status pesanan. Fakta operasional diambil ulang dari PostgreSQL.

## Menambah artikel PDF atau DOCX untuk RAG

1. Simpan PDF berbasis teks di `raw_references/pdf/` dan `.docx` di `raw_references/docs/`. PDF hasil scan memerlukan OCR sebelum ekstraksi. Konversi format Word `.doc` lama menjadi `.docx`. Beri nama dasar file yang unik karena nama keluaran Markdown dibuat dari nama dasar sumber.
2. Dari folder `ai/`, pasang dependensi Python jika belum tersedia: `python -m pip install -r requirements.txt`.
3. Ekstrak dokumen saja, tanpa memicu training risiko stok:

   ```powershell
   cd ai
   python -c "from retraining.doc_loader import scan_and_generate_mainbrain; print(scan_and_generate_mainbrain())"
   ```

4. Periksa jumlah `success` dan `failed`, lalu baca Markdown yang muncul di `mainbrain/context_embeddings/`. Pastikan isinya benar-benar teks artikel, bukan pesan kesalahan parser. Ekstraksi DOCX saat ini hanya mengambil paragraf, jadi periksa tabel atau gambar yang mungkin terlewat.
5. Tinjau sumber dan privasi. Buat versi `nama-artikel.public.md` yang memang boleh dilihat mitra. Tambahkan nama file tersebut ke `approved_sources` pada `mainbrain/corporate_knowledge/rag_policy.json`.
6. Restart API agar daftar dokumen dan indeks kata dimuat ulang. Uji pertanyaan yang jawabannya tercantum di artikel dan periksa apakah cuplikan sumber yang tepat terambil.

Untuk banyak dokumen, perhatikan pengaturan `rag_policy.json`: `max_documents` saat ini 20, `max_excerpts` 3, dan `max_chars_per_document` 20000. Menaruh 100 dokumen di folder tidak berarti semuanya tersedia bagi chatbot. Selain batas policy, kode retrieval saat ini memilih dokumen untuk pertanyaan yang dikenali sebagai profil perusahaan atau SOP; topik artikel baru mungkin memerlukan pola intent atau perluasan retrieval di API. Mengubah batas policy saja tidak menyelesaikan masalah pemilihan topik.

## Melatih intent atau risiko stok

Untuk menambah cara bertanya, edit contoh berlabel di `mega_data_word/intent/training/`, lalu dari folder `ai/` jalankan:

```powershell
python retraining/refresh_identity.py
```

Perintah ini memperbarui classifier intent dalam model yang sudah ada. Tambahkan contoh kalimat pertanyaan, bukan isi artikel panjang. Perubahan pola JSON/regex tetap memerlukan restart API.

Untuk memperbarui classifier intent dan risiko stok sekaligus, jalankan `python retraining/train.py` setelah laporan CSV Data Science yang valid tersedia. Perintah tersebut juga memindai `raw_references/` dan menulis hasil ekstraksi Markdown. Pada alur mingguan yang memakai run, pemrosesan dari halaman analisis akan membuat artefak model di `private/runs/<run_id>/` sebelum run diaktifkan. Training lokal saja tidak otomatis mengganti versi aktif yang dipublikasikan oleh alur run.

## Menelusuri jawaban chatbot

Urutannya: pesan mitra masuk ke API, guardrail dan classifier memeriksa pesan, API mengambil fakta cabang dari PostgreSQL dan cuplikan dokumen publik yang cocok, lalu mengirim konteks itu ke 9Router. Jawaban diperiksa kembali agar tidak mengarang fakta operasional atau membocorkan cabang lain. Bila 9Router tidak tersedia, API memakai balasan lokal. Untuk memahami kesalahan jawaban, periksa berturut-turut sumber dokumen, hasil ekstraksi, daftar `approved_sources`, kecocokan intent, dan fakta PostgreSQL yang benar-benar dikirim ke chatbot.

