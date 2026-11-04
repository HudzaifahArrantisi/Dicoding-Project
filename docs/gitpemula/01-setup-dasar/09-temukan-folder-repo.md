# Cara Memastikan Terminal Berada di Folder Repo yang Benar

## 🎯 Kapan dipakai
Pakai ini kalau perintah Git gagal, atau perubahan yang kamu buat tidak muncul di hasil pemeriksaan Git.

## 📝 Istilah penting
- Terminal: tempat kamu mengetik perintah.
- Repo: folder proyek yang perubahan filenya dicatat Git.
- Working tree: file proyek yang sedang ada di komputermu.

## ✅ Langkah-langkah
1. Cek apakah folder saat ini berada di dalam repo.

   ```bash
   git rev-parse --show-toplevel
   ```

   Perintah ini menampilkan lokasi folder utama repo. Contoh output Windows: `C:/projek/aplikasi`. Di Mac/Linux, bentuknya seperti `/home/kamu/projek/aplikasi`. Jika muncul `fatal: not a git repository`, terminalmu sedang di luar repo.

2. Periksa nama branch dan kondisi file.

   ```bash
   git status
   ```

   Perintah ini menampilkan kondisi repo. Contoh output: `On branch fitur-login`. Jika nama proyek atau branch terasa salah, buka terminal baru langsung dari folder proyek yang benar.

## 🔍 Cara cek berhasil

```bash
git rev-parse --show-toplevel
```

Perintah ini harus menampilkan folder proyek yang ingin kamu kerjakan. Cocokkan lokasinya dengan folder yang sedang kamu edit di editor.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `fatal: not a git repository` | Terminal berada di luar repo Git. | Buka folder proyek hasil clone, lalu jalankan perintah lagi. |
| `On branch main` padahal ingin bekerja di branch fitur | Kamu berada di branch yang salah. | Buka panduan pindah branch di kategori Branch. |

## ⚠️ Hati-hati

## 🔗 Lihat juga
[02-clone-repo-github.md](02-clone-repo-github.md), [04-baca-git-status.md](04-baca-git-status.md)

