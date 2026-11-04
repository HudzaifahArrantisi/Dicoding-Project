# Cara Pilih File yang Masuk .gitignore

## 🎯 Kapan dipakai
Pakai ini saat menyiapkan proyek baru atau menambahkan file/folder yang tidak boleh masuk ke GitHub (seperti file konfigurasi lokal, file rahasia, atau file cache).

## 📝 File dan folder standar yang wajib di-ignore
Buat atau buka file `.gitignore` di folder utama (root) proyekmu, lalu pastikan berisi baris-baris ini:
```gitignore
# Dependensi
node_modules/
.venv/
__pycache__/

# Kunci rahasia & Environment lokal
.env
.env.local
*.pem
*.key

# Hasil Build & Cache
dist/
.output/
.turbo/
*.log

# Pengaturan Editor & OS
.DS_Store
Thumbs.db
.vscode/
```

## 🔗 Lihat juga
[62-berhenti-melacak-file-sudah-tercommit.md](62-berhenti-melacak-file-sudah-tercommit.md), [63-tangani-password-atau-env-telanjur-terpush.md](63-tangani-password-atau-env-telanjur-terpush.md)
