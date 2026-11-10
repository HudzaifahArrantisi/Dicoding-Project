# AI Data Workspace (Daisuki Inventory)

Folder ini berfungsi sebagai **Pusat Penyimpanan Data & Dokumen (Single Source of Truth Data)** untuk seluruh workspace AI di proyek Daisuki.

## Daftar File & Direktori

1. **`company_knowledge.json`**:
   - Berisi basis pengetahuan resmi perusahaan (profil PT Daisuki Pangan Indonesia, tahun berdiri, pendiri, visi & misi, jam operasional).
   - Katalog resmi 4 produk (`Seblak Jadul Instan`, `Basreng Daun Jeruk`, `Makaroni Daun Jeruk`, `Keripik Pisang Rasa Coklat`).
   - Panduan SOP langkah-demi-langkah: scan resi barcode dus kiriman, lapor stok harian, pengajuan restock, dan update profil cabang.
   - Aturan pembatasan data multi-tenant (Tenant Isolation).

2. **Dataset Training / Custom Data (Untuk ditambahkan di masa mendatang)**:
   - Jika Anda memiliki file CSV, JSON, atau teks percakapan tambahan untuk memperluas intent `daisuki.pkl`, simpan file tersebut di folder `ai/data/` ini.
   - Pastikan loader di `ai/retraining/source.py` membaca file tersebut sebelum menjalankan `train.py`.
