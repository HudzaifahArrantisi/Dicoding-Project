# Cara Lihat Commit Sebelum Menggabungkan Branch

## 🎯 Kapan dipakai
Pakai ini sebelum menjalankan `git merge` untuk meninjau secara visual commit apa saja yang akan masuk ke dalam branch-mu.

## ✅ Langkah-langkah
Jalankan perintah log komparasi dengan tanda panah:
```bash
git log --oneline --left-right HEAD...origin/main
```

Tanda `<` menunjukkan commit unik di branch lokalmu saat ini, sedangkan tanda `>` menunjukkan commit baru dari GitHub yang akan masuk saat di-merge.

## 🔗 Lihat juga
[75-bandingkan-dua-branch.md](../08-riwayat-inspeksi/75-bandingkan-dua-branch.md)
