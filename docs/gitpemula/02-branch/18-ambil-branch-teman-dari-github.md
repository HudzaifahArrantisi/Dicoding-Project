# Cara Ambil Branch Teman dari GitHub

## 🎯 Kapan dipakai
Pakai ini saat rekan satu kelompokmu membuat branch baru di komputernya dan sudah di-push ke GitHub (misal branch `adel_data`), dan kamu ingin masuk ke branch tersebut di laptopmu untuk membantu atau melanjutkan pengerjaan bersama.

## 📝 Istilah penting
- `git fetch`: memperbarui informasi semua branch dan commit terbaru dari GitHub tanpa mengubah file kerjamu saat ini.
- Tracking branch: membuat salinan branch lokal yang otomatis terhubung ke branch remote di GitHub.

## ✅ Langkah-langkah
1. Pastikan repo lokalmu mengambil daftar branch terbaru dari GitHub:

   ```bash
   git fetch origin
   ```

2. Periksa apakah branch temanmu sudah terdeteksi di GitHub:

   ```bash
   git branch -r
   ```
   *(Kamu akan melihat `origin/<nama-branch-teman>` pada daftar)*.

3. Pindah langsung ke branch tersebut:

   ```bash
   git checkout <nama-branch-teman>
   ```

   *Atau dengan Git versi baru:*
   ```bash
   git switch <nama-branch-teman>
   ```

   Git akan secara otomatis mendeteksi bahwa branch tersebut ada di `origin/<nama-branch-teman>`, lalu membuatkan branch lokal dengan nama yang sama dan menyambungkannya.

## 🔍 Cara cek berhasil
Terminal menampilkan pesan seperti:
```text
branch '<nama-branch-teman>' set up to track 'origin/<nama-branch-teman>'.
Switched to a new branch '<nama-branch-teman>'
```
Ketik `git branch --show-current`, hasilnya adalah nama branch temanmu.

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `error: pathspec '...' did not match any file(s) known to git` | Komputermu belum tahu ada branch baru di GitHub. | Jalankan `git fetch origin` terlebih dahulu, lalu coba lagi. |
| Branch belum muncul di GitHub | Temanmu belum melakukan push dengan `-u origin`. | Minta temanmu menjalankan `git push -u origin <nama-branch>` di laptopnya terlebih dahulu. |

## ⚠️ Hati-hati
Sebelum mulai mengedit kode di branch bersama, biasakan menjalankan `git pull` agar pekerjaanmu tidak menimpa commit terbaru yang baru saja di-push temanmu.

## 🔗 Lihat juga
[08-beda-fetch-dan-pull.md](../01-setup-dasar/08-beda-fetch-dan-pull.md), [13-pindah-branch-dengan-aman.md](13-pindah-branch-dengan-aman.md)
