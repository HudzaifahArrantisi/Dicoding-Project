# Cara Atasi Refusing to Merge Unrelated Histories

## 🎯 Kapan dipakai
Pakai ini saat kamu menghubungkan folder lokal baru dengan repo GitHub yang baru dibuat (yang sudah punya file README bawaan), lalu saat di-pull muncul pesan:
`fatal: refusing to merge unrelated histories`

## 📝 Penyebab error
Git melihat dua commit awal di lokal dan di GitHub dibuat secara terpisah tanpa ada silsilah leluhur commit yang sama.

## ✅ Langkah-langkah
Izinkan penggabungan riwayat yang tidak berhubungan dengan opsi bendera khusus:
```bash
git pull origin main --allow-unrelated-histories
```
Jika ada konflik pada file `README.md`, selesaikan konflik, lalu jalankan `git add .` dan `git commit -m "merge: gabungkan repo awal"`.

## 🔗 Lihat juga
[03-bikin-repo-baru.md](../01-setup-dasar/03-bikin-repo-baru.md)
