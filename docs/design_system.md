# Design System — Daisuki B2B Inventory & Order System

Panduan visual dan UI untuk dua portal: **Portal Mitra** (HP, dipakai PIC di lapangan) dan **Dashboard Admin** (desktop, dipakai tim Daisuki pusat).
Stack UI: TanStack Start + React + Tailwind CSS v4 (+ shadcn/ui sebagai basis komponen).

---

## 1. Prinsip desain

1. **Angka stok adalah pemeran utama.** Qty harus paling mudah dibaca, selalu tabular, tidak pernah tersaingi dekorasi.
2. **Satu elemen khas: *Rak Bar*.** Indikator stok berbentuk slot rak (10 kotak) yang terisi sesuai persentase stok. Semua hal lain dibuat tenang.
3. **Status tidak hanya warna.** Setiap status = warna + ikon + teks (aman bagi buta warna dan layar kena sinar matahari).
4. **Mitra: minim klik, jempol-friendly.** Update stok maksimal 3 ketukan per produk. Target sentuh minimal 44 px.
5. **Admin: padat tapi terbaca.** Tabel dan dashboard boleh rapat, tetapi baris kritis selalu paling menonjol.
6. **Bahasa sederhana.** Pakai istilah yang dipahami PIC toko, bukan istilah teknis sistem.

---

## 2. Warna

### 2.1 Palet inti

| Token | Nama | Hex | Pemakaian |
|---|---|---|---|
| `ink-900` | Tinta gelap | `#141B3D` | Teks judul, sidebar admin |
| `ink-700` | Indigo Daisuki | `#26336B` | **Primary**: tombol utama, link, fokus |
| `ink-500` | Indigo sedang | `#4A5BA8` | Hover, ikon aktif |
| `ink-100` | Indigo pucat | `#E6E9F5` | Latar item terpilih, chip netral |
| `ink-50` | Indigo sangat pucat | `#F2F4FA` | Latar zebra tabel, hover baris |
| `paper` | Kertas | `#F6F7F9` | Latar halaman |
| `surface` | Permukaan | `#FFFFFF` | Kartu, tabel, input |
| `line` | Garis | `#DDE1E8` | Border, divider |
| `text` | Teks | `#161A26` | Teks isi |
| `muted` | Teks sekunder | `#5B6272` | Label, helper text, timestamp |

> Aksen merek (logo, halaman login, empty state) memakai **Ume** `#B83A6A`. Jangan dipakai untuk tombol atau status, supaya tidak bentrok dengan merah "kritis".

### 2.2 Warna status stok

Persentase = `stok_sisa / par_level × 100` (par level = target stok maksimum per mitra per produk, diatur admin).

| Status | Aturan | Fill | Teks | Latar badge | Ikon |
|---|---|---|---|---|---|
| **Aman** | > 50% | `#1E8E4E` | `#14653A` | `#E3F4EA` | `check-circle` |
| **Waspada** | 20% – 50% | `#F5B700` | `#7A5200` | `#FFF3CC` | `alert-triangle` |
| **Kritis** | < 20% | `#C62828` | `#9B1C1C` | `#FDE7E7` | `alert-octagon` |
| **Belum update** | > 24 jam tanpa update | `#8A91A3` | `#4A5163` | `#EDEFF3` | `clock` |

Batas tepat: 50% masuk Waspada, 20% masuk Waspada, 19,99% masuk Kritis.

### 2.3 Warna status order

| Status | Label UI | Warna teks / latar |
|---|---|---|
| `diproses` | Menunggu persetujuan | `#26336B` / `#E6E9F5` |
| `disetujui` | Disetujui | `#0B6A73` / `#DDF3F5` |
| `dalam_pengiriman` | Dalam pengiriman | `#1857A8` / `#E1EDFB` |
| `selesai` | Selesai | `#14653A` / `#E3F4EA` |
| `ditolak` | Ditolak | `#9B1C1C` / `#FDE7E7` |
| `dibatalkan` | Dibatalkan | `#4A5163` / `#EDEFF3` |

