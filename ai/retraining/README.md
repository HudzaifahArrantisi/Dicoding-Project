# Daisuki AI Retraining

`train.py` membaca data operasional PostgreSQL yang juga dipakai tab **AI Insights** admin. Tidak ada dataset JSON contoh dalam alur produksi. Sumbernya adalah `partner_stocks`, `stock_logs` laporan fisik mitra, `partners`, `products`, `orders`, dan `order_items`. Konsumsi dihitung dari penurunan stok `manual_update` selama 7 dan 30 hari; perubahan karena penerimaan barang tidak dihitung sebagai penjualan.

Setiap pasangan mitra-produk menjadi satu sampel teks berisi stok saat ini, buffer minimal, konsumsi, frekuensi kritis, dan status pesanan. Label `urgent_restock`, `regular_order`, dan `normal` diturunkan dari aturan risiko stok yang sejalan dengan AI Insights. Label ini adalah *pseudo-label* dari data operasional, bukan keputusan manusia yang sudah diverifikasi. Model `daisuki.pkl` hanya dibuat bila data nyata menghasilkan sekurangnya dua kelas. Bila tidak, model lama dipertahankan.

```powershell
cd ai\retraining
python -m pip install -r requirements.txt
python test_pipeline.py
python train.py
```

Atur `DATABASE_URL` di environment atau di `ai/.env` / `apps/api/.env`. Pengguna database perlu akses baca tabel di atas. `test_pipeline.py` memakai fixture lokal untuk menguji logika tanpa menyentuh database atau model produksi. `python train.py` membaca database aktual dan mengganti model secara atomik; tidak menghapus atau mengubah data database. Jadwalkan perintah tersebut setiap tiga jam jika diperlukan.

Model teks ini adalah modul tersendiri. Tab AI Insights saat ini tetap menggunakan analisis SQL dan model risiko yang sudah ada; belum memakai hasil prediksi `DaisukiFilter` untuk mengubah dashboard.
