---
title: Daisuki RAG Bridge
emoji: 🧠
colorFrom: yellow
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# Daisuki RAG Bridge

Bridge HTTP untuk model `daisuki.pkl` milik sistem inventaris Daisuki.
Backend Elysia memanggil Space ini agar tidak perlu menjalankan Python dan
scikit-learn sendiri.

## Endpoint

| Metode | Path | Fungsi |
|---|---|---|
| `GET` | `/health` | Kesiapan model dan indeks retrieval |
| `POST` | `/predict` | Label risiko stok per produk mitra |
| `POST` | `/understand` | Intent pesan, cuplikan RAG, analisis mitra |
| `POST` | `/reload` | Unduh ulang `daisuki.pkl` terbaru dari Hub |

Semua endpoint kecuali `/health` memerlukan header
`Authorization: Bearer <BRIDGE_TOKEN>` bila `BRIDGE_TOKEN` diisi.

## Isi model

`daisuki.pkl` memuat empat bagian sekaligus:

- classifier intent (Multinomial Naive Bayes)
- classifier risiko stok (Multinomial Naive Bayes)
- indeks retrieval dokumen publik
- indeks retrieval analisis mitra

Indeks retrieval tersimpan **di dalam** berkas `.pkl`, sehingga Space tidak
membaca berkas Markdown saat melayani permintaan.

## Secret yang diperlukan

| Nama | Wajib | Fungsi |
|---|---|---|
| `BRIDGE_TOKEN` | **Ya** | Kunci bersama dengan backend Elysia |
| `HF_MODEL_REPO` | Disarankan | Repo model, misal `username/daisuki-model` |
| `HF_TOKEN` | Disarankan | Token baca repo privat, dipakai endpoint `/reload` |

**Space menolak start bila `BRIDGE_TOKEN` kosong atau kurang dari 16 karakter.**
Model memuat indeks privat yang tidak boleh dilayani tanpa autentikasi, jadi
kegagalan saat start lebih aman daripada hidup tanpa kunci.

Tanpa `HF_MODEL_REPO`, endpoint `/reload` hanya memuat ulang berkas yang sudah
ada di disk Space. Karena penyimpanan Space bersifat sementara, isi
`HF_MODEL_REPO` agar model hasil training terbaru bisa diambil kembali.

## Data privat di dalam model

`daisuki.pkl` memuat indeks yang **tidak boleh keluar dari Space private**:

| Indeks | Perkiraan isi | Sifat |
|---|---|---|
| `retrieval` | ~72 cuplikan dokumen publik | Aman untuk Mitra |
| `analysis_retrieval` | ~644 baris analisis per cabang mitra | **Privat** |
| `raw_pdf_retrieval` | ~387 cuplikan CV, karya ilmiah, jurnal | **Privat** |

`analysis_retrieval` memuat konsumsi, log, kejadian kritis, dan status
pelaporan per cabang. Cuplikan privat hanya dikembalikan saat pemanggil
mengirim `admin_access: true`, tetapi seluruh indeks tetap ada di dalam berkas.

Jangan pernah menjadikan Space atau repo model ini publik.

## Catatan

Space gratis berhenti setelah 48 jam tanpa trafik. Panggilan pertama setelah
tidur memerlukan 30-60 detik. Backend memakai batas waktu 20 detik untuk
pemeriksaan `/health` saat warmup dan 8 detik untuk permintaan biasa.
