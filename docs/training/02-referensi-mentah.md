# Pilihan 2 — referensi mentah

Gunakan pilihan ini untuk memperbarui pengetahuan dokumen tanpa melatih ulang classifier risiko dari run Data Science. Skrip membaca PDF di `ai/data/raw_references/pdf/` dan membuat vektor numerik dari teks yang dapat diekstrak.

## Dua tingkat akses dokumen

Seluruh PDF yang berhasil dibaca masuk ke `raw_pdf_retrieval` dalam biner **privat**. Ini tidak otomatis membuat isinya dapat dibaca chatbot mitra. Chatbot hanya memakai indeks `retrieval` dari file `.public.md` yang tercantum di `ai/data/mainbrain/corporate_knowledge/rag_policy.json` dan lolos filter konten.

Untuk menerbitkan referensi tertentu kepada **semua mitra**, pilih nama file dengan `--public-source`. Periksa isinya lebih dulu. Opsi ini menerima PDF dari `raw_references/pdf/`, atau DOCX, MD, dan TXT dari `raw_references/docs/`. Dokumen terpilih diekstrak ke Markdown, diperiksa terhadap pola privat, dibuat sebagai `.public.md`, lalu ditambahkan ke kebijakan sumber publik. File CSV operasional tidak dapat diterbitkan lewat opsi ini.

## Jalankan

Memperbarui indeks PDF privat dan dokumen publik yang sudah disetujui:

```powershell
ai/.venv/Scripts/python.exe ai/retraining/train_daisuki.py --mode 2
```

Menyetujui satu artikel PDF agar dapat dipakai chatbot mitra:

```powershell
ai/.venv/Scripts/python.exe ai/retraining/train_daisuki.py --mode 2 --public-source "nama-artikel.pdf"
```

Tambahkan `--public-source "file-lain.pdf"` lagi untuk beberapa dokumen. Keluaran `Cuplikan PDF privat dalam biner: <jumlah>` harus lebih dari nol bila folder PDF berisi dokumen berbasis teks. Jika semua PDF tidak dapat diekstrak, training gagal. Pasang `pypdf` dari `ai/requirements.txt`; PDF hasil scan memerlukan OCR sebelum diproses. Format Word lama `.doc` perlu dikonversi menjadi `.docx`.

## Setelah training

Model tersimpan di `ai/data/private/manual/daisuki.pkl`. Mulai ulang API setelah menerbitkan `.public.md` baru karena daftar sumber publik juga dimuat oleh API saat startup. Coba pertanyaan yang jawabannya memang ada di artikel dan periksa apakah chatbot memakai sumber yang tepat. Kecocokan TF-IDF adalah pencarian teks; keberadaan PDF di biner sendiri tidak menjamin setiap pertanyaan dapat dijawab.

Pilihan 2 mempertahankan indeks analisis mingguan dan classifier risiko dari model sebelumnya jika keduanya sudah ada. Bila dijalankan sebagai training pertama, fitur ringkasan analisis mitra belum tersedia sampai pilihan 1 atau 3 dijalankan.
