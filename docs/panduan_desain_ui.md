# Panduan Desain UI — Daisuki Inventory
**Gaya:** Modern Clean SaaS · Bento Cards · Isometric/3D Data Accent
**Referensi visual:** Dashboard analytics "maydin.co" (`docs/WhatsApp Image 2026-11-24 at 15.52.45.jpeg`)

> **Catatan implementasi:** Dokumen ini hanya mengatur **estetika visual** (warna, tipografi, bayangan, radius, gaya komponen). Tidak mengubah struktur HTML, grid, maupun layout yang sudah ada. Semua nilai di bawah dipetakan ke token Tailwind/CSS yang **sudah ada** di `apps/web/src/styles.css`, jadi bisa dipakai tanpa mendefinisikan ulang variabel.

---

## 0. Ringkasan gaya yang ditiru dari referensi

Ambil *style*-nya saja, bukan tata letaknya:

- Kanvas terang abu sangat muda, kartu putih bersih, dipisah **garis tipis 1px** (bukan shadow tebal).
- **Satu aksen hangat** (terracotta/oranye) untuk data penting & elemen aktif; sisanya netral.
- Bento/card membulat, KPI dengan badge tren + sparkline mini.
- Segmented control berbentuk kapsul (Quarter/Month/Week) dengan item aktif putih.
- Grafik garis halus dengan area gradient tipis; batang 3D "skyline" untuk kontribusi.
- **Dark tooltip** di atas kartu terang saat hover data.
- Sidebar terang: label seksi huruf kapital kecil, item aktif berupa pill, tile logo gelap.
- Angka selalu **tabular-nums** agar sejajar vertikal.

---

## 1. Token Warna (pakai token proyek)

Gunakan token yang sudah didefinisikan di `styles.css` (`@theme inline`). Jangan hard-code hex baru bila token tersedia.

### Permukaan (Surfaces)
| Peran | Token / Class | Nilai |
|---|---|---|
| App background | `bg-paper` | `#f6f7f9` |
| Card / panel | `bg-surface` / `bg-white` | `#ffffff` |
| Sidebar / secondary | `bg-ink-50` | `#f2f4fa` |
| Overlay modal | `bg-ink-900/45` + `backdrop-blur-xs` | — |
| Tooltip popover | `bg-ink-950` | `#0a0e24` |

### Teks
| Peran | Token / Class | Nilai |
|---|---|---|
| Primary (judul, angka utama) | `text-ink-900` | `#141b3d` |
| Secondary (label, subjudul) | `text-muted` | `#5b6272` |
| Muted / caption | `text-muted` / `text-ink-500` | `#5b6272` / `#4a5ba8` |
| Teks di atas gelap | `text-white` / `text-ink-100` | `#ffffff` / `#e6e9f5` |

### Garis & Pembatas
| Peran | Token / Class | Nilai |
|---|---|---|
| Border kartu/sidebar | `border-line` | `#dde1e8` |
| Divider / grid line grafik | `border-line/60` atau `#eef0f4` | tipis |

### Aksen & Data
| Peran | Nilai | Catatan |
|---|---|---|
| **Aksen data / highlight (dari referensi)** | `#E04F33` (terracotta) | batang aktif, garis tren utama, fokus |
| Tint aksen lembut | `#FDECE8` | latar badge/sorotan ringan |
| Aksen brand proyek (tetap dipakai untuk CTA/branding) | `--color-ume` `#b83a6a` | jangan dihapus; gunakan untuk tombol brand & identitas |
| Bar pembanding / historis | `#d1d5db` / `#e5e7eb` | netral |

> Aturan: **data-viz & state aktif** memakai terracotta `#E04F33` agar sama dengan referensi; **branding/CTA utama** tetap memakai `ume`. Jangan mencampur keduanya dalam satu grafik.

### Status (sudah tersedia sebagai token)
| Status | Fg | Bg |
|---|---|---|
| ok / positif | `text-ok-fg` `#14653a` | `bg-ok-bg` `#e3f4ea` |
| warn / perhatian | `text-warn-fg` `#7a5200` | `bg-warn-bg` `#fff3cc` |
| crit / negatif | `text-crit-fg` `#9b1c1c` | `bg-crit-bg` `#fde7e7` |
| stale / netral | `text-stale-fg` `#4a5163` | `bg-stale-bg` `#edeff3` |

---

## 2. Tipografi

Font mengikuti proyek (bukan Inter), agar konsisten dengan identitas Daisuki:

- **Display / judul & angka besar:** `font-display` → Google Sans, fallback *Bricolage Grotesque*.
- **Body / tabel / form:** `font-sans` → Google Sans, fallback *Figtree*.
- Angka: wajib `tabular-nums` (utility `.num` atau `tabular-nums`).

### Skala
| Peran | Ukuran | Weight | Tracking |
|---|---|---|---|
| Page title | 24px (`text-2xl`) | 600 | `-0.02em` (`tracking-tight`) |
| Hero metric / KPI | 28–32px (`text-3xl`/`text-4xl`) | 700 | `-0.03em` |
| Card title | 14px | 600 | normal |
| Body / tabel | 13–14px | 400–500 | normal |
| Micro label / caption | 11–12px | 500 | `text-muted` |
| Label seksi sidebar | 11px | 600 | `uppercase tracking-wider text-muted` |

---

## 3. Bentuk & Elevasi

