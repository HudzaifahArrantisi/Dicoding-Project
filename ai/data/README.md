# Data Daisuki

- `raw_references/`: dokumen sumber untuk ekstraksi; tempatkan PDF, dokumen teks, dan CSV di subfolder yang sesuai.
- `mainbrain/models/`: artefak `daisuki.pkl` hasil training lokal.
- `mainbrain/context_embeddings/`: snapshot analitik dan dokumen Markdown hasil ekstraksi. Chatbot membangun indeks kata terbalik di RAM dari `*.public.md` saat API menyala; folder ini belum berisi vektor embedding.
- `mainbrain/corporate_knowledge/`: profil perusahaan, aturan bisnis, dan teks jawaban cadangan yang disetujui.
- `mainbrain/session_memory/`: dokumentasi memori; ringkasan percakapan nyata disimpan terisolasi di PostgreSQL.
- `mega_data_word/`: pola intent, guardrail, alias produk, dan contoh training.

Perubahan kamus JSON dibaca pada proses API berikutnya. Tambah contoh intent pada berkas per topik di `mega_data_word/intent/training/`, lalu jalankan `python retraining/refresh_identity.py` untuk memperbarui classifier lokal tanpa mengubah model risiko. Daftar dokumen RAG yang boleh dibaca mitra diatur oleh `mainbrain/corporate_knowledge/rag_policy.json`.

Seluruh dependensi Python dipasang dengan `python -m pip install -r requirements.txt` dari folder `ai/`.

Handoff CSV Data Science dibaca langsung dari `data-science/reports/cleaned_inventory_summary.csv`. Saat training, analisis agregat ditulis ke `raw_references/csv/ai_analysis_summary.csv` dan dokumen privat mainbrain. Lihat `raw_references/csv/README.md` untuk batas akses.

## Aliran data mingguan

| Asal | Tujuan di `ai/data/` | Penggunaan |
|---|---|---|
| `data-science/reports/weekly_analytics_summary.json` | `mainbrain/context_embeddings/regional_stockout_insights.json` dan `weekly_operational_facts.json` | Skor Naive Bayes wilayah, empat kartu Admin, serta agregat yang disaring untuk chatbot. |
| Skor per mitra-produk dari Naive Bayes | `mainbrain/context_embeddings/regional_item_risks.json` | Urutan alokasi restock; file privat ini diabaikan Git dan tidak menjadi sumber RAG mitra. |
| `data-science/reports/cleaned_inventory_summary.csv` | `mainbrain/models/daisuki.pkl` dan `raw_references/csv/ai_analysis_summary.csv` | Training risiko dan ringkasan internal. Model disimpan pada path `mainbrain/models/`, bukan langsung di root `ai/data/`. |
| Dokumen perusahaan di `raw_references/` | `mainbrain/context_embeddings/*.md` | Hasil ekstraksi saat `retraining/train.py` berjalan. Hasil ekstraksi tetap privat sampai ada versi publik yang ditinjau dan disetujui. |
| Frasa dan pola di `mega_data_word/` | Loader API dan classifier intent | Pencocokan `Set`/regex saat server berjalan; frasa training dipakai saat melatih ulang classifier intent. |

Untuk menambah pengetahuan perusahaan ke chatbot, tempatkan dokumen sumber di `raw_references/`, jalankan `python ai/retraining/train.py` dari root, tinjau hasil ekstraksi, lalu siapkan berkas `*.public.md` yang aman. Daftarkan nama berkas publik itu di `mainbrain/corporate_knowledge/rag_policy.json` dan mulai ulang API agar indeks cuplikan serta kamus dimuat ulang. Menambahkan dokumen mentah atau menjalankan training **tidak otomatis memublikasikan** isinya ke RAG mitra.

Saat chat berlangsung, fakta stok dan pesanan tetap diambil langsung dari PostgreSQL berdasarkan mitra yang login. Memori percakapan tersimpan per mitra/pengguna di PostgreSQL dan tidak menggantikan fakta stok. Penjelasan urutan job mingguan serta kondisi tombol Admin ada di [README AI](../README.md#11-alur-mingguan-data-science-ke-ai-dan-chatbot).
