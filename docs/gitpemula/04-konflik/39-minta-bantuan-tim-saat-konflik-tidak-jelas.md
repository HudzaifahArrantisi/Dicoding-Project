# Cara Minta Bantuan Tim saat Pilihan Perubahan Tidak Jelas

## 🎯 Kapan dipakai
Pakai ini saat kamu menghadapi konflik pada baris logika yang rumit milik temanmu, dan kamu tidak tahu kode mana yang benar atau aman untuk dipertahankan.

## 📝 Tips kolaborasi saat buntu konflik
1. **Jangan menebak**: Menebak kode orang lain berisiko tinggi menghapus fitur yang sedang mereka bangun.
2. **Cari tahu siapa penulis baris tersebut**:
   Gunakan perintah blame:
   ```bash
   git log -1 -p -- <nama-file>
   ```
3. **Telepon / Diskusi bersama**: Hubungi rekanmu yang menulis kode tersebut. Tunjukkan bagian `HEAD` dan bagian `Incoming`, lalu sepakati solusi gabungan terbaik.
4. **Jika sedang terburu-buru**: Batalkan sementara dengan `git merge --abort` agar kamu bisa bekerja di fitur lain dulu sebelum berdiskusi.

## 🔗 Lihat juga
[33-batalkan-merge-yang-masih-konflik.md](33-batalkan-merge-yang-masih-konflik.md), [74-cari-siapa-yang-mengubah-baris.md](../08-riwayat-inspeksi/74-cari-siapa-yang-mengubah-baris.md)