---

## 3. Tipografi

| Peran | Font | Bobot | Catatan |
|---|---|---|---|
| Judul dan angka besar | **Bricolage Grotesque** | 600, 700 | Karakter khas, dipakai untuk heading dan angka ringkasan |
| UI dan isi | **Figtree** | 400, 500, 600 | Terbaca di layar kecil |

Aturan:
- Semua angka qty, harga, dan persentase memakai `font-variant-numeric: tabular-nums`.
- Gunakan **sentence case** untuk semua label. Hindari huruf kapital semua.
- Lebar baris teks maksimal 70 karakter.

| Token | Ukuran / line-height | Pemakaian |
|---|---|---|
| `text-xs` | 12 / 16 | Timestamp, helper text |
| `text-sm` | 14 / 20 | Tabel, label form |
| `text-base` | 16 / 24 | Isi, input (minimal 16 px agar iOS tidak zoom) |
| `text-lg` | 18 / 26 | Judul kartu |
| `text-xl` | 20 / 28 | Judul seksi |
| `text-2xl` | 24 / 30 | Judul halaman |
| `text-4xl` | 40 / 44 | Angka ringkasan di dashboard |

---

## 4. Spacing, radius, elevasi

- **Spacing:** kelipatan 4 px (`4, 8, 12, 16, 24, 32, 48`). Padding kartu mitra 16, kartu admin 20.
- **Radius dibedakan menurut hierarki**, bukan satu ukuran untuk semua:

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `radius-sm` | 6 px | Input, badge, chip |
| `radius-md` | 10 px | Tombol, kartu |
| `radius-lg` | 16 px | Bottom sheet, modal |

- **Elevasi:** utamakan border `line`, bukan bayangan. Bayangan hanya untuk elemen melayang (dropdown, sheet, toast):
  `0 8px 24px rgb(20 27 61 / 0.14)`

---

## 5. Layout

### 5.1 Portal Mitra (mobile-first, satu kolom)

```
┌──────────────────────────┐
│ Kafe Sejuk · Cabang BSD  │  header: nama mitra
│ Terakhir update: 08.12   │
├──────────────────────────┤
│ Cari produk…             │
├──────────────────────────┤
│ Keripik Singkong Original│
│ ▮▮▮▮▮▮▯▯▯▯  62%  Aman    │  Rak Bar + status
│ Stok sisa      [−] 31 [+]│  stepper qty
├──────────────────────────┤
│ Basreng Pedas            │
│ ▮▮▯▯▯▯▯▯▯▯  15%  Kritis  │
│ Stok sisa      [−]  6 [+]│
├──────────────────────────┤
│ [      Simpan stok      ]│  tombol menempel di bawah
├──────────────────────────┤
│  Stok    Pesan    Riwayat│  bottom nav 3 tab
└──────────────────────────┘
```

Perataan: kiri. Qty dan tombol aksi di kanan. Bottom nav selalu terlihat.

### 5.2 Dashboard Admin (desktop-first)

```
┌────────┬─────────────────────────────────────────────┐
│ Daisuki│ Ringkasan stok                 [Cari mitra] │
│        ├──────────┬──────────┬──────────┬────────────┤
│ Ringkas│ Kritis 4 │Waspada 9 │ Aman 31  │Belum upd. 3│
│ Mitra  ├──────────┴──────────┴──────────┴────────────┤
│ Produk │ Perlu restock segera                        │
│ Order  │ Mitra        Produk       Sisa   Status     │
│ Laporan│ Kafe Sejuk   Basreng      6/40   ▮▯▯▯ Kritis│
│        │ Hotel Aruna  Keripik      4/30   ▮▯▯▯ Kritis│
│        ├─────────────────────────────────────────────┤
│        │ Order menunggu persetujuan (2)              │
└────────┴─────────────────────────────────────────────┘
```

Sidebar 240 px (latar `ink-900`), konten maksimal 1280 px. Di tablet sidebar menjadi ikon. Di HP admin, sidebar menjadi menu hamburger.

---

## 6. Komponen

