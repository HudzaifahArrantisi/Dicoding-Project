import { useEffect, useRef, useState } from 'react'
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  Minus,
  PackageCheck,
  PackagePlus,
  Plus,
  RotateCcw,
  ScanLine,
  Sparkles,
} from 'lucide-react'
import './onboarding-walkthrough.css'

const steps = [
  {
    label: 'Selamat datang',
    title: '',
    description: '',
  },
  {
    label: 'Catat stok',
    title: 'Catat sisa stok rak, tanpa ribet.',
    description:
      'Hitung yang tersisa di rak toko, lalu input lewat ponsel saat tutup toko. Laporan fisik langsung tersimpan rapi dan dipantau oleh admin pusat.',
  },
  {
    label: 'Cek & pesan',
    title: 'Cek stok pusat, pesan multi-item.',
    description:
      'Lihat ketersediaan ready stock gudang pusat secara transparan. Ajukan pesanan untuk beberapa snack sekaligus dalam satu nomor PO resmi.',
  },
  {
    label: 'Kirim armada',
    title: 'Admin verifikasi, kurir meluncur.',
    description:
      'Admin pusat menyetujui kuantitas pesanan Anda. Armada truk Daisuki Express langsung mengantarkan pasokan aman ke cabang Anda.',
  },
  {
    label: 'Pindai kardus',
    title: 'Pindai kiriman saat kurir tiba.',
    description:
      'Arahkan kamera ponsel ke barcode kardus pengiriman kurir. Laser membaca nomor PO surat jalan seketika tanpa perlu ketik manual.',
  },
  {
    label: 'Stok bertambah',
    title: 'Terima kiriman admin, stok otomatis bertambah.',
    description:
      'Begitu kiriman fisik dari admin diterima dan dikonfirmasi, sisa stok di rak cabang Anda langsung bertambah otomatis dan siap dijual.',
  },
]

/* =========================================================================
   STEP 0: CLEAN EDITORIAL WELCOME SCREEN (LARGE TYPOGRAPHY, NO IMAGES)
   ========================================================================= */
function WelcomeVisual() {
  return (
    <div className="intro-welcome-hero">


      <h1 className="intro-welcome-title font-display">
        Selamat Datang di
        <span className="intro-welcome-brand">Daisuki Inventory</span>
      </h1>

      <p className="intro-welcome-lead">
        Platform terpadu untuk mitra cabang, hotel, resto, dan minimarket. Pantau sisa stok rak fisik, ajukan pasokan pabrik pusat, dan terima kiriman barang dalam satu alur cepat.
      </p>
    </div>
  )
}

/* =========================================================================
   STEP 1: RETAIL SHELF DISPLAY & BASRENG POUCH
   ========================================================================= */
function ShelfVisual() {
  const [quantity, setQuantity] = useState(35)

  return (
    <div className="intro-artifact">
      <svg
        className="intro-drawing"
        viewBox="0 0 380 200"
        role="img"
        aria-label="Rak display produk Basreng Daun Jeruk Daisuki"
      >
        <defs>
          <linearGradient id="pouch-red" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C42828" />
            <stop offset="60%" stopColor="#8E1414" />
            <stop offset="100%" stopColor="#5E0808" />
          </linearGradient>
          <linearGradient id="pouch-foil" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D4A373" />
            <stop offset="50%" stopColor="#FAEDCD" />
            <stop offset="100%" stopColor="#CCD5AE" />
          </linearGradient>
          <linearGradient id="shelf-wood" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#D4C5B0" />
            <stop offset="100%" stopColor="#A89680" />
          </linearGradient>
          <radialGradient id="shadow-floor" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1E2337" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#1E2337" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Floor Shadow */}
        <ellipse cx="190" cy="180" rx="145" ry="10" fill="url(#shadow-floor)" />

        {/* Wooden Shelf Display */}
        <rect x="42" y="160" width="296" height="12" rx="3" fill="url(#shelf-wood)" />
        <rect x="42" y="172" width="296" height="4" fill="#8C7A65" />
        <rect x="68" y="176" width="10" height="15" rx="2" fill="#8C7A65" />
        <rect x="302" y="176" width="10" height="15" rx="2" fill="#8C7A65" />

        {/* Background Pouch Left (Seblak Jadul) */}
        <g transform="translate(68, 52) rotate(-8 35 60)">
          <path d="M6 14 C15 6, 55 6, 64 14 L60 114 C52 118, 18 118, 10 114 Z" fill="#D97706" opacity="0.85" />
          <rect x="4" y="10" width="62" height="6" rx="2" fill="#B45309" />
          <rect x="16" y="42" width="38" height="28" rx="3" fill="#FFFFFF" opacity="0.9" />
          <text x="35" y="55" textAnchor="middle" fill="#78350F" fontSize="6.5" fontWeight="bold">DAISUKI</text>
          <text x="35" y="64" textAnchor="middle" fill="#92400E" fontSize="5.5">Seblak</text>
        </g>

        {/* Background Pouch Right (Keripik Pisang) */}
        <g transform="translate(242, 58) rotate(7 35 60)">
          <path d="M6 14 C15 6, 55 6, 64 14 L60 108 C52 112, 18 112, 10 108 Z" fill="#78350F" opacity="0.85" />
          <rect x="4" y="10" width="62" height="6" rx="2" fill="#582407" />
          <rect x="16" y="38" width="38" height="26" rx="3" fill="#FFFFFF" opacity="0.9" />
          <text x="35" y="50" textAnchor="middle" fill="#78350F" fontSize="6.5" fontWeight="bold">DAISUKI</text>
          <text x="35" y="58" textAnchor="middle" fill="#582407" fontSize="5.5">Pisang</text>
        </g>

        {/* Hero Front Stand-up Pouch: Basreng Daun Jeruk (200g) */}
        <g transform="translate(136, 24)">
          <path d="M8 20 C22 10, 86 10, 100 20 L94 142 C82 148, 26 148, 14 142 Z" fill="#1E2337" opacity="0.12" transform="translate(4, 5)" />
          <path d="M8 20 C22 10, 86 10, 100 20 L94 142 C82 148, 26 148, 14 142 Z" fill="url(#pouch-red)" />

          <path d="M6 16 C22 8, 86 8, 102 16 L100 26 C86 20, 22 20, 8 26 Z" fill="url(#pouch-foil)" />
          <line x1="8" y1="21" x2="100" y2="21" stroke="#9A7B56" strokeWidth="0.8" strokeDasharray="2 1.5" />
          <polygon points="6,21 10,19 10,23" fill="#6B1D1D" />
          <polygon points="102,21 98,19 98,23" fill="#6B1D1D" />

          {/* Golden Badge Logo Container */}
          <rect x="18" y="38" width="72" height="68" rx="8" fill="#FFFFFF" />
          <rect x="20" y="40" width="68" height="64" rx="6" fill="#FFFBEB" stroke="#FDE68A" strokeWidth="0.8" />

          <text x="54" y="54" textAnchor="middle" fill="#8E1414" fontSize="9" fontWeight="900" letterSpacing="0.8">
            DAISUKI
          </text>
          <line x1="28" y1="58" x2="80" y2="58" stroke="#F59E0B" strokeWidth="1" />

          <text x="54" y="70" textAnchor="middle" fill="#1E2337" fontSize="11" fontWeight="800">
            BASRENG
          </text>
          <text x="54" y="79" textAnchor="middle" fill="#B45309" fontSize="6.5" fontWeight="bold">
            PEDAS DAUN JERUK
          </text>
        </g>
      </svg>
      {/* Interactive Stepper (Simulasi input stok toko oleh mitra) */}
      <div className="intro-quantity">
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(0, q - 1))}
          className="intro-round"
          aria-label="Kurangi 1 pcs"
          disabled={quantity <= 0}
        >
          <Minus size={16} />
        </button>

        <div className="intro-number">
          <strong>{quantity}</strong>
        </div>

        <button
          type="button"
          onClick={() => setQuantity((q) => q + 1)}
          className="intro-round"
          aria-label="Tambah 1 pcs"
        >
          <Plus size={16} />
        </button>
      </div>
      <p className="intro-confirm" aria-live="polite">
        {quantity < 35 ? 'Sisa fisik berkurang · Terhubung langsung ke data admin' : 'Sisa stok rak terinput rapi'}
      </p>
    </div>
  )
}

