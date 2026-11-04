# Cara Hindari Commit File Hasil Build dan Cache

## 🎯 Kapan dipakai
Pakai ini untuk menjaga ukuran repository tim tetap ringan (di bawah puluhan megabyte) dan tidak lambat saat di-clone atau di-push.

## 📝 Mengapa file build dilarang di-commit
File seperti `dist/`, `.vite/`, `bun.lockb` corrupt, atau file `.pyc` dibuat ulang secara otomatis oleh komputer masing-masing developer saat menjalankan `bun run build` atau `pip install`. Memasukkan file ini ke Git hanya akan menimbulkan konflik merge yang tak ada habisnya dan membengkakkan ukuran repo.

## ✅ Aturan pencegahan
Pastikan pola-pola ini selalu ada di `.gitignore`:
```gitignore
dist/
build/
.next/
.cache/
*.pyc
*.tsbuildinfo
```

## 🔗 Lihat juga
[61-pilih-file-masuk-gitignore.md](61-pilih-file-masuk-gitignore.md)
