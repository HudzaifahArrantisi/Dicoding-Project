# Pilihan 2 — referensi mentah

Gunakan pilihan ini untuk memperbarui pengetahuan dokumen tanpa melatih ulang classifier risiko dari run Data Science. Skrip membaca semua berkas PDF, DOCX, MD, TXT, JSON, dan CSV di bawah `ai/data/raw_references/` lalu membuat vektor numerik dari teks yang dapat diekstrak. Berkas `README.md` hanya petunjuk folder dan dilewati.

## Dua tingkat akses dokumen

Seluruh referensi yang berhasil dibaca masuk ke indeks privat dalam biner. Ini tidak otomatis membuat isinya dapat dibaca chatbot mitra. Chatbot memakai indeks publik `retrieval` dari file `.public.md` yang disetujui atau ringkasan terbatas yang izinnya diberikan saat training. Izin dan ringkasan disimpan di `daisuki.pkl`, bukan sebagai nama file khusus di kode.

Untuk menerbitkan referensi tertentu kepada **semua mitra**, pilih nama file dengan `--public-source`. Periksa isinya lebih dulu. Opsi ini menerima PDF dari `raw_references/pdf/`, atau DOCX, MD, dan TXT dari `raw_references/docs/`. Dokumen terpilih diekstrak ke Markdown, diperiksa terhadap pola privat, dibuat sebagai `.public.md`, lalu ditambahkan ke kebijakan sumber publik. File CSV operasional tidak dapat diterbitkan lewat opsi ini.

## Jalankan

Memperbarui indeks semua referensi privat dan dokumen publik yang sudah disetujui:

```powershell
ai/.venv/Scripts/python.exe ai/retraining/train.py --mode 2
```

Menyetujui satu artikel PDF agar dapat dipakai chatbot mitra:

```powershell
ai/.venv/Scripts/python.exe ai/retraining/train.py --mode 2 --public-source "nama-artikel.pdf"
```

Tambahkan `--public-source "file-lain.pdf"` lagi untuk beberapa dokumen. Keluaran `Berkas mentah terindeks: <jumlah>` harus sesuai berkas data yang didukung dalam folder. Berkas yang gagal diekstrak menghentikan training tanpa mengganti model lama. Pasang `pypdf` dari `ai/requirements.txt`; PDF hasil scan memerlukan OCR sebelum diproses. Format Word lama `.doc` perlu dikonversi menjadi `.docx`.

Untuk membagikan **hanya ringkasan aman** dari file mentah ke semua Mitra tanpa `.public.md`, jalankan `--mitra-summary "nama-file.pdf=Ringkasan yang sudah ditinjau dan berisi sedikitnya empat puluh karakter."`. Akses ini tetap tersimpan saat training opsi 2 berikutnya selama file sumber tidak berubah. Cabut dengan `--revoke-mitra-source "nama-file.pdf"`. Menu interaktif `train.py` juga menawarkan tambah/cabut ringkasan setelah Anda memilih opsi 2.

## Setelah training

Model tersimpan di `ai/data/private/manual/daisuki.pkl`. Worker dan kebijakan sumber publik dimuat ulang saat artefak atau kebijakan berubah; perubahan path di `.env` tetap memerlukan restart API. Coba pertanyaan yang jawabannya memang ada di artikel dan periksa apakah chatbot memakai sumber yang tepat. Kecocokan TF-IDF adalah pencarian teks; keberadaan PDF di biner sendiri tidak menjamin setiap pertanyaan dapat dijawab.

Pilihan 2 mempertahankan indeks analisis mingguan dan classifier risiko dari model sebelumnya jika keduanya sudah ada. Bila dijalankan sebagai training pertama, fitur ringkasan analisis mitra belum tersedia sampai pilihan 1 dijalankan.
