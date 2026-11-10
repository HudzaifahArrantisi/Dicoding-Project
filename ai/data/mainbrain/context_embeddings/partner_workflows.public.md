# Panduan operasional portal mitra Daisuki

Sumber: SOP pada `data/mainbrain/corporate_knowledge/company_knowledge.json`. Dokumen ini menjelaskan alur aplikasi. Fakta tentang pesanan tertentu tetap diambil dari database cabang yang sedang login.

## Melaporkan stok fisik

1. Buka menu **Stok Saya**.
2. Hitung sisa fisik tiap produk resmi di toko.
3. Masukkan angka sisa fisik pada kartu produk.
4. Tekan **Simpan Laporan Stok Fisik** agar log dan status stok diperbarui.

## Mengajukan restock

1. Buka menu **Pesan** dan periksa stok gudang pusat yang tersedia.
2. Pilih produk serta jumlah yang dibutuhkan cabang.
3. Kirim pengajuan restock. Sistem membuat pesanan dengan status diproses.
4. Pantau persetujuan dan pengiriman pada menu **Lacak**.

## Menerima kiriman

1. Pada menu **Lacak**, buka pesanan yang berstatus dalam_pengiriman setelah dus tiba.
2. Periksa kondisi dan jumlah barang fisik.
3. Tekan **Scan Barcode**, lalu pindai atau masukkan kode resi pada surat jalan.
4. Setelah verifikasi berhasil, status menjadi selesai dan stok cabang bertambah sesuai jumlah yang disetujui.
