# Cara Tambah Aturan .gitignore untuk Satu Folder

## 🎯 Kapan dipakai
Pakai ini saat kamu ingin mengabaikan seluruh isi subfolder tertentu (misal folder upload `apps/web/public/uploads/` atau folder output model `ai/models/hasil_training/`).

## ✅ Pola penulisan di .gitignore
Buka file `.gitignore`, lalu tulis nama foldernya diikuti tanda garis miring (`/`):
```gitignore
# Mengabaikan seluruh folder dan semua file di dalamnya
apps/web/public/uploads/
ai/models/hasil_training/

# Mengabaikan semua folder bernama 'temp' di mana pun letaknya
**/temp/
```

## 🔗 Lihat juga
[61-pilih-file-masuk-gitignore.md](61-pilih-file-masuk-gitignore.md)
