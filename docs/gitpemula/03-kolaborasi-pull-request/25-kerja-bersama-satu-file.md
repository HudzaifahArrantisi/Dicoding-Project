# Cara Kerja Bersama pada Satu File Tanpa Konflik

## 🎯 Kapan dipakai
Pakai ini saat dua orang atau lebih dalam tim perlu mengedit file yang sama (misal `README.md`, `package.json`, atau file rute `routes/index.ts`) agar tidak saling menimpa pekerjaan satu sama lain.

## 📝 Istilah penting
- Koordinasi area: membagi baris kode atau fungsi mana yang dikerjakan oleh masing-masing orang.
- Commit kecil (*atomic commit*): menyimpan perubahan sesering mungkin agar lebih mudah digabung.

## ✅ Langkah-langkah
1. **Komunikasi dulu**: Tentukan sebelum mulai mengedit (misal: "Saya mengedit bagian API tabel atas, kamu mengedit bagian tabel bawah").
2. **Tarik update sebelum mulai**:
   ```bash
   git pull origin main
   ```
3. **Kerjakan di fungsi/baris yang berbeda**: Hindari mengubah baris kode yang persis sama dengan yang sedang diutak-atik rekanmu.
4. **Push sesering mungkin**: Begitu satu fungsi selesai dan dites jalan, segera commit dan push ke branch fitur.
5. Jika temanmu baru saja push ke branch yang sama:
   ```bash
   git pull origin <nama-branch-bersama>
   ```

## 🔍 Cara cek berhasil
Perintah `git pull` akan melakukan *auto-merge* secara mulus tanpa memicu pesan `CONFLICT`.

## ⚠️ Hati-hati
Hindari melakukan *auto-format* otomatis (seperti Prettier di seluruh file) jika sedang bekerja bersama di file yang sama, karena format ulang akan mengubah ratusan baris sekaligus dan memicu konflik besar.

## 🔗 Lihat juga
[34-cegah-konflik-sebelum-mulai-kode.md](../04-konflik/34-cegah-konflik-sebelum-mulai-kode.md)
