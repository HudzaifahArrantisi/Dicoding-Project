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
} from 'lucide-react'
import './onboarding-walkthrough.css'

const steps = [
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
          <text x="54" y="80" textAnchor="middle" fill="#047857" fontSize="7" fontWeight="bold">
            PEDAS DAUN JERUK
          </text>

          <g transform="translate(54, 91)">
            <path d="M-8 0 C-4 -6, 4 -6, 8 0 C4 6, -4 6, -8 0 Z" fill="#059669" />
            <line x1="-7" y1="0" x2="7" y2="0" stroke="#A7F3D0" strokeWidth="0.6" />
            <circle cx="-12" cy="2" r="1.5" fill="#DC2626" />
            <circle cx="12" cy="-2" r="1.5" fill="#DC2626" />
          </g>

          <rect x="36" y="116" width="36" height="12" rx="6" fill="#FFFFFF" opacity="0.9" />
          <text x="54" y="124.5" textAnchor="middle" fill="#8E1414" fontSize="6.5" fontWeight="bold">
            Netto 200g
          </text>
        </g>
      </svg>

      {/* Stepper Quantity Action */}
      <div className="intro-quantity">
        <button
          type="button"
          className="intro-round"
          aria-label="Kurangi contoh stok"
          onClick={() => setQuantity((q) => Math.max(0, q - 1))}
          disabled={quantity === 0}
        >
          <Minus size={16} />
        </button>

        <span className="intro-number" aria-live="polite" aria-atomic="true">
          <strong key={quantity}>{quantity}</strong>
          <span>pcs</span>
        </span>

        <button
          type="button"
          className="intro-round"
          aria-label="Tambah contoh stok"
          onClick={() => setQuantity((q) => q + 1)}
        >
          <Plus size={16} />
        </button>
      </div>

      <p className="intro-confirm">
        <Check size={13} /> Tersimpan otomatis ke sistem pusat
      </p>
    </div>
  )
}

/* =========================================================================
   STEP 2: REALISTIC B2B CATALOG & MULTI-ITEM RESTOCK
   ========================================================================= */
