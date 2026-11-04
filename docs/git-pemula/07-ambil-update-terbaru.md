# Cara Mengambil Update Terbaru dengan git pull

## 🎯 Kapan dipakai
Kamu ingin memperbarui branch aktif dengan commit terbaru dari branch yang sama di GitHub.

## 📝 Istilah penting
- Branch: cabang kerja yang punya riwayat perubahan sendiri.
- Pull: mengambil commit dari GitHub lalu menggabungkannya ke branch aktif.
- Remote: repo yang terhubung di tempat lain, misalnya GitHub.
- `origin`: nama singkat remote GitHub.
- Commit: catatan perubahan yang disimpan Git.

## ✅ Langkah-langkah
1. Pastikan kamu ada di branch yang ingin diperbarui dan lihat perubahan lokal.

   ```bash
   git branch --show-current
   git status --short
   ```

   Baris pertama menampilkan branch aktif; contoh: `fitur-login`. Baris kedua menampilkan file lokal yang belum di-commit. Jika ada file berubah, simpan dulu agar pull tidak mengganggu pekerjaanmu.

2. Ambil perubahan dari branch yang sama di GitHub.

   ```bash
   git pull origin <nama-branch>
   ```

   `git pull` mengambil lalu menggabungkan commit. Ganti `<nama-branch>` dengan nama dari langkah 1. Contoh output: `Updating a1b2c3d..e4f5g6h` lalu `Fast-forward`, artinya commit baru masuk tanpa konflik. Jika output `Already up to date.`, tidak ada commit baru.

## 🔍 Cara cek berhasil

```bash
git status
```

Perintah ini mengecek keadaan repo. Jika output memuat `working tree clean`, tidak ada edit lokal tertinggal. Bandingkan commit terbaru lewat `git log -1 --oneline`; perintah itu menampilkan satu commit terbaru.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `Your local changes ... would be overwritten by merge` | Editan lokal akan tertimpa. | Simpan commit atau stash dulu; lihat panduan 31. |
| `CONFLICT (content)` | Perubahan lokal dan GitHub menyentuh bagian yang sama. | Buka [24-konflik-saat-pull.md](24-konflik-saat-pull.md). |
| `Need to specify how to reconcile divergent branches` | Git meminta cara menggabungkan dua riwayat yang maju sendiri-sendiri. | Buka [33-divergent-branches.md](33-divergent-branches.md). |

## ⚠️ Hati-hati
Pull mengubah file di branch aktif. Cek branch dan simpan editan lokal lebih dulu. Untuk membawa perubahan `main` ke branch kerjamu, ikuti panduan 12.

## 🔗 Lihat juga
[08-beda-fetch-dan-pull.md](08-beda-fetch-dan-pull.md), [12-update-main-ke-branch.md](12-update-main-ke-branch.md), [24-konflik-saat-pull.md](24-konflik-saat-pull.md)
