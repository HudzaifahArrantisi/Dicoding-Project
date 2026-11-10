# Aturan inventaris cabang Daisuki

Sumber: aturan bisnis pada `data/mainbrain/corporate_knowledge/business_rules.json` dan panduan proyek. Dokumen ini dapat digunakan chatbot mitra untuk menjelaskan kebijakan umum, bukan sebagai sumber angka stok terkini.

Cabang mitra tidak memiliki batas atas stok fisik. Buffer minimal adalah ambang peringatan dini, bukan kapasitas maksimum. Status aman berlaku ketika sisa stok di atas setengah buffer; waspada ketika di atas seperlima sampai setengah buffer; kritis ketika paling banyak seperlima buffer.

Produk resmi Daisuki adalah Seblak Jadul Instan, Basreng Daun Jeruk, Makaroni Daun Jeruk, dan Keripik Pisang Rasa Coklat. Nama produk lain tidak divalidasi sebagai katalog resmi.

Saat mitra mengajukan restock, stok gudang pusat direservasi sesuai jumlah yang diminta. Persetujuan parsial mengembalikan selisih yang tidak disetujui. Stok cabang baru bertambah sebesar jumlah yang disetujui setelah kiriman diterima dan resinya diverifikasi hingga pesanan berstatus selesai.

Asisten hanya membaca fakta. Pengubahan laporan stok, pengajuan pesanan, pembatalan, dan konfirmasi penerimaan harus dilakukan mitra melalui fitur aplikasi.