- **Radius:** window/drawer `16px` (`rounded-2xl`), kartu bento `12px` (`rounded-xl`), tombol/input `8px` (`rounded-md`), pill filter `rounded-full`, sudut atas batang grafik `4px`.
- **Border:** `1px solid var(--color-line)` pada setiap kartu & pembatas.
- **Shadow:**
  - Kartu default: hampir datar → `shadow-xs` (`0 1px 2px rgb(0 0 0 / 0.03)`).
  - Floating/popover: `shadow-float` (`0 8px 24px rgb(20 27 61 / 0.14)`).
- **Prinsip:** andalkan border tipis, bukan shadow berat.

---

## 4. Gaya Komponen

### A. Kartu KPI (Bento)
Struktur: label kecil kiri atas → badge tren kanan atas → angka besar (tabular-nums) → caption pcs/konteks → sparkline kanan bawah.
- Padding `16–20px` (`p-4`/`p-5`).
- Badge tren: `text-[11px] font-semibold` + `bg-ok-bg text-ok-fg` (naik) / `bg-crit-bg text-crit-fg` (turun).
- Sparkline: garis 2px aksen terracotta, `preserveAspectRatio="none"`, tinggi ~28–32px.

### B. Segmented Control / Filter
- Kontainer: `bg-ink-50` (setara `#f3f4f6`), padding `3px`, `rounded-lg`/`rounded-full`.
- Item aktif: `bg-white text-ink-900 shadow-xs`, teks `font-semibold`.
- Item non-aktif: `text-muted`, hover `text-ink-900`.
- Target sentuh mobile minimal `44px` (`min-h-11`).

### C. Sidebar Navigasi
- Latar `bg-ink-50`/`bg-surface`, border kanan `border-line`.
- Tile logo: kotak gelap `bg-ink-900 text-white rounded-md`.
- Label seksi: `uppercase tracking-wider text-[11px] text-muted`.
- Item aktif: pill `bg-white text-ink-900 shadow-xs` (atau `bg-ink-900 text-white` untuk kontras tinggi); ikon `stroke-[1.5]` size 16px.

### D. Line Chart (Area)
- Garis halus monotone 2px terracotta `#E04F33`.
- Area di bawah garis: gradient `rgba(224,79,51,0.12)` → `rgba(224,79,51,0)`.
- Grid line horizontal tipis `#eef0f4`. Titik data hanya muncul saat hover.

### E. Bar Chart — 3D "Skyline" (aksen isometrik)
- Batang kontribusi dengan ilusi kedalaman: sisi atas lebih terang.
- Gradient vertikal krem→oranye: `#F5D0C5` → `#D9482B` (atau aksen terracotta untuk batang aktif).
- Batang pembanding/histori `#e5e7eb`.
- Label grup ringkas di bawah; angka total di header panel.

### F. Dark Tooltip
- Latar `bg-ink-950` (`#0a0e24`), teks putih, sub-teks `text-ink-100`.
- Radius `rounded-lg`, `shadow-float`, padding `px-3 py-2`, angka `tabular-nums`.
- Muncul instan saat hover/fokus, tanpa animasi berat.

### G. Heatmap Dots
- Matriks titik kecil (`10–12px`) `rounded-[3px]`.
- Skala intensitas: `#eef0f4` (kosong) → `#fbe3dc` → `#f3b8aa` → `#E04F33` (padat).

### H. Tabel Data
- Header `text-[11px] uppercase tracking-wide text-muted`, baris `border-t border-line`.
- Nama + avatar/inisial bulat kecil; kolom angka `tabular-nums` rata kanan.
- Bar inline tipis (lebar proporsional) sebagai indikator cepat.

### I. Badge & Pill
- Status stok/pesanan: pakai token `ok/warn/crit/stale` dan `order-*`.
- Radius `rounded-full`, padding `px-2 py-0.5`, `text-[11px] font-semibold`.

---

## 5. Ikonografi
- Gaya **outline/stroke** konsisten (Lucide).
- Stroke width `1.5`–`1.75`. Ukuran `16px` (nav/tombol), `14px` (di dalam kartu).
- Warna ikon mengikuti teks di sekitarnya (`currentColor`).

---

## 6. Do & Don't

**Do**
- Pakai token (`bg-paper`, `bg-surface`, `border-line`, `text-ink-900`, `text-muted`, `--color-ume`, status tokens).
- Satu aksen hangat per layar; sisanya netral.
- `tabular-nums` pada semua angka metrik/tabel.
- Border 1px + shadow tipis; radius konsisten (xl untuk kartu, md untuk kontrol).

**Don't**
- Shadow tebal/glow, gradient ungu-biru generik, atau emoji dekoratif.
- Campur terracotta dan `ume` dalam satu grafik.
- Hard-code hex baru bila token tersedia.
- Ubah struktur/grid layout saat menerapkan style ini.

---

## 7. Pemetaan cepat kelas Tailwind
- Canvas: `bg-paper text-ink-900`
- Kartu: `rounded-xl border border-line bg-surface p-4 sm:p-5 shadow-xs`
- Judul kartu: `font-display text-sm font-semibold text-ink-900`
- Caption: `text-xs text-muted`
- Angka besar: `num font-display text-3xl font-bold tabular-nums text-ink-900`
- Segmented: `rounded-lg border border-line bg-ink-50 p-1` + item aktif `bg-white shadow-xs`
- Badge positif: `rounded-full bg-ok-bg px-2 py-0.5 text-[11px] font-semibold text-ok-fg`
- Tooltip: `rounded-lg bg-ink-950 px-3 py-2 text-white shadow-float`
