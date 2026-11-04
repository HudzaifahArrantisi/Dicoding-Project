# Cara Membaca dan Menyelesaikan Konflik saat Merge

## 🎯 Kapan dipakai
Pakai ini saat kamu menjalankan `git merge` dan muncul pesan `CONFLICT (content): Merge conflict in ...` karena Git bingung memilih kode mana yang harus disimpan.

## 📝 Istilah penting
- Merge Conflict: kondisi ketika dua commit berbeda mengubah baris yang sama di file yang sama dengan cara berbeda.
- Conflict Markers: tanda `<<<<<<<`, `=======`, dan `>>>>>>>` yang disisipkan Git ke dalam filemu.

## ✅ Langkah-langkah
1. Cek file apa saja yang mengalami konflik:
   ```bash
   git status
   ```
   *(File yang berkonflik akan berstatus `both modified`)*.

2. Buka file tersebut di VS Code. Kamu akan melihat penanda:
   ```text
   <<<<<<< HEAD (Current Change)
   kode milik branch kerjamu saat ini
   =======
   kode dari branch yang sedang kamu merge (Incoming Change)
   >>>>>>> branch-sumber
   ```

3. Di VS Code, kamu bisa klik tombol pintas di atasnya:
   - **Accept Current Change**: simpan kodemu, buang kode lawan.
   - **Accept Incoming Change**: buang kodemu, simpan kode lawan.
   - **Accept Both Changes**: simpan kedua kode secara berurutan.
   - Atau edit baris tersebut secara manual dan **hapus semua tanda `<<<`, `===`, `>>>`**.

4. Simpan file yang sudah bersih, lalu tandai sebagai selesai:
   ```bash
   git add <nama-file>
   ```

5. Selesaikan proses merge dengan membuat commit:
   ```bash
   git commit -m "merge: selesaikan konflik merge"
   ```

## 🔍 Cara cek berhasil
Perintah `git status` menampilkan: `nothing to commit, working tree clean`.

## 🔗 Lihat juga
[32-selesaikan-konflik-saat-pull.md](32-selesaikan-konflik-saat-pull.md), [33-batalkan-merge-yang-masih-konflik.md](33-batalkan-merge-yang-masih-konflik.md), [35-kenali-penanda-konflik-dalam-file.md](35-kenali-penanda-konflik-dalam-file.md)
