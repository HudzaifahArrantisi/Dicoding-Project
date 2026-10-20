# Instalasi Daisuki di Android

Halaman `/login` menyediakan tombol **Instal aplikasi Daisuki**. Ketika Chrome
mengirim `beforeinstallprompt`, tombol membuka dialog instalasi bawaan Chrome.
Pengguna dapat menyetujui atau membatalkan. Ini adalah instalasi PWA melalui
browser, tanpa menyediakan file APK untuk diunduh.

## Menjalankan dan menguji

- Publikasikan web melalui HTTPS. `localhost` dapat dipakai untuk pengembangan
  di komputer; alamat HTTP LAN seperti `http://192.168.x.x:3000` di ponsel tidak
  memenuhi secure context.
- Buka `/login` melalui Chrome Android biasa, di luar mode samaran.
- Tunggu halaman selesai dimuat, lalu tekan tombol instal. Browser menentukan
  kapan prompt tersedia; kunjungan pertama atau setelah pengguna membatalkan
  dapat belum menampilkan prompt. Tombol memberikan petunjuk menu browser
  ketika event belum tersedia.
- Uji pilihan Batal: halaman login tetap dapat digunakan. Prompt yang telah
  dipakai tidak digunakan ulang; perlu event baru dari browser.
- Uji pilihan Instal: buka ikon Daisuki di layar utama, pastikan aplikasi
  terbuka tanpa address bar, lalu login sebagai mitra atau admin.
- Putuskan internet dan muat ulang aplikasi: halaman penjelasan offline
  tampil. Sambungkan internet dan pilih Coba lagi.

Di DevTools > Application, periksa Manifest dan Service Workers. Pastikan
`/manifest.webmanifest`, `/pwa.js`, `/sw.js`, `/offline.html`, serta ikon di
`/icons/` dapat diakses tanpa login. Berkas publik ini ikut output build Vite.
Jika hosting menerapkan cache tambahan, jangan cache `sw.js` secara immutable.
API yang digunakan oleh web HTTPS juga harus dapat diakses melalui HTTPS.

## Batas offline dan pembaruan

Service worker hanya menyimpan halaman penjelasan offline. Halaman terautentikasi,
respons API, dan transaksi stok tidak disimpan dalam cache service worker.
Pencatatan stok dan pesanan membutuhkan internet; tidak ada antrean mutasi offline.

Worker baru mengikuti siklus pembaruan browser tanpa memaksa reload saat pengguna
sedang mengisi laporan. Naikkan versi `OFFLINE_CACHE` di `public/sw.js` jika isi
`offline.html` berubah. Cache offline versi lama dibersihkan saat worker baru aktif.

## Verifikasi otomatis

Jalankan dari `apps/web`:

```sh
bun test tests/pwa.test.js
bun run typecheck
bun run build
```

Pengujian otomatis memeriksa penangkapan event instalasi, registrasi worker,
batas request offline, manifest, dan dimensi ikon. Dialog instalasi dan hasil
pemasangan Android perlu diuji pada perangkat Chrome Android melalui HTTPS.