### 6.1 Rak Bar (komponen khas)
- 10 slot sejajar, tinggi 12 px, jarak 2 px, radius 2 px.
- Jumlah slot terisi = `ceil(persen / 10)`, diwarnai sesuai status stok. Slot kosong memakai `line`.
- Selalu diikuti teks persentase dan badge status (jangan hanya bar).
- Versi mini (admin tabel): 5 slot, tinggi 8 px.

### 6.2 Status badge
Pill `radius-sm`, ikon 14 px + teks `text-sm` bobot 500. Warna dari bagian 2.2 dan 2.3.

### 6.3 Stepper qty (portal mitra)
- Tombol `−` dan `+` ukuran 44 × 44, di tengah angka 20 px bobot 600.
- Ketuk angka untuk mengetik langsung (`inputmode="numeric"`, `pattern="[0-9]*"`).
- Tahan tombol untuk menambah/mengurangi cepat. Tidak boleh bernilai negatif.
- Perubahan yang belum disimpan ditandai titik `ink-500` di sebelah nama produk.

### 6.4 Tombol

| Varian | Tampilan | Dipakai untuk |
|---|---|---|
| Primary | Latar `ink-700`, teks putih | Simpan stok, Ajukan restock, Setujui |
| Secondary | Border `ink-700`, teks `ink-700` | Ubah jumlah, Lihat detail |
| Danger | Latar `#C62828`, teks putih | Tolak order |
| Ghost | Tanpa border | Batal, aksi tersier |

Tinggi 48 px (mitra), 40 px (admin). Status loading: spinner di dalam tombol, teks tetap, tombol nonaktif.

### 6.5 Timeline status order
Urutan nyata: Menunggu persetujuan → Disetujui → Dalam pengiriman → Selesai. Langkah selesai berisi centang, langkah aktif diberi cincin `ink-700`, langkah berikutnya abu-abu. Order ditolak/dibatalkan menampilkan satu badge terpisah, bukan timeline.

### 6.6 Tabel admin
Header sticky, baris tinggi 48 px, zebra `ink-50`. Baris Kritis diberi garis kiri 3 px merah. Kolom angka rata kanan. Kolom aksi di paling kanan. Filter berupa chip di atas tabel (status, jenis mitra).

### 6.7 Kartu mitra (admin)
Nama mitra, jenis (hotel / restoran / kafe / minimarket), jumlah produk kritis, waktu update terakhir, Rak Bar gabungan. Klik membuka detail stok per produk.

### 6.8 Notifikasi dan toast
- **Toast** di bawah (mobile) atau kanan atas (desktop), hilang otomatis 4 detik, tidak menutup tombol utama.
- **Alert stok kritis** di admin: ikon bell dengan badge jumlah belum dibaca. Panel berisi daftar, setiap item punya tombol "Buat restock".

### 6.9 Empty, loading, error
- **Loading:** skeleton sesuai bentuk konten, bukan spinner layar penuh.
- **Empty:** satu kalimat penjelasan + satu tombol aksi.
- **Error:** jelaskan apa yang salah dan apa yang bisa dilakukan. Tidak pakai kata maaf.

---

## 7. Motion

Gerakan hanya untuk merespons aksi atau perubahan data:
1. **Baris berubah realtime:** saat stok mitra masuk di dashboard admin, baris menyala latar `ink-100` selama 1,2 detik lalu memudar. Ini satu-satunya gerakan "tanpa dipicu pengguna".
2. **Simpan berhasil:** Rak Bar mengisi ke nilai baru (200 ms).
3. **Sheet/modal:** muncul 160 ms.

Hormati `prefers-reduced-motion`: matikan semua animasi di atas dan ganti dengan perubahan instan.

---

## 8. Aksesibilitas

- Kontras teks minimal WCAG AA (4,5:1 untuk teks isi, 3:1 untuk teks besar dan ikon).
- Fokus keyboard selalu terlihat: ring 2 px `ink-700` dengan offset 2 px.
- Semua input punya `label` yang terhubung. Pesan error memakai `aria-describedby`.
- Status stok dibaca screen reader sebagai teks, contoh: "Basreng Pedas, sisa 6 dari 40, status kritis".
- Perubahan realtime di dashboard memakai `aria-live="polite"`.

