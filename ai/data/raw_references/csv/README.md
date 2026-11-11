# CSV referensi AI

Hasil operasional Data Science kini berada di `data-science/reports/cleaned_inventory_summary.csv`. Training `ai/retraining/train.py` membaca file itu langsung, tanpa salin manual. Jalankan `python data-science/src/weekly_analytics_aggregator.py` dari root sebelum training.

Folder ini tetap menyimpan `ai_analysis_summary.csv`, ringkasan privat per produk yang dibuat saat training, serta CSV referensi lain yang sengaja diserahkan untuk ekstraksi dokumen. Jangan publikasikan CSV per mitra atau ringkasan privat kepada chatbot mitra. Angka stok dan pesanan mitra tetap diambil dari PostgreSQL menurut identitas JWT.
