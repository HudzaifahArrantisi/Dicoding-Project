# Cara Selesaikan Konflik Ketika File Dihapus dan Diubah

## 🎯 Kapan dipakai
Pakai ini saat terjadi konflik tipe `modify/delete`: satu rekan tim mengubah isi file, sementara rekan tim lain (atau branch `main`) menghapus file tersebut.

## 📝 Istilah penting
- `modify/delete conflict`: kondisi saat Git bingung apakah file harus dipertahankan dengan perubahan baru atau harus dibuang sesuai branch lawan.

## ✅ Langkah-langkah
1. Periksa nama file yang terkena `modify/delete`:
   ```bash
   git status
   ```

2. Tentukan keputusan:
   - **Pilihan A: Jika file ingin tetap DIPERTAHANKAN**:
     ```bash
     git add <nama-file>
     ```
   - **Pilihan B: Jika file memang ingin DIHAPUS**:
     ```bash
     git rm <nama-file>
     ```

3. Selesaikan commit merge:
   ```bash
   git commit -m "merge: selesaikan konflik modify/delete"
   ```

## 🔗 Lihat juga
[31-baca-dan-selesaikan-konflik-saat-merge.md](31-baca-dan-selesaikan-konflik-saat-merge.md)
