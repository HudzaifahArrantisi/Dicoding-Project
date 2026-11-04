# Cara Batalkan Pull Request yang Belum Digabung

## 🎯 Kapan dipakai
Pakai ini saat fitur yang kamu ajukan ternyata salah arah, dibatalkan oleh kesepakatan tim, atau kamu tidak sengaja membuka PR ke branch yang salah.

## 📝 Istilah penting
- Close PR: menutup Pull Request tanpa menggabungkan kodenya ke branch utama.
- Closed status: status PR yang diarsipkan tanpa di-merge (ikon berwarna merah).

## ✅ Langkah-langkah
1. Buka halaman Pull Request yang ingin kamu batalkan di GitHub.
2. Scroll ke bagian paling bawah kolom percakapan/komentar.
3. Tulis alasan pembatalan secara singkat pada kotak komentar (misal: *"Fitur ini dibatalkan karena diganti dengan pendekatan baru"*).
4. Klik tombol **Close pull request** (atau **Close with comment**).

## 🔍 Cara cek berhasil
Status di bagian atas PR berubah dari hijau (**Open**) menjadi merah (**Closed**). Kode dari PR tersebut tidak akan masuk ke branch `main`.

## 💡 Tips praktis
Menutup PR tidak akan menghapus branch fitur milikmu. Jika kamu nantinya ingin menghapus branch-nya juga, hapus branch lewat terminal atau tombol *Delete branch*.

## 🔗 Lihat juga
[16-hapus-branch-di-github.md](../02-branch/16-hapus-branch-di-github.md)
