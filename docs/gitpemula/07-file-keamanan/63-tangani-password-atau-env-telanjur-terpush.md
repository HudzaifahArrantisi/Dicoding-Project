# Cara Tangani Password atau .env yang Telanjur Ter-Push

## 🎯 Kapan dipakai
Pakai panduan tanggap darurat ini saat kamu tidak sengaja meng-commit dan men-push file `.env`, API key, password database, atau token rahasia ke repository GitHub publik/tim.

## 🚨 Tindakan Darurat Wajib
1. **LANGKAH PERTAMA (Paling Kritis)**: **Segera rotasi / ganti password & API key tersebut di dashboard layanan aslinya** (misal ganti password database Neon DB, rotasi JWT Secret, regenerate API key OpenAI/Google).
   *Mengapa? Karena begitu ter-push ke GitHub, bot internet otomatis langsung mencatat credential tersebut dalam hitungan detik.*

2. Hapus pelacakan file di Git:
   ```bash
   git rm --cached .env
   echo ".env" >> .gitignore
   git add .gitignore
   git commit -m "security: hapus .env dari tracking repo"
   git push origin <nama-branch>
   ```

3. Ganti file lokal dengan template kosong:
   Buat file `.env.example` yang hanya berisi nama variabel kosong tanpa isi password asli.

## 🔗 Lihat juga
[62-berhenti-melacak-file-sudah-tercommit.md](62-berhenti-melacak-file-sudah-tercommit.md)
