# Cara Tulis Deskripsi Pull Request yang Mudah Diperiksa

## 🎯 Kapan dipakai
Pakai ini setiap kali kamu membuat Pull Request baru agar teman satu timmu langsung paham apa yang kamu kerjakan, mengapa perubahan itu dibuat, dan bagaimana cara mengujinya tanpa harus menebak-nebak.

## 📝 Format standar deskripsi PR yang baik
Gunakan template ringkas berikut pada kotak deskripsi PR:

```markdown
### 📌 Ringkasan Perubahan
- Menambahkan validasi input form pesanan restock mitra.
- Memperbaiki perhitungan sisa stok harian agar tidak terjadi nilai minus.

### 🧪 Cara Mengetes
1. Jalankan `bun run dev`.
2. Buka halaman `/mitra`.
3. Coba isi jumlah pesanan lebih dari stok pusat, pastikan muncul pesan error.

### 📸 Bukti Pengujian (Opsional)
*(Sertakan screenshot atau rekaman layar jika ada perubahan visual UI)*

### 🔗 Terkait Issue / Tugas
- Menyelesaikan tugas #42
```

## 💡 Tips agar PR cepat di-review
1. **Jangan membuat PR raksasa**: PR dengan perubahan di bawah 300 baris akan diperiksa jauh lebih cepat dibandingkan PR 2000 baris.
2. **Jelaskan konteks**: Tuliskan alasan bisnis atau masalah teknis yang kamu selesaikan.
3. **Tuliskan dependensi baru**: Jika kamu menambahkan library (`bun add ...`) atau variabel environment baru di `.env`, cantumkan di deskripsi agar rekan tim mengetahuinya.

## 🔗 Lihat juga
[21-bikin-pull-request.md](21-bikin-pull-request.md), [30-pastikan-branch-siap-sebelum-merge.md](30-pastikan-branch-siap-sebelum-merge.md)
