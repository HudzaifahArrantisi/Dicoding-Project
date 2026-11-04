# Cara Cari Sebab Nothing to Commit Padahal Sudah Mengedit

## 🎯 Kapan dipakai
Pakai ini saat kamu merasa sudah mengetik banyak kode baru di file proyekmu, tetapi saat mengetik `git status` outputnya tetap mengatakan:
`nothing to commit, working tree clean`

## 📝 4 Kemungkinan penyebab
1. **File belum di-save (Ctrl + S)**: Editor (VS Code) masih menampilkan titik putih di tab nama file karena belum disimpan ke disk fisik.
2. **File berada di dalam daftar `.gitignore`**: Jika file tersebut tercantum atau cocok dengan pola di `.gitignore`, Git akan mengabaikannya secara diam-diam.
   - Cek dengan: `git check-ignore -v <nama-file>`
3. **Mengedit di folder atau tab yang salah**: Kamu membuka file duplikat atau folder di luar repo.
4. **Perubahan sudah dimasukkan ke commit sebelumnya**: Cek riwayat commit terakhir dengan `git log -1 -p`.

## 🔗 Lihat juga
[04-baca-git-status.md](../01-setup-dasar/04-baca-git-status.md), [66-lihat-file-diabaikan-git.md](../07-file-keamanan/66-lihat-file-diabaikan-git.md)
