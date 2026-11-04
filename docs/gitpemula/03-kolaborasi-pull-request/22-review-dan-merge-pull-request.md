# Cara Review dan Merge Pull Request

## 🎯 Kapan dipakai
Pakai ini saat rekan tim membuat Pull Request dan kamu bertugas memeriksa kodenya sebelum menyetujui dan menggabungkannya ke branch `main`.

## 📝 Istilah penting
- Code Review: proses memeriksa kualitas, kebenaran logika, dan kerapian kode yang dibuat rekan tim.
- Files Changed: tab di GitHub yang menampilkan perbedaan baris kode merah (dihapus) dan hijau (ditambah).
- Merge Pull Request: tindakan menyatukan commit PR ke dalam `main`.

## ✅ Langkah-langkah
1. Buka halaman Pull Request rekanmu di GitHub.
2. Klik tab **Files changed** untuk melihat apa saja yang berubah.
3. Berikan komentar pada baris kode tertentu jika ada bagian yang keliru atau perlu diperbaiki.
4. Klik tombol hijau **Review changes** di pojok kanan atas:
   - Pilih **Approve** jika kode sudah bagus dan siap digabung.
   - Pilih **Request changes** jika masih ada bug atau hal yang wajib diperbaiki sebelum digabung.
5. Jika sudah disetujui, klik tombol hijau **Merge pull request**, lalu klik **Confirm merge**.

## 🔍 Cara cek berhasil
Status Pull Request berubah menjadi warna ungu bertuliskan **Merged**, dan commit dari branch tersebut kini sudah resmi menjadi bagian dari branch `main`.

## ⚠️ Hati-hati
Pilihlah opsi penggabungan sesuai standar tim:
- *Create a merge commit*: menyimpan seluruh riwayat lengkap.
- *Squash and merge*: menyatukan banyak commit kecil menjadi satu commit rapi di `main`.

## 🔗 Lihat juga
[23-perbarui-repo-lokal-setelah-pr-digabung.md](23-perbarui-repo-lokal-setelah-pr-digabung.md), [27-perbaiki-kode-setelah-review.md](27-perbaiki-kode-setelah-review.md)
