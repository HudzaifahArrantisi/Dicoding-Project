# Pilihan 1 — analisis internal

Gunakan pilihan ini setelah Data Science membuat satu run analisis mingguan. Training membaca artefak run tersebut tanpa membuka PDF mentah baru.

## Data yang dibaca

Satu folder `data-science/reports/runs/<run_id>/` harus memiliki `manifest.json`, empat kategori `category_products.json`, `category_partners.json`, `category_regions.json`, `category_reporting.json`, serta `cleaned_inventory_summary.csv`. Skrip memeriksa identitas run dan checksum semua artefak terhadap manifest. Jika `--run-id` tidak diberikan, skrip memilih run valid terbaru.

Empat JSON berisi ringkasan produk, mitra, wilayah, dan disiplin pelaporan. Indeks numerik `analysis_retrieval` menyimpan cuplikan dari kategori tersebut dan baris produk dari CSV. Cuplikan milik cabang diberi `partner_id`; agregat produk/wilayah berada di biner privat dan tidak dikirim ke chatbot mitra. Classifier risiko dilatih dari pasangan mitra-produk dalam CSV run yang sama. JSON kategori adalah sumber indeks analisis, bukan label langsung untuk classifier risiko.

## Jalankan

```powershell
ai/.venv/Scripts/python.exe ai/retraining/train_daisuki.py --mode 1
```

Untuk memilih periode tertentu:

```powershell
ai/.venv/Scripts/python.exe ai/retraining/train_daisuki.py --mode 1 --run-id "30b2d67b-7dc6-4cb9-b63e-d49e04005921"
```

Ganti UUID contoh dengan ID run yang ingin dilatih.

Keberhasilan ditandai keluaran `Analisis privat: <run_id>; empat kategori tervalidasi; <jumlah> pasangan mitra-produk` dan `Model tersimpan: .../ai/data/private/manual/daisuki.pkl`. Bila run belum ada atau checksum tidak cocok, training berhenti. Buat run baru lewat alur analisis Data Science terlebih dahulu; jangan menyunting JSON run yang sudah memiliki manifest.

## Penggunaan saat chat

Pertanyaan seperti “rangkum kegiatan cabang saya seminggu” mengambil cuplikan periode model hanya untuk `partner_id` dari JWT. API juga mengambil stok dan konsumsi terbaru dari PostgreSQL. Jawaban membedakan **analisis mingguan dari model** dan **kondisi terkini dari database**. Angka periode analisis adalah snapshot dan dapat berbeda dari keadaan hari ini.

Pilihan 1 memperbarui bagian analisis dan classifier, tetapi mempertahankan indeks referensi yang sudah ada di model sebelumnya. PDF yang belum pernah diindeks tidak diproses oleh pilihan ini.
