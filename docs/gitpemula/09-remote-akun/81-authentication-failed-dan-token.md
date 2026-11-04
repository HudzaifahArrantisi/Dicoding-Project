# Cara Atasi Authentication Failed dan Pakai Personal Access Token

## 🎯 Kapan dipakai
Pakai ini saat kamu menjalankan `git push` atau `git pull` lalu muncul pesan error:
`fatal: Authentication failed for 'https://github.com/...'`
`Support for password authentication was removed on August 13, 2021. Please use a personal access token instead.`

## 📝 Mengapa terjadi
GitHub sudah tidak mengizinkan login terminal menggunakan password akun GitHub biasa demi keamanan. Kamu wajib menggunakan **Personal Access Token (PAT)** atau SSH.

## ✅ Langkah-langkah
1. Buka browser, login ke GitHub, buka: **Settings** -> **Developer Settings** -> **Personal Access Tokens** -> **Tokens (classic)**.
2. Klik **Generate new token (classic)**.
3. Beri nama (misal: "Laptop Asus"), centang izin **repo** (full control).
4. Klik **Generate token** di bagian bawah.
5. **Salin token tersebut** (formatnya diawali `ghp_...`). *Ingat: token ini hanya tampil sekali!*
6. Saat terminal meminta:
   - `Username`: masukkan username GitHub-mu.
   - `Password`: **tempel (paste) kode token `ghp_...` tadi**, bukan password akun biasa!

## 🔗 Lihat juga
[88-pilih-https-atau-ssh-github.md](88-pilih-https-atau-ssh-github.md)