/* =========================================================================
   STEP 2: CENTRAL STOCK CATALOG & MULTI-ITEM PO ORDER
   ========================================================================= */
function CatalogOrderVisual() {
  const [ordered, setOrdered] = useState(false)

  return (
    <div className="intro-artifact">
      <svg
        className="intro-drawing"
        viewBox="0 0 380 200"
        role="img"
        aria-label="Tampilan Pemesanan Restock Cabang Daisuki"
      >
        <defs>
          <linearGradient id="pouch-mini-red-cat" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C42828" />
            <stop offset="100%" stopColor="#8E1414" />
          </linearGradient>
          <linearGradient id="pouch-mini-amber-cat" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id="tab-top-bar" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F8FAFC" />
          </linearGradient>
        </defs>

        {/* Ambient Drop Shadow */}
        <ellipse cx="190" cy="186" rx="150" ry="8" fill="#1E2337" opacity="0.1" />

        {/* App Frame */}
        <rect x="30" y="14" width="320" height="168" rx="12" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />

        {/* Top Header Bar */}
        <rect x="30" y="14" width="320" height="34" rx="12" fill="url(#tab-top-bar)" />
        <rect x="30" y="32" width="320" height="16" fill="url(#tab-top-bar)" />
        <line x1="30" y1="48" x2="350" y2="48" stroke="#EEF2F6" strokeWidth="1" />

        <text x="46" y="35" fill="#1E2337" fontSize="10.5" fontWeight="800">
          Pemesanan Restock Cabang
        </text>

        {/* Item 1: Basreng Daun Jeruk (200g) */}
        <g transform="translate(44, 56)">
          <rect
            x="0"
            y="0"
            width="292"
            height="38"
            rx="8"
            fill={ordered ? '#F0FDF4' : '#FFFFFF'}
            stroke={ordered ? '#86EFAC' : '#E2E8F0'}
            strokeWidth="0.8"
          />
          {/* Mini Pouch Visual */}
          <g transform="translate(8, 5)">
            <rect x="0" y="0" width="20" height="28" rx="3" fill="url(#pouch-mini-red-cat)" />
            <rect x="3" y="8" width="14" height="10" rx="1" fill="#FFFBEB" />
            <text x="10" y="15" textAnchor="middle" fill="#8E1414" fontSize="4.5" fontWeight="bold">BR</text>
          </g>

          <text x="36" y="17" fill="#1E2337" fontSize="8.5" fontWeight="700">
            Basreng Pedas Daun Jeruk
          </text>
          <text x="36" y="27" fill="#64748B" fontSize="7">
            DSK-BR-001 · Rp10.000 / pcs
          </text>

          {/* Central Ready Pill */}
          <g transform="translate(162, 10)">
            <rect x="0" y="0" width="60" height="18" rx="9" fill="#F1F5F9" />
            <text x="30" y="12" textAnchor="middle" fill="#475569" fontSize="6.5" fontWeight="600">
              Ready 850
            </text>
          </g>

          {/* Add Order Button */}
          <g transform="translate(230, 8)">
            <rect x="0" y="0" width="54" height="22" rx="6" fill={ordered ? '#059669' : '#1E2337'} />
            <text x="27" y="14.5" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="700">
              {ordered ? '✓ 25 pcs' : '+ 25 pcs'}
            </text>
          </g>
        </g>

        {/* Item 2: Seblak Jadul Instan */}
        <g transform="translate(44, 100)">
          <rect
            x="0"
            y="0"
            width="292"
            height="38"
            rx="8"
            fill={ordered ? '#F0FDF4' : '#FFFFFF'}
            stroke={ordered ? '#86EFAC' : '#E2E8F0'}
            strokeWidth="0.8"
          />
          {/* Mini Pouch Visual */}
          <g transform="translate(8, 5)">
            <rect x="0" y="0" width="20" height="28" rx="3" fill="url(#pouch-mini-amber-cat)" />
            <rect x="3" y="8" width="14" height="10" rx="1" fill="#FFFBEB" />
            <text x="10" y="15" textAnchor="middle" fill="#B45309" fontSize="4.5" fontWeight="bold">SB</text>
          </g>

          <text x="36" y="17" fill="#1E2337" fontSize="8.5" fontWeight="700">
            Seblak Jadul Instan
          </text>
          <text x="36" y="27" fill="#64748B" fontSize="7">
            DSK-SB-002 · Rp12.000 / pcs
          </text>

          {/* Central Ready Pill */}
          <g transform="translate(162, 10)">
            <rect x="0" y="0" width="60" height="18" rx="9" fill="#F1F5F9" />
            <text x="30" y="12" textAnchor="middle" fill="#475569" fontSize="6.5" fontWeight="600">
              Ready 1.200
            </text>
          </g>

          {/* Add Order Button */}
          <g transform="translate(230, 8)">
            <rect x="0" y="0" width="54" height="22" rx="6" fill={ordered ? '#059669' : '#1E2337'} />
            <text x="27" y="14.5" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="700">
              {ordered ? '✓ 25 pcs' : '+ 25 pcs'}
            </text>
          </g>
        </g>

        {/* Bottom Total Ribbon */}
        <g transform="translate(44, 144)">
          <rect x="0" y="0" width="292" height="26" rx="6" fill={ordered ? '#ECFDF5' : '#F8FAFC'} />
          <text x="12" y="16.5" fill="#64748B" fontSize="7">
            Total Multi-Item:
          </text>
          <text x="78" y="16.5" fill="#1E2337" fontSize="7.5" fontWeight="bold">
            2 Jenis Snack (50 pcs)
          </text>

          <g transform="translate(196, 4)">
            <rect x="0" y="0" width="88" height="18" rx="4" fill={ordered ? '#10B981' : '#E2E8F0'} />
            <text x="44" y="12" textAnchor="middle" fill={ordered ? '#FFFFFF' : '#475569'} fontSize="6.5" fontWeight="bold">
              {ordered ? 'PO-2611 RESMI' : 'DRAFT PO'}
            </text>
          </g>
        </g>
      </svg>


      {/* Action Simulation Button */}
      <div className="intro-action-container">
        <button
          type="button"
          onClick={() => setOrdered(true)}
          disabled={ordered}
          className={`intro-example-action ${ordered ? 'intro-example-success' : ''}`}
        >
          {ordered ? <Check size={14} /> : <PackagePlus size={14} />}
          {ordered ? 'Pesanan Terkirim' : 'Ajukan Pesanan'}
        </button>

        {ordered && (
          <button
            type="button"
            onClick={() => setOrdered(false)}
            className="intro-reset-btn"
            aria-label="Ulangi simulasi pesanan"
            title="Ulangi simulasi pesanan"
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      <p className="intro-confirm" aria-live="polite">
        {ordered
          ? 'Notifikasi instan terkirim'
          : 'Pesan sesuai kapasitas tanpa batasan kaku'}
      </p>
    </div>
  )
}

/* =========================================================================
   STEP 3: TRUCK LOGISTICS TRANSIT
   ========================================================================= */
function SupplyVisual() {
  const [requested, setRequested] = useState(false)

  return (
    <div className="intro-artifact">
      <svg
        className="intro-drawing"
        viewBox="0 0 520 200"
        role="img"
        aria-label="Perjalanan truk logistik pengiriman dari gudang pusat Daisuki ke toko cabang"
      >
        <defs>
          <linearGradient id="headlight-glow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#FEF08A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="road-surface" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1E2337" />
          </linearGradient>
          <linearGradient id="warehouse-roof" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2E3A4B" />
            <stop offset="100%" stopColor="#1E2337" />
          </linearGradient>
          <radialGradient id="shadow-soft" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1E2337" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#1E2337" stopOpacity="0" />
          </radialGradient>
          {/* 3D Isometric / Gradients for Truck */}
          <linearGradient id="truck-box-top" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#D93847" />
            <stop offset="100%" stopColor="#B91C1C" />
          </linearGradient>
          <linearGradient id="truck-box-side" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#991B1B" />
            <stop offset="100%" stopColor="#6E0D13" />
          </linearGradient>
          <linearGradient id="truck-cab-top" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>
          <linearGradient id="truck-cab-side" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="100%" stopColor="#CBD5E1" />
          </linearGradient>
          <linearGradient id="truck-windshield" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <linearGradient id="wheel-rim-3d" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#64748B" />
          </linearGradient>
        </defs>

        {/* Ambient Floor Shadow */}
        <ellipse cx="260" cy="182" rx="245" ry="11" fill="url(#shadow-soft)" />

        {/* Asphalt Highway with Extra Span */}
        <rect x="15" y="160" width="490" height="22" rx="5" fill="url(#road-surface)" />
        <line x1="20" y1="171" x2="500" y2="171" stroke="#F8FAFC" strokeWidth="1.5" strokeDasharray="14 10" />
      
        {/* LEFT STATION: GUDANG PUSAT DAISUKI */}
        <g id="station-gudang" transform="translate(18, 62)">
          <rect x="0" y="24" width="76" height="74" rx="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
          <polygon points="38,0 76,24 0,24" fill="url(#warehouse-roof)" />
          <rect x="22" y="52" width="32" height="46" rx="2" fill="#E2E8F0" />
          <line x1="22" y1="62" x2="54" y2="62" stroke="#94A3B8" strokeWidth="1" />
          <line x1="22" y1="72" x2="54" y2="72" stroke="#94A3B8" strokeWidth="1" />
          <line x1="22" y1="82" x2="54" y2="82" stroke="#94A3B8" strokeWidth="1" />

          {/* Signboard */}
          <rect x="10" y="30" width="56" height="13" rx="3" fill="#A9000C" />
          <text x="38" y="39.5" textAnchor="middle" fill="#FFFFFF" fontSize="6.5" fontWeight="bold">
            GUDANG PUSAT
          </text>
        </g>

        {/* RIGHT STATION: TOKO MITRA CABANG */}
        <g id="station-cabang" transform="translate(425, 62)">
          <rect x="0" y="24" width="76" height="74" rx="4" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
          <rect x="0" y="20" width="76" height="8" rx="2" fill="#D97706" />
          <text x="38" y="26" textAnchor="middle" fill="#FFFFFF" fontSize="5.5" fontWeight="bold">
            MINIMARKET MITRA
          </text>

          <rect x="10" y="36" width="24" height="26" rx="2" fill="#E0F2FE" stroke="#7DD3FC" strokeWidth="0.8" />
          <rect x="42" y="36" width="24" height="62" rx="2" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="0.8" />
          <circle cx="48" cy="68" r="1.5" fill="#64748B" />

          <rect x="6" y="80" width="32" height="14" rx="3" fill="#DCFCE7" />
          <text x="22" y="89.5" textAnchor="middle" fill="#15803D" fontSize="6" fontWeight="bold">
            TUJUAN
          </text>
        </g>

        {/* TRUCK VEHICLE GROUP (3D PSEUDO-ISOMETRIC DETAIL) */}
        <g
          id="daisuki-truck"
          className={`intro-delivery-truck ${requested ? 'intro-truck-moving' : 'intro-truck-idle'}`}
        >
          {/* Headlight beam (visible when moving) */}
          {requested && (
            <polygon points="56,2 110,-6 110,22 56,12" fill="url(#headlight-glow)" opacity="0.9" />
          )}

          {/* Under-truck dynamic ground shadow */}
          <ellipse cx="-2" cy="19" rx="54" ry="4" fill="#0F172A" opacity="0.35" />

          {/* 3D Top Bevel - Cargo Roof */}
          <polygon points="-58,-39 12,-39 16,-34 -54,-34" fill="url(#truck-box-top)" />

          {/* 3D Cargo Box Side */}
          <rect x="-56" y="-34" width="70" height="44" rx="3" fill="url(#truck-box-side)" stroke="#5B080E" strokeWidth="0.5" />

          {/* 3D Box Ribs / Texture */}
          <line x1="-38" y1="-32" x2="-38" y2="8" stroke="#450A0A" strokeWidth="0.8" opacity="0.7" />
          <line x1="-20" y1="-32" x2="-20" y2="8" stroke="#450A0A" strokeWidth="0.8" opacity="0.7" />
          <line x1="-2" y1="-32" x2="-2" y2="8" stroke="#450A0A" strokeWidth="0.8" opacity="0.7" />

          {/* Daisuki Express Branding on Truck */}
          <g transform="translate(-50, -28)">
            <rect x="0" y="0" width="58" height="28" rx="2.5" fill="#450A0A" stroke="#7F1D1D" strokeWidth="0.8" />
            <text x="29" y="13.5" textAnchor="middle" fill="#FFFFFF" fontSize="7.5" fontWeight="900" letterSpacing="0.8">
              DAISUKI
            </text>
            <text x="29" y="22" textAnchor="middle" fill="#FCA5A5" fontSize="5.5" fontWeight="700">
              EXPRESS
            </text>
          </g>

          {/* 3D Cabin Top Bevel */}
          <polygon points="14,-29 36,-29 40,-25 18,-25" fill="url(#truck-cab-top)" />

          {/* 3D Truck Cabin Side */}
          <path d="M16 -25 L38 -25 L52 -9 L54 11 L16 11 Z" fill="url(#truck-cab-side)" stroke="#94A3B8" strokeWidth="0.8" />

          {/* 3D Windshield with Reflection Tint */}
          <polygon points="34,-22 48,-9 34,-9" fill="url(#truck-windshield)" stroke="#0369A1" strokeWidth="0.5" />
          <line x1="37" y1="-20" x2="44" y2="-10" stroke="#BAE6FD" strokeWidth="1.2" strokeLinecap="round" opacity="0.9" />

          {/* Cabin Side Door Line & Handle */}
          <line x1="26" y1="-8" x2="26" y2="10" stroke="#94A3B8" strokeWidth="0.8" />
          <rect x="22" y="0" width="3" height="1.5" rx="0.5" fill="#475569" />

          {/* Headlight Assembly (Lens 3D) */}
          <rect x="52" y="1" width="5" height="6" rx="1.5" fill="#F59E0B" stroke="#B45309" strokeWidth="0.5" />
          <rect x="49" y="7" width="8" height="4" rx="1" fill="#334155" />

          {/* Side Mirror */}
          <rect x="32" y="-14" width="2" height="4.5" rx="0.5" fill="#1E2337" />

          {/* Chassis Heavy-Duty Frame & Exhaust Tip */}
          <rect x="-52" y="9" width="102" height="4" fill="#0F172A" />
          <rect x="-55" y="10" width="4" height="2" fill="#64748B" />

          {/* Back Wheel 1 (3D Depth Rim) */}
          <g transform="translate(-38, 15)">
            <circle cx="0" cy="0" r="11" fill="#0F172A" />
            <circle cx="0" cy="0" r="9" fill="#1E2337" />
            <circle cx="0" cy="0" r="6" fill="url(#wheel-rim-3d)" />
            <circle cx="0" cy="0" r="2.5" fill="#0F172A" />
            <g className="intro-wheel-rotor">
              <line x1="-5" y1="0" x2="5" y2="0" stroke="#FFFFFF" strokeWidth="1.2" />
              <line x1="0" y1="-5" x2="0" y2="5" stroke="#FFFFFF" strokeWidth="1.2" />
            </g>
          </g>

          {/* Back Wheel 2 (3D Depth Rim) */}
          <g transform="translate(-16, 15)">
            <circle cx="0" cy="0" r="11" fill="#0F172A" />
            <circle cx="0" cy="0" r="9" fill="#1E2337" />
            <circle cx="0" cy="0" r="6" fill="url(#wheel-rim-3d)" />
            <circle cx="0" cy="0" r="2.5" fill="#0F172A" />
            <g className="intro-wheel-rotor">
              <line x1="-5" y1="0" x2="5" y2="0" stroke="#FFFFFF" strokeWidth="1.2" />
              <line x1="0" y1="-5" x2="0" y2="5" stroke="#FFFFFF" strokeWidth="1.2" />
            </g>
          </g>

          {/* Front Wheel (3D Depth Rim) */}
          <g transform="translate(38, 15)">
            <circle cx="0" cy="0" r="11" fill="#0F172A" />
            <circle cx="0" cy="0" r="9" fill="#1E2337" />
            <circle cx="0" cy="0" r="6" fill="url(#wheel-rim-3d)" />
            <circle cx="0" cy="0" r="2.5" fill="#0F172A" />
            <g className="intro-wheel-rotor">
              <line x1="-5" y1="0" x2="5" y2="0" stroke="#FFFFFF" strokeWidth="1.2" />
              <line x1="0" y1="-5" x2="0" y2="5" stroke="#FFFFFF" strokeWidth="1.2" />
            </g>
          </g>
        </g>
      </svg>

      {/* Action Simulation Button */}
      <div className="intro-action-container">
        <button
          type="button"
          onClick={() => setRequested(true)}
          disabled={requested}
          className={`intro-example-action ${requested ? 'intro-example-success' : ''}`}
        >
          {requested ? <Check size={14} /> : <Sparkles size={14} />}
          {requested ? 'Truk sedang dalam perjalanan' : 'Kirim paket'}
        </button>

        {requested && (
          <button
            type="button"
            onClick={() => setRequested(false)}
            className="intro-reset-btn"
            aria-label="Kembalikan truk ke gudang"
            title="Kembalikan truk ke gudang"
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      <p className="intro-confirm" aria-live="polite">
        {requested ? 'Dalam Perjalanan' : 'Klik tombol untuk melihat simulasi armada bergerak'}
      </p>
    </div>
  )
}

/* =========================================================================
   STEP 4: HANDHELD PHONE BARCODE SCANNER WITH CHAT NOTIFICATION
   ========================================================================= */
function ScannerVisual() {
  const [scanned, setScanned] = useState(false)

  return (
    <div className="intro-artifact">
      <svg
        className="intro-drawing"
        viewBox="0 0 380 200"
        role="img"
        aria-label="Kamera ponsel memindai barcode kardus pengiriman kurir"
      >
        <defs>
          <linearGradient id="carton-kraft-deep" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D4A373" />
            <stop offset="100%" stopColor="#B07D4C" />
          </linearGradient>
          <linearGradient id="phone-case" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id="laser-glow-red" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#EF4444" stopOpacity="1" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="skin-tone" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E2A684" />
            <stop offset="100%" stopColor="#C68B6A" />
          </linearGradient>
        </defs>

        <ellipse cx="200" cy="184" rx="140" ry="8" fill="#1E2337" opacity="0.12" />

        {/* RIGHT: SHIPPING CARTON FROM ADMIN */}
        <g id="kardus-daisuki" transform="translate(196, 36)">
          {/* Top Flap */}
          <polygon points="75,18 145,40 98,68 28,45" fill="#ECCBB0" stroke="#A6784A" strokeWidth="1" />
          {/* Front Face */}
          <polygon points="28,45 98,68 98,136 28,112" fill="url(#carton-kraft-deep)" stroke="#A6784A" strokeWidth="1" />
          {/* Side Face */}
          <polygon points="98,68 145,40 145,108 98,136" fill="#996D40" stroke="#7A5229" strokeWidth="1" />

          {/* Daisuki Brand on Carton */}
          <text x="44" y="94" fill="#5C3D1E" fontSize="9" fontWeight="bold" transform="skewY(16)">
            DAISUKI
          </text>

          {/* Barcode Sticker Label */}
          <g transform="translate(38, 58) skewY(16)">
            <rect x="0" y="0" width="56" height="36" rx="3" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="0.8" />
            <text x="5" y="8" fill="#64748B" fontSize="4.5" fontWeight="bold">
              SURAT JALAN #PO-2611
            </text>
            {Array.from({ length: 15 }, (_, i) => (
              <rect
                key={i}
                x={6 + i * 3}
                y="13"
                width={i % 3 === 0 ? 1.8 : 0.9}
                height="15"
                fill="#1E2337"
              />
            ))}
            <text x="5" y="32" fill="#059669" fontSize="4.5" fontWeight="bold">
              50 pcs Snack
            </text>
          </g>
        </g>

        {/* LEFT / CENTER: HAND HOLDING SMARTPHONE WITH CAMERA & CHAT NOTIF */}
        <g id="hand-and-phone" transform="translate(36, 12)">
          {/* Forearm & Palm holding the phone */}
          <g id="arm-and-fingers">
            {/* Forearm angled from bottom left */}
            <path
              d="M10 180 L42 135 L68 145 L32 185 Z"
              fill="url(#skin-tone)"
              stroke="#B8805F"
              strokeWidth="0.8"
            />
            {/* Palm & Thumb wrap on left bezel */}
            <path
              d="M34 116 C30 102, 38 90, 48 94 C56 97, 54 115, 46 126 Z"
              fill="url(#skin-tone)"
              stroke="#B8805F"
              strokeWidth="0.8"
            />
            {/* Fingers gripping right bezel from behind */}
            <g transform="translate(142, 64)">
              <rect x="0" y="0" width="16" height="12" rx="6" fill="url(#skin-tone)" stroke="#B8805F" strokeWidth="0.8" />
              <rect x="0" y="16" width="18" height="12" rx="6" fill="url(#skin-tone)" stroke="#B8805F" strokeWidth="0.8" />
              <rect x="0" y="32" width="18" height="12" rx="6" fill="url(#skin-tone)" stroke="#B8805F" strokeWidth="0.8" />
              <rect x="0" y="48" width="15" height="12" rx="6" fill="url(#skin-tone)" stroke="#B8805F" strokeWidth="0.8" />
            </g>
          </g>

          {/* Smartphone Hardware Frame */}
          <rect x="42" y="6" width="104" height="162" rx="18" fill="url(#phone-case)" stroke="#4A5568" strokeWidth="1.5" />
          <rect x="46" y="10" width="96" height="154" rx="14" fill="#0F172A" />

          {/* Speaker & Front Camera */}
          <rect x="84" y="13" width="20" height="2.5" rx="1.2" fill="#4A5568" />
          <circle cx="108" cy="14" r="1.5" fill="#4A5568" />

          {/* ==============================================================
              SCREEN CONTENT: CAMERA VIEW (WHEN NOT SCANNED)
             ============================================================== */}
          {!scanned && (
            <g id="screen-camera-view" transform="translate(50, 20)">
              {/* Camera Background */}
              <rect x="0" y="0" width="88" height="136" rx="10" fill="#1E293B" opacity="0.65" />

              {/* Viewfinder Target Brackets */}
              <path
                d="M10,28 L10,14 L24,14 M64,14 L78,14 L78,28 M78,74 L78,88 L64,88 M24,88 L10,88 L10,74"
                fill="none"
                stroke="#F8FAFC"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Barcode Graphic Inside Viewfinder */}
              <g transform="translate(18, 32)">
                <rect x="0" y="0" width="52" height="38" rx="3" fill="#FFFFFF" opacity="0.95" />
                <text x="26" y="9" textAnchor="middle" fill="#64748B" fontSize="4.5" fontWeight="bold">
                  PO-2611-0089
                </text>
                {Array.from({ length: 14 }, (_, i) => (
                  <rect
                    key={i}
                    x={6 + i * 3}
                    y="13"
                    width={i % 3 === 0 ? 1.8 : 1}
                    height="18"
                    fill="#0F172A"
                  />
                ))}
              </g>

              {/* Scanning Red Laser Sweep */}
              <line
                x1="8"
                y1="34"
                x2="80"
                y2="34"
                stroke="url(#laser-glow-red)"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="intro-laser-sweep"
              />

              {/* Guidance text */}
              <text x="44" y="112" textAnchor="middle" fill="#94A3B8" fontSize="5.5" fontWeight="600">
                Arahkan ke Barcode
              </text>
            </g>
          )}

          {/* ==============================================================
              SCREEN CONTENT: PESANAN SELESAI + CHAT NOTIFICATION ANIMATION
             ============================================================== */}
          {scanned && (
            <g id="screen-success-view" transform="translate(50, 20)">
              {/* Success Background */}
              <rect x="0" y="0" width="88" height="136" rx="10" fill="#F8FAFC" />

              {/* PUSH NOTIFICATION CHAT BANNER FROM ADMIN PUSAT (SLIDES IN) */}
              <g className="intro-chat-banner" transform="translate(4, 8)">
                <rect
                  x="0"
                  y="0"
                  width="80"
                  height="38"
                  rx="6"
                  fill="#FFFFFF"
                  stroke="#A7F3D0"
                  strokeWidth="0.8"
                />
                <circle cx="10" cy="11" r="4.5" fill="#10B981" />
                <path d="M8 11 L9.5 12.5 L12.5 9.5" fill="none" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
                <text x="18" y="10" fill="#065F46" fontSize="5" fontWeight="bold">
                  Admin Daisuki Pusat
                </text>
                <text x="18" y="14" fill="#94A3B8" fontSize="3.8">
                  Baru saja
                </text>

                <line x1="6" y1="18" x2="74" y2="18" stroke="#F1F5F9" strokeWidth="0.6" />

                <text x="6" y="26" fill="#1E2337" fontSize="4.8" fontWeight="bold">
                  PO-2611 Selesai!
                </text>
                <text x="6" y="32" fill="#059669" fontSize="4.2">
                  50 pcs siap masuk ke rak toko.
                </text>
              </g>

              {/* Verified Big Badge in Center */}
              <g transform="translate(44, 76)">
                <circle cx="0" cy="0" r="14" fill="#D1FAE5" />
                <circle cx="0" cy="0" r="10" fill="#10B981" />
                <path d="M-4 0 L-1 3 L4 -3" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <text x="0" y="24" textAnchor="middle" fill="#065F46" fontSize="6.5" fontWeight="bold">
                  Pesanan Selesai
                </text>
                <text x="0" y="32" textAnchor="middle" fill="#64748B" fontSize="4.5">
                  Fisik Sesuai Surat Jalan
                </text>
              </g>
            </g>
          )}
        </g>
      </svg>

      {/* Action Simulation Button */}
      <div className="intro-action-container">
        <button
          type="button"
          onClick={() => setScanned(true)}
          disabled={scanned}
          className={`intro-example-action ${scanned ? 'intro-example-success' : ''}`}
        >
          {scanned ? <Check size={14} /> : <ScanLine size={14} />}
          {scanned ? 'Barcode Terverifikasi: #PO-2611' : 'Simulasi: Pindai Barcode Kardus'}
        </button>

        {scanned && (
          <button
            type="button"
            onClick={() => setScanned(false)}
            className="intro-reset-btn"
            aria-label="Ulangi simulasi scan"
            title="Ulangi simulasi scan"
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      <p className="intro-confirm" aria-live="polite">
        {scanned ? 'Status: Kiriman Dikonfirmasi & Sesuai Surat Jalan' : 'Kamera membaca kode batang kardus otomatis'}
      </p>
    </div>
  )
}

/* =========================================================================
   STEP 5: STOCK HANDOVER & REALTIME INCREMENT
   ========================================================================= */
function StockHandoverVisual() {
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className="intro-artifact">
      <svg
        className="intro-drawing"
        viewBox="0 0 380 200"
        role="img"
        aria-label="Serah terima kiriman dari admin dan penambahan stok di rak toko cabang"
      >
        <defs>
          <linearGradient id="pouch-red-handover" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C42828" />
            <stop offset="100%" stopColor="#8E1414" />
          </linearGradient>
          <linearGradient id="pouch-amber-handover" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
        </defs>

        {/* Ambient Drop Shadow */}
        <ellipse cx="190" cy="180" rx="160" ry="8" fill="#1E2337" opacity="0.1" />

        {/* -------------------------------------------------------------
            LEFT: KARDUS KIRIMAN DARI ADMIN
           ------------------------------------------------------------- */}
        <g id="kardus-pengirim" transform="translate(24, 24)">
          <rect x="0" y="0" width="132" height="142" rx="12" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />

          {/* Admin Header Ribbon */}
          <rect x="14" y="14" width="104" height="20" rx="4" fill="#A9000C" />
          <text x="66" y="27" textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="bold">
            KARDUS KIRIMAN ADMIN
          </text>

          {/* 3D Box Illustration */}
          <g transform="translate(22, 48)">
            <polygon points="44,10 88,24 58,40 14,26" fill="#E2BA96" stroke="#946338" strokeWidth="0.8" />
            <polygon points="14,26 58,40 58,80 14,64" fill="#C69469" stroke="#946338" strokeWidth="0.8" />
            <polygon points="58,40 88,24 88,64 58,80" fill="#A87548" stroke="#946338" strokeWidth="0.8" />
            <text x="36" y="56" fill="#451A03" fontSize="6.5" fontWeight="bold" transform="skewY(14)">
              DAISUKI
            </text>
          </g>

          {/* Inside Snacks Peeking */}
          <g transform="translate(20, 36)">
            <rect x="20" y="2" width="18" height="18" rx="2" fill="url(#pouch-red-handover)" transform="rotate(-6 20 2)" />
            <rect x="42" y="0" width="18" height="20" rx="2" fill="url(#pouch-amber-handover)" transform="rotate(4 42 0)" />
            <rect x="64" y="3" width="18" height="18" rx="2" fill="url(#pouch-red-handover)" transform="rotate(10 64 3)" />
          </g>

          {/* Status Badge */}
          <g transform="translate(14, 116)">
            <rect x="0" y="0" width="104" height="20" rx="10" fill={confirmed ? '#ECFDF5' : '#FEF3C7'} />
            <circle cx="12" cy="10" r="3.5" fill={confirmed ? '#10B981' : '#F59E0B'} />
            <text x="20" y="13.5" fill={confirmed ? '#065F46' : '#92400E'} fontSize="6.5" fontWeight="bold">
              {confirmed ? '✓ Diterima Toko Cabang' : '50 pcs Tiba di Toko'}
            </text>
          </g>
        </g>

        {/* -------------------------------------------------------------
            CENTER: DYNAMIC ARROW / INFLOW CONVEYOR
           ------------------------------------------------------------- */}
        <g id="handover-flow" transform="translate(160, 78)">
          <line
            x1="0"
            y1="16"
            x2="32"
            y2="16"
            stroke={confirmed ? '#10B981' : '#CBD5E1'}
            strokeWidth="2.5"
            strokeDasharray="4 2"
            className={confirmed ? 'intro-flow-active' : ''}
          />
          <polygon
            points="30,11 40,16 30,21"
            fill={confirmed ? '#10B981' : '#94A3B8'}
          />
          <rect x="4" y="0" width="32" height="11" rx="5.5" fill={confirmed ? '#D1FAE5' : '#F1F5F9'} />
          <text x="20" y="8" textAnchor="middle" fill={confirmed ? '#047857' : '#64748B'} fontSize="5.5" fontWeight="bold">
            MASUK
          </text>
        </g>

        {/* Animated Flying Packet from Admin Box into Store Shelf */}
        {confirmed && (
          <g className="intro-flight-parcel">
            <rect x="0" y="0" width="16" height="24" rx="2.5" fill="url(#pouch-red-handover)" />
            <rect x="2" y="6" width="12" height="10" rx="1" fill="#FFFBEB" />
            <text x="8" y="13" textAnchor="middle" fill="#8E1414" fontSize="4" fontWeight="bold">DSK</text>
          </g>
        )}

        {/* -------------------------------------------------------------
            RIGHT: RAK TOKO MITRA CABANG (STOK BERTAMBAH REALTIME)
           ------------------------------------------------------------- */}
        <g id="rak-toko-mitra" transform="translate(206, 18)">
          <rect x="0" y="0" width="150" height="148" rx="12" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />

          {/* Header & Dynamic Counter */}
          <g transform="translate(14, 14)">
            <text x="0" y="8" fill="#64748B" fontSize="6.5" fontWeight="bold">
              RAK TOKO MITRA CABANG
            </text>

            <g transform="translate(0, 16)">
              <text
                x="0"
                y="20"
                fill="#1E2337"
                fontSize="24"
                fontWeight="800"
                fontFamily="var(--font-display)"
                className={confirmed ? 'intro-shelf-counter-pop' : ''}
              >
                {confirmed ? '58' : '8'}
              </text>
              <text x={confirmed ? '38' : '20'} y="20" fill="#64748B" fontSize="9.5">
                pcs
              </text>

              <g transform="translate(62, 4)">
                <rect
                  x="0"
                  y="0"
                  width="60"
                  height="18"
                  rx="9"
                  fill={confirmed ? '#D1FAE5' : '#FEE2E2'}
                />
                <circle cx="8" cy="9" r="3" fill={confirmed ? '#10B981' : '#EF4444'} />
                <text
                  x="15"
                  y="12.5"
                  fill={confirmed ? '#065F46' : '#991B1B'}
                  fontSize="6.5"
                  fontWeight="bold"
                >
                  {confirmed ? 'Aman (58 pcs)' : 'Kritis (8 pcs)'}
                </text>
              </g>
            </g>
          </g>

          {/* Wooden Shelf Display Area */}
          <g transform="translate(14, 66)">
            <rect x="0" y="0" width="122" height="46" rx="3" fill="#FAF7F2" />
            <rect x="0" y="44" width="122" height="5" rx="1.5" fill="#C4B5A0" />

            {!confirmed && (
              <g transform="translate(50, 12)">
                <rect x="0" y="0" width="20" height="32" rx="3" fill="url(#pouch-red-handover)" opacity="0.85" />
                <rect x="3" y="10" width="14" height="12" rx="1" fill="#FFFFFF" opacity="0.8" />
                <text x="10" y="18" textAnchor="middle" fill="#8E1414" fontSize="4.5" fontWeight="bold">8 pcs</text>
              </g>
            )}

            {confirmed && (
              <g className="intro-shelf-pouches">
                {/* Pouch 1: Basreng Pedas Daun Jeruk */}
                <g transform="translate(6, 6)">
                  <g className="intro-shelf-drop" style={{ animationDelay: '0ms' }}>
                    <rect x="0" y="0" width="22" height="36" rx="3" fill="url(#pouch-red-handover)" />
                    <rect x="3" y="10" width="16" height="14" rx="1.5" fill="#FFFBEB" />
                    <text x="11" y="19" textAnchor="middle" fill="#8E1414" fontSize="4.8" fontWeight="bold">Basreng</text>
                  </g>
                </g>
                {/* Pouch 2: Seblak Jadul */}
                <g transform="translate(32, 6)">
                  <g className="intro-shelf-drop" style={{ animationDelay: '90ms' }}>
                    <rect x="0" y="0" width="22" height="36" rx="3" fill="url(#pouch-amber-handover)" />
                    <rect x="3" y="10" width="16" height="14" rx="1.5" fill="#FFFBEB" />
                    <text x="11" y="19" textAnchor="middle" fill="#B45309" fontSize="4.8" fontWeight="bold">Seblak</text>
                  </g>
                </g>
                {/* Pouch 3: Basreng Pedas Daun Jeruk */}
                <g transform="translate(58, 6)">
                  <g className="intro-shelf-drop" style={{ animationDelay: '180ms' }}>
                    <rect x="0" y="0" width="22" height="36" rx="3" fill="url(#pouch-red-handover)" />
                    <rect x="3" y="10" width="16" height="14" rx="1.5" fill="#FFFBEB" />
                    <text x="11" y="19" textAnchor="middle" fill="#8E1414" fontSize="4.8" fontWeight="bold">Basreng</text>
                  </g>
                </g>
                {/* Pouch 4: Seblak Jadul */}
                <g transform="translate(84, 6)">
                  <g className="intro-shelf-drop" style={{ animationDelay: '270ms' }}>
                    <rect x="0" y="0" width="22" height="36" rx="3" fill="url(#pouch-amber-handover)" />
                    <rect x="3" y="10" width="16" height="14" rx="1.5" fill="#FFFBEB" />
                    <text x="11" y="19" textAnchor="middle" fill="#B45309" fontSize="4.8" fontWeight="bold">Seblak</text>
                  </g>
                </g>
              </g>
            )}
          </g>
        </g>
      </svg>

      {/* Action Simulation Button */}
      <div className="intro-action-container">
        <button
          type="button"
          onClick={() => setConfirmed(true)}
          disabled={confirmed}
          className={`intro-example-action ${confirmed ? 'intro-example-success' : ''}`}
        >
          {confirmed ? <CheckCircle2 size={14} /> : <PackageCheck size={14} />}
          {confirmed ? 'Stok Mitra Bertambah Jadi 58 pcs' : 'Terima Kiriman Admin & Tambah Stok (+50)'}
        </button>

        {confirmed && (
          <button
            type="button"
            onClick={() => setConfirmed(false)}
            className="intro-reset-btn"
            aria-label="Ulangi simulasi penerimaan"
            title="Ulangi simulasi penerimaan"
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      <p className="intro-confirm" aria-live="polite">
        {confirmed ? 'Selesai · Sisa stok fisik toko langsung bertambah resmi' : 'Klik tombol untuk menyimulasikan penerimaan stok dari admin'}
      </p>
    </div>
  )
}

const visuals = [WelcomeVisual, ShelfVisual, CatalogOrderVisual, SupplyVisual, ScannerVisual, StockHandoverVisual]

/* =========================================================================
   MAIN ONBOARDING COMPONENT
   ========================================================================= */
export function OnboardingWalkthrough({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState('next')
  const [fullscreen, setFullscreen] = useState(false)
  const [supported, setSupported] = useState(false)
  const [fullscreenPending, setFullscreenPending] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [notice, setNotice] = useState('')
  const touch = useRef<{ x: number; y: number } | null>(null)
  const fullscreenOwned = useRef(false)
  const currentStep = useRef(step)
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleFinish() {
    if (isExiting) return
    setIsExiting(true)
    exitTimeoutRef.current = setTimeout(() => {
      onFinish()
    }, 400)
  }

  const finishRef = useRef(handleFinish)
  currentStep.current = step
  finishRef.current = handleFinish

  function goTo(target: number) {
    if (isExiting) return
    const next = Math.max(0, Math.min(steps.length - 1, target))
    if (next === currentStep.current) return
    setDirection(next > currentStep.current ? 'next' : 'previous')
    currentStep.current = next
    setStep(next)
  }

  useEffect(() => {
    return () => {
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    let lastFullscreenExit = 0
    const sync = () => {
      if (!document.fullscreenElement) lastFullscreenExit = Date.now()
      setFullscreen(Boolean(document.fullscreenElement))
    }
    setSupported(Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen))
    setFullscreen(Boolean(document.fullscreenElement))
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.metaKey || event.ctrlKey) return
      if (event.key === 'Escape') {
        if (!document.fullscreenElement && Date.now() - lastFullscreenExit > 250) finishRef.current()
        return
      }
      if (event.target instanceof Element && event.target.closest('button, a, input, textarea, select, [contenteditable]'))
        return
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault()
        if (currentStep.current === steps.length - 1) finishRef.current()
        else goTo(currentStep.current + 1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goTo(currentStep.current - 1)
      }
    }
    window.addEventListener('keydown', keydown)
    document.addEventListener('fullscreenchange', sync)
    return () => {
      window.removeEventListener('keydown', keydown)
      document.removeEventListener('fullscreenchange', sync)
    }
  }, [])

  async function toggleFullscreen() {
    if (fullscreenPending || !supported) return
    setFullscreenPending(true)
    setNotice('')
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        fullscreenOwned.current = true
      } else {
        await document.exitFullscreen()
        fullscreenOwned.current = false
      }
    } catch {
      setNotice('Layar penuh tidak dapat diaktifkan')
    } finally {
      setFullscreenPending(false)
    }
  }

  return (
    <main
      className={`intro-canvas ${isExiting ? 'intro-canvas-exiting' : ''}`}
      data-direction={direction}
      aria-label="Panduan Onboarding Daisuki Inventory"
    >
      {/* Top Header Bar */}
      <header className="intro-header">
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          disabled={!supported || fullscreenPending}
          className="intro-icon-button"
          aria-label={fullscreen ? 'Keluar layar penuh' : 'Masuk layar penuh'}
          title={fullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
        >
          {fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
        </button>

        {/* Top Progress Segment Indicator */}
        <div className="intro-progress" role="tablist" aria-label="Langkah panduan">
          {steps.map((item, index) => (
            <button
              type="button"
              key={item.label}
              onClick={() => goTo(index)}
              aria-label={`Buka langkah ${index + 1}: ${item.label}`}
              aria-current={step === index ? 'step' : undefined}
            >
              <span />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleFinish}
          className="intro-skip"
          aria-label="Lewati panduan dan langsung masuk ke login"
        >
          Lewati
        </button>
      </header>

      {notice && (
        <p className="intro-notice" role="status">
          {notice}
        </p>
      )}

      {/* Main Story Content: Seamless Organic Canvas */}
      <div
        className="intro-story"
        onTouchStart={(event) => {
          touch.current = null
          if ((event.target as Element).closest('button') || event.touches.length !== 1) return
          const p = event.touches[0]
          touch.current = { x: p.clientX, y: p.clientY }
        }}
        onTouchEnd={(event) => {
          const start = touch.current
          touch.current = null
          if (!start) return
          const end = event.changedTouches[0]
          const dx = end.clientX - start.x
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(end.clientY - start.y) * 1.5) {
            goTo(step + (dx < 0 ? 1 : -1))
          }
        }}
        onTouchCancel={() => {
          touch.current = null
        }}
      >
        {/* Dynamic Visual Stage */}
        <section className="intro-visual-zone" aria-label="Simulasi interaktif, data contoh">
          <div className="intro-visual-stack">
            {visuals.map((Visual, index) => (
              <div
                className="intro-slide"
                data-active={step === index}
                key={index}
                inert={step !== index}
                aria-hidden={step !== index}
              >
                <Visual />
              </div>
            ))}
          </div>
        </section>

        {/* Editorial Text & Compact Icon Controls (< and >) */}
        <section className="intro-editorial" aria-label="Panduan Daisuki Inventory">
          <div className="intro-copy-stack">
            {steps.map((item, index) => (
              <div
                className="intro-slide intro-copy"
                data-active={step === index}
                key={item.label}
                aria-hidden={step !== index}
              >
                {item.title ? <h1 className="font-display">{item.title}</h1> : null}
                {item.description ? <p>{item.description}</p> : null}
              </div>
            ))}
          </div>

          <span className="sr-only" role="status">
            Langkah {step + 1} dari {steps.length}. {steps[step].title || 'Selamat Datang di Daisuki Inventory'}
          </span>

          {/* Icon-Only Navigation Buttons < and > */}
          <div className="intro-actions">
            <button
              type="button"
              className="intro-nav-btn intro-nav-prev"
              onClick={() => goTo(step - 1)}
              disabled={step === 0 || isExiting}
              aria-label="Langkah sebelumnya"
              title="Kembali"
            >
              <ChevronLeft size={22} strokeWidth={2.4} />
            </button>

            <span className="intro-step-pill">
              {step + 1} / {steps.length}
            </span>

            <button
              type="button"
              className={`intro-nav-btn intro-nav-next ${step === steps.length - 1 ? 'intro-nav-final' : ''}`}
              onClick={() => (step === steps.length - 1 ? handleFinish() : goTo(step + 1))}
              disabled={isExiting}
              aria-label={step === steps.length - 1 ? 'Masuk ke Akun Daisuki' : 'Langkah selanjutnya'}
              title={step === steps.length - 1 ? 'Masuk ke Akun Daisuki' : 'Lanjutkan'}
            >
              <ChevronRight size={22} strokeWidth={2.4} />
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
