# CSV sumber

Letakkan hasil olahan Data Science bernama `cleaned_inventory_summary.csv` di sini sebelum menjalankan training atau menekan tombol **Perbarui analisis & model**. Berkas ini harus memiliki kolom `partner_id`, `product_id`, `product_name`, `current_qty`, `par_level`, `weekly_consumption`, dan `days_of_cover` seperti hasil `data-science/src/clean_logs.py`.

Pipeline memvalidasi ukuran, angka, identitas pasangan mitra-produk, dan empat produk resmi. CSV dipakai untuk training risiko `daisuki.pkl` bila waktu modifikasinya tidak lebih dari 7 hari. Analisis agregat per produk disimpan sebagai `ai_analysis_summary.csv` di folder ini dan diekstrak ke mainbrain sebagai dokumen **privat**. CSV dan dokumen privat tidak dikirim ke chatbot mitra. Fakta stok dan pesanan yang ditanyakan mitra tetap berasal dari PostgreSQL milik cabangnya.

Jika tidak ada CSV baru, training risiko memakai data PostgreSQL. CSV baru dengan kolom berbeda atau produk di luar katalog akan menggagalkan training dan mempertahankan model lama. Jangan menaruh file yang berisi kredensial atau data pribadi tambahan di folder ini.
