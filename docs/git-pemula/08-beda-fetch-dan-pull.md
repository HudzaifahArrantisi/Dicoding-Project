# Apa Bedanya git fetch dan git pull?

## 🎯 Kapan dipakai
Kamu ingin melihat update di GitHub, tetapi belum yakin apakah update itu harus langsung masuk ke branch kerja.

## 📝 Istilah penting
- Fetch: mengambil informasi commit dari GitHub tanpa menggabungkannya ke branch aktif.
- Pull: mengambil commit lalu menggabungkannya ke branch aktif.
- Branch: cabang kerja dengan riwayat sendiri.
- `origin`: nama singkat repo GitHub.
- `origin/<nama-branch>`: catatan lokal tentang keadaan branch GitHub terakhir yang diambil.

## ✅ Langkah-langkah
1. Cek branch aktif.

   ```bash
   git branch --show-current
   ```

   Perintah ini menampilkan nama branch; contoh output: `fitur-login`.

2. Ambil informasi terbaru tanpa mengubah file kerjamu.

   ```bash
   git fetch origin
   ```

   `git fetch origin` memperbarui catatan lokal tentang branch di GitHub. Contoh output: `a1b2c3d..e4f5g6h fitur-login -> origin/fitur-login`. Artinya ada commit baru di GitHub, tetapi file branch aktif belum digabung.

3. Lihat commit GitHub yang belum masuk ke branch aktif.

   ```bash
   git log --oneline HEAD..origin/<nama-branch>
   ```

   `git log` menampilkan daftar commit singkat. `HEAD` berarti commit tempat branch aktif berada sekarang. Ganti `<nama-branch>` dengan hasil langkah 1. Contoh output: `e4f5g6h perbaiki validasi login`. Jika kosong, tidak ada commit baru dari branch GitHub itu.

4. Kalau sudah siap memasukkan update, gunakan pull.

   ```bash
   git pull origin <nama-branch>
   ```

   `git pull` mengambil update lalu menggabungkannya ke branch aktif. Ganti `<nama-branch>` dengan hasil langkah 1. Contoh output: `Fast-forward`, artinya penggabungan selesai tanpa konflik.

## 🔍 Cara cek berhasil

```bash
git log --oneline HEAD..origin/<nama-branch>
```

Ganti `<nama-branch>` dengan branch aktif. Setelah pull berhasil, output biasanya kosong karena commit dari GitHub sudah masuk. Jika fetch saja, daftar commit baru masih terlihat.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `unknown revision 'origin/...'` | Branch itu belum ada dalam catatan lokal atau namanya salah. | Jalankan `git fetch origin`, lalu cek nama branch lewat panduan 09. |
| `CONFLICT (content)` | Pull menemukan perubahan yang bertabrakan. | Buka [24-konflik-saat-pull.md](24-konflik-saat-pull.md). |

## ⚠️ Hati-hati
`git pull` bisa mengubah file dan memunculkan konflik. Gunakan `git fetch origin` dulu saat hanya ingin melihat update.

## 🔗 Lihat juga
[07-ambil-update-terbaru.md](07-ambil-update-terbaru.md), [09-cek-branch.md](09-cek-branch.md)
