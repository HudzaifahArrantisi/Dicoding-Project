# Cara Membuat Repo Baru dan Menghubungkannya ke GitHub

## 🎯 Kapan dipakai
Kamu sudah punya folder proyek lokal, tetapi belum ada riwayat Git dan belum terhubung ke GitHub.

## 📝 Istilah penting
- Repo: folder proyek yang perubahan filenya dicatat Git.
- Remote: alamat repo lain yang terhubung, biasanya di GitHub.
- `origin`: nama singkat yang umum untuk remote GitHub milikmu.
- `git init`: perintah untuk memulai repo Git di folder saat ini.

## ✅ Langkah-langkah
1. Di GitHub, buat repo baru yang **kosong**. Jangan pilih opsi membuat README atau `.gitignore` di GitHub. Salin URL repo dari tombol **Code**. Di terminal, masuk ke folder proyekmu.

   ```bash
   cd <folder-proyek>
   ```

   `cd` membuka folder kerja. Ganti `<folder-proyek>` dengan jalur folder proyekmu. Contoh: di Windows `C:\projek\aplikasi`; di Mac/Linux `~/projek/aplikasi`. Jika path mengandung spasi, beri tanda kutip di sekeliling path. Biasanya tidak ada output.

2. Mulai repo Git dan hubungkan ke GitHub.

   ```bash
   git init
   git remote add origin <url-repo>
   ```

   `git init` membuat riwayat Git lokal; contoh output: `Initialized empty Git repository`. `git remote add origin` menyimpan URL GitHub dengan nama `origin`; biasanya tidak ada output. Ganti `<url-repo>` dengan URL repo kosong tadi, misalnya `https://github.com/tim/aplikasi.git`.

## 🔍 Cara cek berhasil

```bash
git status
git remote -v
```

Baris pertama menunjukkan Git mengenali folder ini; contoh output: `On branch main` atau `On branch master`. Baris kedua menampilkan URL `origin` untuk `fetch` dan `push`. Belum ada file yang terkirim ke GitHub; lanjutkan dengan panduan commit dan push.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `remote origin already exists` | Nama `origin` sudah terdaftar. | Buka [34-origin-already-exists.md](../09-remote-akun/84-origin-already-exists.md). |
| `not a git repository` | Perintah dijalankan di luar folder repo. | Masuk ke folder proyek lalu ulangi `git status`. |

## ⚠️ Hati-hati
Jangan hubungkan proyek lokal ke repo GitHub milik orang lain tanpa memastikan kamu punya izin menulis ke sana.

## 🔗 Lihat juga
[05-tambah-commit-push.md](05-tambah-commit-push.md), [34-origin-already-exists.md](../09-remote-akun/84-origin-already-exists.md)