function CatalogOrderVisual() {
  const [ordered, setOrdered] = useState(false)

  return (
    <div className="intro-artifact">
      <svg
        className="intro-drawing"
        viewBox="0 0 380 200"
        role="img"
        aria-label="Katalog B2B Daisuki: pemesanan restock multi-item dan stok gudang pusat"
      >
        <defs>
          <linearGradient id="pouch-mini-red-cat" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#991B1B" />
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

        {/* Central Warehouse Ready Indicator with Pulse */}
        <g transform="translate(244, 23)">
          <rect x="0" y="0" width="94" height="20" rx="10" fill="#ECFDF5" stroke="#A7F3D0" strokeWidth="0.8" />
          <circle cx="10" cy="10" r="3.5" fill="#10B981" className="intro-pulse-dot" />
          <text x="20" y="13.5" fill="#065F46" fontSize="7" fontWeight="bold">
            Pusat: 1.000+ Ready
          </text>
        </g>

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
          {ordered ? 'Pesanan PO-2611 Terkirim ke Pusat' : 'Ajukan Pesanan 50 pcs (2 Snack)'}
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
          ? 'Notifikasi instan terkirim ke Admin Pusat untuk verifikasi'
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
        viewBox="0 0 380 200"
        role="img"
        aria-label="Perjalanan truk logistik pengiriman dari gudang pusat Daisuki ke toko cabang"
      >
        <defs>
          <linearGradient id="headlight-glow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FEF08A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="road-surface" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id="warehouse-roof" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2E3A4B" />
            <stop offset="100%" stopColor="#1E2337" />
          </linearGradient>
          <radialGradient id="shadow-soft" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1E2337" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#1E2337" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="190" cy="182" rx="175" ry="11" fill="url(#shadow-soft)" />

        {/* Asphalt Road */}
        <rect x="20" y="146" width="340" height="24" rx="4" fill="url(#road-surface)" />
        <line x1="20" y1="146" x2="360" y2="146" stroke="#94A3B8" strokeWidth="1.5" />
        <line x1="20" y1="170" x2="360" y2="170" stroke="#64748B" strokeWidth="1.5" />
        <line
          x1="28"
          y1="158"
          x2="352"
          y2="158"
          stroke="#F8FAFC"
          strokeWidth="2"
          strokeDasharray="14 10"
        />

        {/* Left: Gudang Pusat */}
        <g id="gudang-pusat">
          <polygon points="18,146 18,90 65,65 112,90 112,146" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
          <polygon points="12,91 65,62 118,91 112,95 65,68 18,95" fill="url(#warehouse-roof)" />
          <rect x="36" y="84" width="58" height="12" rx="2" fill="#A9000C" />
          <text x="65" y="93" textAnchor="middle" fill="#FFFFFF" fontSize="6.5" fontWeight="bold">
            GUDANG PUSAT
          </text>
          <rect x="38" y="100" width="54" height="46" rx="2" fill="#94A3B8" />
          {Array.from({ length: 6 }, (_, i) => (
            <line key={i} x1="39" y1={106 + i * 6} x2="91" y2={106 + i * 6} stroke="#64748B" strokeWidth="1" />
          ))}
          <rect x="24" y="132" width="12" height="14" rx="1" fill="#D97706" />
        </g>

        {/* Right: Mitra Cabang */}
        <g id="toko-cabang">
          <rect x="278" y="84" width="84" height="62" rx="3" fill="#FAF5EF" stroke="#E2DDD5" strokeWidth="1" />
          <g transform="translate(272, 76)">
            <polygon points="0,18 8,0 88,0 96,18" fill="#B83A6A" />
            <polygon points="8,0 18,0 14,18 3,18" fill="#FAF7F2" />
            <polygon points="28,0 38,0 35,18 24,18" fill="#FAF7F2" />
            <polygon points="48,0 58,0 56,18 45,18" fill="#FAF7F2" />
            <polygon points="68,0 78,0 77,18 66,18" fill="#FAF7F2" />
          </g>
          <rect x="288" y="97" width="64" height="11" rx="2" fill="#1E2337" />
          <text x="320" y="105" textAnchor="middle" fill="#FFFFFF" fontSize="6.5" fontWeight="bold">
            MITRA CABANG
          </text>
          <rect x="286" y="112" width="30" height="26" rx="2" fill="#BAE6FD" opacity="0.65" stroke="#93C5FD" strokeWidth="0.8" />
          <circle cx="301" cy="130" r="3.5" fill="#D97706" />
          <rect x="322" y="112" width="22" height="34" rx="1" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1" />
        </g>

        {/* Center: Delivery Truck */}
        <g
          className={`intro-delivery-truck ${requested ? 'intro-truck-moving' : 'intro-truck-idle'}`}
          transform="translate(108, 116)"
        >
          <polygon points="86,22 135,12 142,34 86,28" fill="url(#headlight-glow)" opacity={requested ? 0.95 : 0} />
          <ellipse cx="44" cy="40" rx="42" ry="4" fill="#1E2337" opacity="0.25" />

          {/* Van Box */}
          <rect x="0" y="4" width="58" height="32" rx="3" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.2" />
          <rect x="0" y="15" width="58" height="8" fill="#A9000C" />
          <text x="29" y="21.5" textAnchor="middle" fill="#FFFFFF" fontSize="5.5" fontWeight="900" letterSpacing="0.8">
            DAISUKI EXPRESS
          </text>

          {/* Cabin */}
          <path d="M58 12 L74 12 C78 12, 84 18, 86 24 L86 36 L58 36 Z" fill="#1E2337" />
          <path d="M62 15 L73 15 C76 15, 80 19, 82 24 L62 24 Z" fill="#BAE6FD" opacity="0.85" />
          <rect x="83.5" y="25" width="3" height="5" rx="1.5" fill="#FEF08A" />

          {/* Rear Wheel (Axle-Separated) */}
          <g transform="translate(18, 36)">
            <g className="intro-wheel-rotor">
              <circle cx="0" cy="0" r="7" fill="#1E2337" />
              <circle cx="0" cy="0" r="4.5" fill="#94A3B8" />
              <circle cx="0" cy="0" r="2" fill="#475569" />
              <line x1="-3.5" y1="0" x2="3.5" y2="0" stroke="#FFFFFF" strokeWidth="0.8" />
              <line x1="0" y1="-3.5" x2="0" y2="3.5" stroke="#FFFFFF" strokeWidth="0.8" />
            </g>
          </g>

          {/* Front Wheel (Axle-Separated) */}
          <g transform="translate(72, 36)">
            <g className="intro-wheel-rotor">
              <circle cx="0" cy="0" r="7" fill="#1E2337" />
              <circle cx="0" cy="0" r="4.5" fill="#94A3B8" />
              <circle cx="0" cy="0" r="2" fill="#475569" />
              <line x1="-3.5" y1="0" x2="3.5" y2="0" stroke="#FFFFFF" strokeWidth="0.8" />
              <line x1="0" y1="-3.5" x2="0" y2="3.5" stroke="#FFFFFF" strokeWidth="0.8" />
            </g>
          </g>
        </g>
      </svg>
   
      <div className="intro-action-container">
        <button
          type="button"
          onClick={() => setRequested(true)}
          disabled={requested}
          className={`intro-example-action ${requested ? 'intro-example-success' : ''}`}
        >
          {requested ? <Check size={14} /> : <PackageCheck size={14} />}
          {requested ? 'PO Sedang Dalam Pengiriman Kurir' : 'Mulai Pengiriman Daisuki Express'}
        </button>

        {requested && (
          <button
            type="button"
            onClick={() => setRequested(false)}
            className="intro-reset-btn"
            aria-label="Ulangi simulasi pengiriman"
            title="Ulangi simulasi pengiriman"
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

/* =========================================================================
   STEP 4: HAND HOLDING PHONE + BARCODE CAMERA + CHAT NOTIFICATION ANIMATION
   ========================================================================= */
function ScannerVisual() {
  const [scanned, setScanned] = useState(false)

  return (
    <div className="intro-artifact">
      <svg
        className="intro-drawing"
        viewBox="0 0 380 200"
        role="img"
        aria-label="Tangan memegang ponsel memindai barcode kardus kiriman admin dan menerima notifikasi chat verifikasi"
      >
        <defs>
          <linearGradient id="skin-tone" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F1C2A7" />
            <stop offset="100%" stopColor="#D99B77" />
          </linearGradient>
          <linearGradient id="phone-case" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2D3748" />
            <stop offset="100%" stopColor="#1A202C" />
          </linearGradient>
          <linearGradient id="laser-glow-red" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#DC2626" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#EF4444" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#DC2626" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="laser-glow-green" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#10B981" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="carton-kraft-deep" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#DDB790" />
            <stop offset="100%" stopColor="#B38656" />
          </linearGradient>
        </defs>

        {/* Ambient Floor Shadow */}
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


      {/* Action Button: Trigger Scan */}
      <div className="intro-action-container">
        <button
          type="button"
          className={`intro-example-action ${scanned ? 'intro-example-success' : ''}`}
          onClick={() => setScanned((v) => !v)}
        >
          {scanned ? <CheckCircle2 size={14} /> : <ScanLine size={14} />}
          {scanned ? 'Barcode Valid & Notifikasi Chat Masuk' : 'Arahkan Kamera ke Barcode Kardus'}
        </button>

        {scanned && (
          <button
            type="button"
            onClick={() => setScanned(false)}
            className="intro-reset-btn"
            aria-label="Ulangi simulasi pemindaian"
            title="Ulangi simulasi pemindaian"
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      <p className="intro-confirm" aria-live="polite">
        {scanned ? 'Notifikasi chat masuk dari Admin Pusat: fisik barang cocok' : 'Simulasi staf memindai kardus kiriman kurir'}
      </p>
    </div>
  )
}

/* =========================================================================
   STEP 5: SMOOTH STOCK HANDOVER & RETAIL SHELF INFLOW ANIMATION
   ========================================================================= */
function StockHandoverVisual() {
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className="intro-artifact">
      <svg
        className="intro-drawing"
        viewBox="0 0 380 200"
        role="img"
        aria-label="Kiriman stok admin diterima dan langsung menambah sisa stok di rak toko mitra cabang"
      >
        <defs>
          <linearGradient id="admin-box-card" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F8FAFC" />
          </linearGradient>
          <linearGradient id="pouch-red-handover" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#991B1B" />
          </linearGradient>
          <linearGradient id="pouch-amber-handover" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <radialGradient id="shelf-shadow-base" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1E2337" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#1E2337" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient Floor Shadow */}
        <ellipse cx="190" cy="182" rx="160" ry="10" fill="url(#shelf-shadow-base)" />

        {/* -------------------------------------------------------------
            LEFT: KIRIMAN DARI ADMIN DAISUKI PUSAT (50 pcs)
           ------------------------------------------------------------- */}
        <g id="kiriman-admin" transform="translate(24, 18)">
          <rect x="0" y="0" width="132" height="148" rx="12" fill="url(#admin-box-card)" stroke="#E2E8F0" strokeWidth="1" />

          {/* Red Header Bar */}
          <rect x="0" y="0" width="132" height="28" rx="12" fill="#A9000C" />
          <rect x="0" y="16" width="132" height="12" fill="#A9000C" />
          <text x="66" y="17.5" textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="bold" letterSpacing="0.4">
            KIRIMAN DARI ADMIN
          </text>

          {/* Open Logistics Box Graphic */}
          <g transform="translate(18, 38)">
            <rect x="0" y="14" width="96" height="54" rx="4" fill="#DDB790" stroke="#B38656" strokeWidth="1" />
            <line x1="0" y1="38" x2="96" y2="38" stroke="#B38656" strokeWidth="0.8" />
            <rect x="36" y="14" width="24" height="54" fill="#CA9E72" opacity="0.35" />

            <rect x="22" y="25" width="52" height="18" rx="2" fill="#FFFFFF" />
            <text x="48" y="33" textAnchor="middle" fill="#8E1414" fontSize="6" fontWeight="bold">
              DAISUKI
            </text>
            <text x="48" y="39.5" textAnchor="middle" fill="#1E2337" fontSize="5.5" fontWeight="bold">
              +50 pcs Snack
            </text>

            {/* Pouch Previews Peeking Out */}
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
                <g transform="translate(34, 6)">
                  <g className="intro-shelf-drop" style={{ animationDelay: '80ms' }}>
                    <rect x="0" y="0" width="22" height="36" rx="3" fill="url(#pouch-amber-handover)" />
                    <rect x="3" y="10" width="16" height="14" rx="1.5" fill="#FFFBEB" />
                    <text x="11" y="19" textAnchor="middle" fill="#92400E" fontSize="4.8" fontWeight="bold">Seblak</text>
                  </g>
                </g>

                {/* Pouch 3: Basreng Daun Jeruk */}
                <g transform="translate(62, 6)">
                  <g className="intro-shelf-drop" style={{ animationDelay: '160ms' }}>
                    <rect x="0" y="0" width="22" height="36" rx="3" fill="url(#pouch-red-handover)" />
                    <rect x="3" y="10" width="16" height="14" rx="1.5" fill="#FFFBEB" />
                    <text x="11" y="19" textAnchor="middle" fill="#8E1414" fontSize="4.8" fontWeight="bold">Basreng</text>
                  </g>
                </g>

                {/* Pouch 4: Keripik Pisang */}
                <g transform="translate(90, 6)">
                  <g className="intro-shelf-drop" style={{ animationDelay: '240ms' }}>
                    <rect x="0" y="0" width="22" height="36" rx="3" fill="#78350F" />
                    <rect x="3" y="10" width="16" height="14" rx="1.5" fill="#FFFBEB" />
                    <text x="11" y="19" textAnchor="middle" fill="#582407" fontSize="4.8" fontWeight="bold">Pisang</text>
                  </g>
                </g>
              </g>
            )}
          </g>

          {/* Success Notification at Bottom */}
          <g transform="translate(14, 122)">
            <rect
              x="0"
              y="0"
              width="122"
              height="18"
              rx="4"
              fill={confirmed ? '#ECFDF5' : '#F8FAFC'}
              stroke={confirmed ? '#A7F3D0' : '#E2E8F0'}
              strokeWidth="0.8"
            />
            <text
              x="61"
              y="12"
              textAnchor="middle"
              fill={confirmed ? '#065F46' : '#64748B'}
              fontSize="6.5"
              fontWeight="bold"
            >
              {confirmed ? '+50 pcs Masuk ke Rak Toko' : 'Menunggu Kiriman Diterima'}
            </text>
          </g>
        </g>
      </svg>


      {/* Action Button: Confirm Handover */}
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

const visuals = [ShelfVisual, CatalogOrderVisual, SupplyVisual, ScannerVisual, StockHandoverVisual]

/* =========================================================================
   MAIN ONBOARDING COMPONENT
   ========================================================================= */
export function OnboardingWalkthrough({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState('next')
  const [fullscreen, setFullscreen] = useState(false)
  const [supported, setSupported] = useState(false)
  const [fullscreenPending, setFullscreenPending] = useState(false)
  const [notice, setNotice] = useState('')
  const touch = useRef<{ x: number; y: number } | null>(null)
  const fullscreenOwned = useRef(false)
  const currentStep = useRef(step)
  const finishRef = useRef(onFinish)
  currentStep.current = step
  finishRef.current = onFinish

  function goTo(target: number) {
    const next = Math.max(0, Math.min(steps.length - 1, target))
    if (next === currentStep.current) return
    setDirection(next > currentStep.current ? 'next' : 'previous')
    currentStep.current = next
    setStep(next)
  }

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
    document.addEventListener('fullscreenchange', sync)
    window.addEventListener('keydown', keydown)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      window.removeEventListener('keydown', keydown)
      if (fullscreenOwned.current && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    }
  }, [])

  async function toggleFullscreen() {
    setNotice('')
    setFullscreenPending(true)
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else {
        await document.documentElement.requestFullscreen()
        fullscreenOwned.current = true
      }
    } catch {
      setNotice('Layar penuh tidak tersedia saat ini. Anda tetap bisa mengikuti panduan.')
    } finally {
      setFullscreenPending(false)
    }
  }

  return (
    <main className="intro-canvas font-sans" data-direction={direction}>
      {/* Top Header: Fullscreen, Dash Stepper, Skip Button */}
      <header className="intro-header">
        <button
          type="button"
          className="intro-icon-button"
          onClick={() => void toggleFullscreen()}
          disabled={!supported || fullscreenPending}
          aria-pressed={fullscreen}
          aria-label={fullscreen ? 'Keluar layar penuh' : 'Buka layar penuh'}
          title={supported ? 'Layar penuh' : 'Browser ini tidak mendukung layar penuh'}
        >
          {fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
        </button>

        {/* Minimalist Dash Lines Progress Indicator (Dribbble Style) */}
        <nav className="intro-progress" aria-label="Langkah panduan">
          {steps.map((item, index) => (
            <button
              type="button"
              key={item.label}
              onClick={() => goTo(index)}
              aria-label={`Langkah ${index + 1}: ${item.label}`}
              aria-current={index === step ? 'step' : undefined}
            >
              <span />
            </button>
          ))}
        </nav>

        <button type="button" className="intro-skip" onClick={onFinish}>
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
                <h1 className="font-display">{item.title}</h1>
                <p>{item.description}</p>
              </div>
            ))}
          </div>

          <span className="sr-only" role="status">
            Langkah {step + 1} dari {steps.length}. {steps[step].title}
          </span>

          {/* Icon-Only Navigation Buttons < and > */}
          <div className="intro-actions">
            <button
              type="button"
              className="intro-nav-btn intro-nav-prev"
              onClick={() => goTo(step - 1)}
              disabled={step === 0}
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
              onClick={() => (step === steps.length - 1 ? onFinish() : goTo(step + 1))}
              aria-label={step === steps.length - 1 ? 'Masuk ke Akun Daisuki' : 'Langkah selanjutnya'}
              title={step === steps.length - 1 ? 'Masuk ke Akun Daisuki' : 'Lanjutkan'}
            >
              <ChevronRight size={22} strokeWidth={2.4} />
            </button>
          </div>
        </section>
      </div>

      <footer className="intro-brand">
        Daisuki <span>Inventory</span>
      </footer>
    </main>
  )
}
