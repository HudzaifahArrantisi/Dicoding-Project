# Cara Pilih Antara HTTPS atau SSH untuk GitHub

## 🎯 Kapan dipakai
Pakai panduan ini saat kamu bingung memilih apakah sebaiknya meng-clone repository menggunakan alamat HTTPS (`https://...`) atau SSH (`git@github.com:...`).

## ⚖️ Perbandingan
| Fitur | HTTPS | SSH |
|---|---|---|
| **Kemudahan awal** | Sangat mudah, langsung jalan tanpa konfigurasi awal. | Butuh generate SSH key dan menempelkannya ke GitHub sekali di awal. |
| **Autentikasi** | Memerlukan Personal Access Token (PAT) atau GitHub Credential Manager. | Otomatis terautentikasi lewat kunci enkripsi publik-privat. |
| **Kenyamanan** | Kadang meminta login ulang jika token kedaluwarsa. | Tidak pernah meminta password lagi selamanya di laptop tersebut. |
| **Rekomendasi** | Cocok untuk pemula yang baru pertama kali belajar. | Rekomendasi standar developer profesional untuk jangka panjang. |

## 🔗 Lihat juga
[81-authentication-failed-dan-token.md](81-authentication-failed-dan-token.md), [82-ganti-url-remote-https-ke-ssh.md](82-ganti-url-remote-https-ke-ssh.md)
