# Cara Membaca Hasil git status

## 🎯 Kapan dipakai
Kamu ingin tahu file mana yang berubah sebelum menyimpan atau mengirim kode.

## 📝 Istilah penting
- Working tree: file proyek yang sedang ada di folder komputermu.
- Staged: perubahan yang sudah dipilih untuk commit berikutnya.
- Commit: catatan perubahan yang disimpan Git.
- Untracked: file baru yang belum mulai dicatat Git.
- Branch: cabang kerja yang sedang kamu pakai.

## ✅ Langkah-langkah
1. Masuk ke folder repo, lalu cek status.

   ```bash
   git status
   ```

   `git status` membaca kondisi repo tanpa mengubah file. Contoh output:

   ```text
   On branch fitur-login
   Changes to be committed:
     modified:   src/login.js
   Changes not staged for commit:
     modified:   README.md
   Untracked files:
     catatan.txt
   ```

   `On branch` menunjukkan cabang aktif. `Changes to be committed` berarti siap masuk commit. `Changes not staged` berarti editan belum dipilih. `Untracked files` berarti file baru belum dicatat.

2. Kalau hanya ingin ringkasan pendek, jalankan:

   ```bash
   git status --short
   ```

   `git status --short` menyingkat status; contoh output: ` M README.md` berarti file berubah tetapi belum staged, `M  src/login.js` berarti perubahan sudah staged, dan `?? catatan.txt` berarti file baru.

## 🔍 Cara cek berhasil

```bash
git status
```

Jika tidak ada perubahan, output berisi `nothing to commit, working tree clean`. Artinya Git tidak melihat perubahan yang perlu disimpan.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `not a git repository` | Terminal berada di luar folder repo. | Masuk ke folder hasil clone atau folder yang sudah `git init`. |
| `nothing to commit, working tree clean` | Git tidak menemukan perubahan. | Kalau merasa sudah mengedit, buka [38-nothing-to-commit.md](38-nothing-to-commit.md). |

## ⚠️ Hati-hati

## 🔗 Lihat juga
[05-tambah-commit-push.md](05-tambah-commit-push.md), [38-nothing-to-commit.md](38-nothing-to-commit.md)
