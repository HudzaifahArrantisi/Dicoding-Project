# Cara Menyalin Repo dari GitHub ke Komputer

## 🎯 Kapan dipakai
Tim sudah punya proyek di GitHub dan kamu ingin mulai bekerja di laptopmu.

## 📝 Istilah penting
- Repo (repository): folder proyek yang riwayat perubahannya dicatat Git.
- Clone: membuat salinan repo GitHub di komputer.
- URL: alamat repo yang bisa disalin dari tombol **Code** di GitHub.
- `origin`: nama bawaan untuk alamat repo GitHub hasil clone.

## ✅ Langkah-langkah
1. Buka halaman repo di GitHub. Klik **Code**, pilih **HTTPS**, lalu salin URL-nya. Buka terminal di folder tempat kamu ingin menyimpan proyek.

2. Salin repo.

   ```bash
   git clone <url-repo>
   ```

   `git clone` menyalin file dan riwayat repo ke folder baru. Ganti `<url-repo>` dengan URL dari GitHub, misalnya `https://github.com/tim/proyek.git`. Contoh output: `Cloning into 'proyek'...` lalu `Receiving objects: 100%`.

3. Masuk ke folder hasil clone.

   ```bash
   cd <nama-folder-repo>
   ```

   `cd` memindahkan posisi terminal. Ganti `<nama-folder-repo>` dengan nama folder yang muncul setelah `Cloning into`, misalnya `proyek`. Perintah ini biasanya tidak menampilkan output.

## 🔍 Cara cek berhasil

```bash
git status
git remote -v
```

Baris pertama memastikan folder ini repo Git; contoh output: `On branch main`. Baris kedua menampilkan alamat GitHub; contoh output: `origin https://github.com/tim/proyek.git (fetch)`. `fetch` berarti mengambil info dari GitHub.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `Repository not found` | URL salah atau akunmu belum punya akses. | Cek URL dan minta akses ke pemilik repo. |
| `destination path ... already exists` | Folder tujuan sudah ada. | Pilih folder lain atau gunakan nama tujuan baru pada perintah clone. |

## ⚠️ Hati-hati

## 🔗 Lihat juga
[01-install-dan-setup-git.md](01-install-dan-setup-git.md), [10-bikin-branch-baru.md](10-bikin-branch-baru.md)
