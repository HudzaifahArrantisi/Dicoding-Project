# Cara Atasi Divergent Branches saat Pull

## 🎯 Kapan dipakai
Pakai ini saat kamu menjalankan `git pull` lalu muncul pesan panjang:
`hint: You have divergent branches and need to specify how to reconcile them.`
`hint: You can do so by running one of the following commands before your next pull:`

## 📝 Penyebab error
Git versi 2.27 ke atas mewajibkan kamu menentukan strategi standar penggabungan ketika branch lokalmu dan branch GitHub sama-sama memiliki commit baru yang berbeda arah (*diverged*).

## ✅ Solusi rekomendasi
Atur strategi standar tim menggunakan merge commit:
```bash
git config --global pull.rebase false
```
Lalu ulangi:
```bash
git pull origin <nama-branch>
```

## 🔗 Lihat juga
[08-beda-fetch-dan-pull.md](../01-setup-dasar/08-beda-fetch-dan-pull.md)
