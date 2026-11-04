# Cara Lihat Commit yang Belum Masuk ke main

## 🎯 Kapan dipakai
Pakai ini saat kamu ingin tahu commit apa saja yang ada di branch fiturmu yang belum pernah digabungkan ke `main`.

## ✅ Langkah-langkah
Jalankan perintah log perbandingan:
```bash
git log --oneline main..<nama-branch-fitur>
```

Output hanya akan menampilkan daftar commit unik milik branch fitur tersebut.

## 🔗 Lihat juga
[75-bandingkan-dua-branch.md](75-bandingkan-dua-branch.md)