---

## 9. Panduan teks (Bahasa Indonesia)

| Konteks | Pakai | Hindari |
|---|---|---|
| Tombol simpan stok | Simpan stok | Submit |
| Toast sukses | Stok tersimpan | Berhasil! 🎉 |
| Tombol order | Ajukan restock | Buat PO |
| Aksi admin | Setujui, Tolak, Ubah jumlah | Approve, Reject |
| Empty order | Belum ada pesanan. Ajukan restock pertama Anda. | Tidak ada data |
| Error jaringan | Stok belum tersimpan. Periksa koneksi, lalu coba lagi. | Terjadi kesalahan |
| Validasi qty | Jumlah tidak boleh lebih besar dari kapasitas rak (40). | Input tidak valid |

Aturan: kalimat aktif, sentence case, satu nama untuk satu aksi di seluruh alur ("Simpan stok" → toast "Stok tersimpan"). Panggil pengguna "Anda".

---

## 10. Implementasi (Tailwind v4)

Pasang font:

```bash
bun add @fontsource-variable/bricolage-grotesque @fontsource-variable/figtree
```

`src/styles/app.css`:

```css
@import "tailwindcss";
@import "@fontsource-variable/bricolage-grotesque";
@import "@fontsource-variable/figtree";

@theme {
  --font-display: "Bricolage Grotesque Variable", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "Figtree Variable", ui-sans-serif, system-ui, sans-serif;

  --color-ink-900: #141b3d;
  --color-ink-700: #26336b;
  --color-ink-500: #4a5ba8;
  --color-ink-100: #e6e9f5;
  --color-ink-50: #f2f4fa;

  --color-paper: #f6f7f9;
  --color-surface: #ffffff;
  --color-line: #dde1e8;
  --color-text: #161a26;
  --color-muted: #5b6272;
  --color-ume: #b83a6a;

  --color-ok: #1e8e4e;
  --color-ok-fg: #14653a;
  --color-ok-bg: #e3f4ea;
  --color-warn: #f5b700;
  --color-warn-fg: #7a5200;
  --color-warn-bg: #fff3cc;
  --color-crit: #c62828;
  --color-crit-fg: #9b1c1c;
  --color-crit-bg: #fde7e7;
  --color-stale: #8a91a3;
  --color-stale-fg: #4a5163;
  --color-stale-bg: #edeff3;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;

  --shadow-float: 0 8px 24px rgb(20 27 61 / 0.14);
}

@layer base {
  html { font-family: var(--font-sans); color: var(--color-text); background: var(--color-paper); }
  h1, h2, h3 { font-family: var(--font-display); }
  .num { font-variant-numeric: tabular-nums; }
  :focus-visible { outline: 2px solid var(--color-ink-700); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }
}
```

Fungsi status stok (taruh di `packages/shared` supaya web dan API memakai aturan yang sama):

```ts
export type StockStatus = "aman" | "waspada" | "kritis" | "belum_update";

export function getStockStatus(qty: number, parLevel: number, updatedAt?: Date): StockStatus {
  if (updatedAt && Date.now() - updatedAt.getTime() > 24 * 60 * 60 * 1000) return "belum_update";
  const pct = parLevel > 0 ? (qty / parLevel) * 100 : 0;
  if (pct > 50) return "aman";
  if (pct >= 20) return "waspada";
  return "kritis";
}
```

> Catatan: "belum_update" sebaiknya ditampilkan sebagai penanda tambahan di samping status stok terakhir, bukan menggantikannya, supaya admin tetap tahu level stok terakhir yang dilaporkan. Sesuaikan di UI.

Cek sebelum rilis: semua status punya ikon dan teks, semua angka memakai `.num`, semua tombol utama ≥ 44 px di portal mitra, animasi mati saat `prefers-reduced-motion`.
