# Cara Kenali Penanda Konflik dalam File

## 🎯 Kapan dipakai
Pakai ini saat membuka file yang mengalami konflik agar kamu paham persis arti simbol-simbol aneh yang disisipkan Git ke dalam kodemu.

## 📝 Anatomi penanda konflik
Ketika terjadi konflik, Git akan memodifikasi file teksmu dengan struktur 4 bagian berikut:

```text
<<<<<<< HEAD
// Ini adalah kode versi kamu saat ini di branch yang sedang aktif
const status = "aman";
=======
// Ini adalah kode versi lawan / incoming yang datang dari branch lain
const status = "waspada";
>>>>>>> origin/main
```

1. **`<<<<<<< HEAD`**: Batas awal kode milik branch kerjamu.
2. **Bagian atas** (`const status = "aman";`): Kode yang kamu buat.
3. **`=======`**: Garis pemisah tengah antara kedua versi.
4. **Bagian bawah** (`const status = "waspada";`): Kode dari branch lain yang sedang dimasukkan.
5. **`>>>>>>> <nama-branch/commit>`**: Batas akhir dari area konflik.

## ⚠️ Hati-hati
Semua baris `<<<<<<<`, `=======`, dan `>>>>>>>` **WAJIB DIHAPUS BERSIH** sebelum file di-commit. Jika tertinggal, kode aplikasimu akan crash atau gagal build!

## 🔗 Lihat juga
[38-pastikan-tidak-ada-penanda-konflik-tertinggal.md](38-pastikan-tidak-ada-penanda-konflik-tertinggal.md)
