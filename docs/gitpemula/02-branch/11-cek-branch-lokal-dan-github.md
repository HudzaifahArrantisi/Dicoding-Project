# Cara Cek Branch Lokal dan GitHub

## 🎯 Kapan dipakai
Pakai ini saat kamu ingin tahu sedang berada di branch apa, branch apa saja yang ada di komputermu, atau branch apa saja yang sudah terunggah di GitHub.

## 📝 Istilah penting
- Branch lokal: cabang kerja yang ada di komputermu.
- Branch remote: cabang kerja yang ada di server GitHub (`origin/nama-branch`).
- HEAD / Tanda bintang (`*`): penanda branch yang sedang aktif kamu gunakan saat ini.

## ✅ Langkah-langkah
1. Cek branch lokal yang ada di komputer:

   ```bash
   git branch
   ```

   Perintah ini menampilkan daftar branch lokal. Branch dengan tanda bintang `*` dan berwarna hijau adalah branch yang sedang aktif.

2. Cek semua branch, termasuk yang ada di GitHub:

   ```bash
   git branch -a
   ```

   Opsi `-a` (*all*) menampilkan branch lokal sekaligus branch di GitHub (`remotes/origin/...`).

3. Cek nama branch yang sedang aktif saja secara cepat:

   ```bash
   git branch --show-current
   ```

## 🔍 Cara cek berhasil
Output terminal menampilkan nama branch dengan jelas. Contoh:
```text
* fitur-login
  main
  remotes/origin/main
  remotes/origin/fitur-login
```

## ❌ Error yang sering muncul
| Pesan error | Artinya | Solusi |
|---|---|---|
| `fatal: not a git repository` | Terminal tidak berada di folder proyek Git. | Masuk ke folder repo dengan `cd <nama-folder>` terlebih dahulu. |
| Branch baru teman tidak muncul di `-a` | Daftar branch lokal belum disinkronkan dengan GitHub. | Jalankan `git fetch origin` untuk menyinkronkan daftar branch terbaru. |

## ⚠️ Hati-hati
Jangan melakukan commit saat berada di kondisi *detached HEAD* (tanpa branch). Selalu pastikan kamu berada di branch fitur yang benar.

## 🔗 Lihat juga
[12-bikin-branch-baru-fitur.md](12-bikin-branch-baru-fitur.md), [13-pindah-branch-dengan-aman.md](13-pindah-branch-dengan-aman.md), [18-ambil-branch-teman-dari-github.md](18-ambil-branch-teman-dari-github.md)
