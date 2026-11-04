# Cara Atasi Pesan No Upstream Branch

## 🎯 Kapan dipakai
Pakai ini saat kamu menjalankan `git push` biasa di branch baru lalu muncul pesan:
`fatal: The current branch <nama-branch> has no upstream branch.`
`To push the current branch and set the remote as upstream, use: git push --set-upstream origin <nama-branch>`

## 📝 Penyebab error
Branch lokal yang baru kamu buat belum memiliki pasangan branch tujuan di server GitHub.

## ✅ Langkah-langkah
1. Jalankan perintah push dengan bendera `-u` (singkatan dari `--set-upstream`):
   ```bash
   git push -u origin <nama-branch>
   ```
2. Untuk push berikutnya di branch ini, kamu cukup mengetik `git push` saja tanpa embel-embel lagi.

## 🔗 Lihat juga
[06-push-pertama-branch.md](../01-setup-dasar/06-push-pertama-branch.md)
