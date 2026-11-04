# Cara Cegah Konflik Sebelum Mulai Mengubah Kode

## 🎯 Kapan dipakai
Pakai panduan ini sebagai kebiasaan harian (*best practice*) sebelum kamu mulai mengetik kode baru di pagi hari atau saat memulai tugas baru.

## 📝 Tips utama pencegahan konflik
1. **Selalu tarik update terbaru sebelum membuat branch baru**:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b <nama-branch-fitur-baru>
   ```
2. **Sinkronkan branch fiturmu dengan `main` secara berkala**:
   Jika kamu mengerjakan satu fitur selama beberapa hari, setiap pagi jalankan:
   ```bash
   git fetch origin main
   git merge origin/main
   ```
3. **Pecah pekerjaan menjadi commit kecil**: Jangan menumpuk perubahan 20 file dalam satu commit besar.
4. **Koordinasikan pembagian file**: Jika tahu rekanmu sedang mengedit `Header.tsx`, hindari mengotak-atik file tersebut sebelum kodenya selesai di-merge.

## 🔗 Lihat juga
[14-ambil-update-terbaru-main-ke-branch.md](../02-branch/14-ambil-update-terbaru-main-ke-branch.md), [25-kerja-bersama-satu-file.md](../03-kolaborasi-pull-request/25-kerja-bersama-satu-file.md)
