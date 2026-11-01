import { useId, useState } from 'react'
import type { CSSProperties } from 'react'
import { Check, Plus, RotateCcw, ScanLine } from 'lucide-react'

function Pouch({ color = '#A9000C', label = 'BASRENG' }: { color?: string; label?: string }) {
  return <g><path d="M2 4Q15 0 28 4L27 42Q15 46 3 42Z" fill={color} /><path d="M2 4H28M4 40H26" stroke="#FFFFFF" strokeOpacity=".25" strokeWidth="2" /><rect x="5" y="14" width="20" height="17" rx="2" fill="#FFF8E9" /><text x="15" y="20" textAnchor="middle" fontSize="3.5" fill="#1E2337" fontWeight="700">DAISUKI</text><text x="15" y="26" textAnchor="middle" fontSize="3.2" fill={color}>{label}</text><path d="M6 7L5 36" stroke="white" strokeOpacity=".16" strokeWidth="2" /></g>
}

export function CatalogOrderVisual() {
  const [quantities, setQuantities] = useState([25, 25])
  const [ordered, setOrdered] = useState(false)
  const total = quantities[0] + quantities[1]
  const products = [
    { name: 'Basreng Pedas Daun Jeruk', label: 'BASRENG', ready: 850, color: '#A9000C' },
    { name: 'Seblak Jadul Instan', label: 'SEBLAK', ready: 1200, color: '#C47716' },
  ]
  return <div className="intro-artifact motion-catalog-artifact">
    <div className="motion-catalog">
      <div className="motion-catalog-header"><span className="motion-live-dot" />Gudang Pusat: <strong className="num">1.000+ Ready</strong></div>
      {products.map((product, index) => <div className="motion-product-row" key={product.name}>
        <svg viewBox="0 0 30 46" aria-hidden="true" className="motion-pouch-thumb"><Pouch color={product.color} label={product.label} /></svg>
        <div className="motion-product-info"><strong>{product.name}</strong><span className="num">Ready {product.ready.toLocaleString('id-ID')} pcs</span></div>
        <button type="button" disabled={ordered || quantities[index] + 25 > product.ready} className="motion-add" aria-label={`Tambah 25 pcs ${product.name}`} onClick={() => setQuantities((values) => values.map((value, i) => i === index ? value + 25 : value))}><Plus size={13} /><span key={quantities[index]} className="motion-quantity num">{quantities[index]} pcs</span></button>
      </div>)}
      <div className={`motion-po-summary ${ordered ? 'motion-po-success' : ''}`} aria-live="polite">{ordered ? <><Check size={14} />PO Berhasil Diajukan ke Admin Pusat</> : <><span>DRAFT</span><strong className="num">Total {total} pcs</strong></>}</div>
    </div>
    <div className="intro-action-container"><button type="button" className={`intro-example-action ${ordered ? 'intro-example-success' : ''}`} disabled={ordered} onClick={() => setOrdered(true)}>{ordered ? <Check size={15} /> : <Plus size={15} />}{ordered ? 'Menunggu verifikasi pusat' : `Ajukan pesanan ${total} pcs`}</button><button type="button" className="intro-reset-btn" aria-label="Ulangi contoh pemesanan" onClick={() => { setOrdered(false); setQuantities([25, 25]) }}><RotateCcw size={14} /></button></div>
  </div>
}

export function ScannerVisual() {
  const [scanned, setScanned] = useState(false)
  const id = useId().replace(/:/g, '')
  return <div className="intro-artifact">
    <svg className="intro-drawing" viewBox="0 0 400 210" role="img" aria-label={scanned ? 'Ponsel menampilkan pesanan terverifikasi dan notifikasi admin pusat' : 'Tangan memegang ponsel miring untuk memindai resi kardus Daisuki'}>
      <defs><linearGradient id={`${id}-kraft`} x2="1" y2="1"><stop stopColor="#DDBA94" /><stop offset="1" stopColor="#BD9267" /></linearGradient><pattern id={`${id}-grain`} width="13" height="9" patternUnits="userSpaceOnUse"><path d="M2 3h2M8 7h3" stroke="#785335" strokeWidth=".5" opacity=".15" /></pattern><clipPath id={`${id}-screen`}><rect x="5" y="6" width="116" height="170" rx="13" /></clipPath><radialGradient id={`${id}-shadow`}><stop stopColor="#1E2337" stopOpacity=".15" /><stop offset="1" stopColor="#1E2337" stopOpacity="0" /></radialGradient></defs>
      <ellipse cx="210" cy="195" rx="165" ry="13" fill={`url(#${id}-shadow)`} />
      <g transform="translate(215 36)"><path d="M0 37L65 10L139 36L73 66Z" fill="#E6C5A0" /><path d="M0 37V131L73 159V66Z" fill={`url(#${id}-kraft)`} /><path d="M73 66L139 36V128L73 159Z" fill="#AC8057" /><path d="M0 37V131L73 159V66Z" fill={`url(#${id}-grain)`} /><path d="M28 25L103 53V81L89 87V58L15 31Z" fill="#B18452" opacity=".7" /><g transform="translate(10 61) skewY(20)"><rect width="54" height="48" rx="2" fill="#FFFCF6" /><text x="4" y="9" fontSize="5" fontWeight="700" fill="#A9000C">DAISUKI EXPRESS</text><text x="4" y="17" fontSize="5" fill="#1E2337">SURAT JALAN PO-2611</text>{Array.from({ length: 16 }, (_, i) => <rect key={i} x={5 + i * 2.8} y="23" width={i % 3 ? 1 : 1.8} height="18" fill="#1E2337" />)}</g></g>
      <path d="M106 210L93 173Q81 143 100 132L143 124Q162 116 176 131L200 164L205 210Z" fill="#C99E7A" /><path d="M123 207L107 169Q100 149 116 138L145 134Q163 129 173 145L188 171L187 207Z" fill="#E0BB9B" />
      <g transform="translate(83 8) rotate(15 63 91)"><rect width="126" height="182" rx="18" fill="#343A46" /><path d="M4 30V65" stroke="#6B7180" strokeWidth="2" /><g clipPath={`url(#${id}-screen)`}><rect x="5" y="6" width="116" height="170" fill="#202938" />
        <g className={`motion-camera ${scanned ? 'motion-camera-hidden' : ''}`}><path d="M19 61V47H34M92 47H107V61M107 131V145H92M34 145H19V131" fill="none" stroke="#F5F2E9" strokeWidth="2" /><rect x="30" y="79" width="66" height="39" rx="2" fill="#FAF7F2" />{Array.from({ length: 19 }, (_, i) => <rect key={i} x={36 + i * 2.8} y="87" width={i % 3 ? 1 : 1.9} height="23" fill="#1E2337" />)}<path d="M23 71H103" stroke="#A9000C" strokeWidth="2" className="motion-scan-laser" /></g>
        <g className={`motion-phone-success ${scanned ? 'motion-phone-success-visible' : ''}`}><rect x="5" y="6" width="116" height="170" fill="#FFFDF9" /><circle cx="63" cy="99" r="17" fill="#D1FAE5" /><path d="M55 99L61 105L72 92" stroke="#047857" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /><text x="63" y="131" textAnchor="middle" fontSize="8" fill="#1E2337" fontWeight="700">Pesanan Terverifikasi</text><text x="63" y="144" textAnchor="middle" fontSize="7" fill="#647087">PO-2611 · 50 pcs</text></g>
        {scanned && <g className="motion-push"><rect x="10" y="27" width="106" height="46" rx="7" fill="#E8F5E9" /><text x="16" y="38" fontSize="6" fill="#047857" fontWeight="700">Admin Daisuki Pusat</text><text x="16" y="47" fontSize="5" fill="#647087">Baru saja</text><text x="16" y="57" fontSize="5.8" fill="#1E2337">PO-2611 Cocok! 50 pcs siap</text><text x="16" y="66" fontSize="5.8" fill="#1E2337">dimasukkan ke stok rak toko.</text></g>}
      </g><rect x="45" y="11" width="36" height="5" rx="3" fill="#111827" /><path d="M49 169H77" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" /></g>
      <path d="M185 145Q174 135 167 120L158 102Q153 90 161 86Q169 82 175 94L192 119Q205 132 206 149L203 184" fill="#E0BB9B" /><path d="M163 94Q170 94 173 104" fill="none" stroke="#F0D0B5" strokeWidth="4" strokeLinecap="round" />
    </svg>
    <div className="intro-action-container"><button type="button" className={`intro-example-action ${scanned ? 'intro-example-success' : ''}`} disabled={scanned} onClick={() => setScanned(true)}>{scanned ? <Check size={15} /> : <ScanLine size={15} />}{scanned ? 'Pesanan terverifikasi' : 'Coba pindai barcode'}</button><button type="button" className="intro-reset-btn" aria-label="Ulangi pemindaian" onClick={() => setScanned(false)}><RotateCcw size={14} /></button></div>
  </div>
}

export function StockHandoverVisual() {
  const [confirmed, setConfirmed] = useState(false)
  return <div className="intro-artifact">
    <svg className="intro-drawing" viewBox="0 0 400 210" role="img" aria-label={confirmed ? 'Tiga kemasan berpindah dari kardus ke rak, stok bertambah dari 8 menjadi 58 pcs' : 'Kardus terbuka berisi snack, rak toko tersisa satu kemasan'}>
      <ellipse cx="200" cy="193" rx="173" ry="8" fill="#1E2337" opacity=".06" />
      <path d="M35 105L90 81L151 103L96 131Z" fill="#856344" /><path d="M35 105L16 86L69 61L90 81M90 81L111 61L172 84L151 103" fill="#DEC09D" />
      {[0, 1, 2].map((i) => <g key={i} transform={`translate(${53 + i * 27} ${76 + i % 2 * 7}) scale(.75)`}><g className={confirmed ? 'motion-source-leaves' : ''} style={{ animationDelay: `${80 + i * 80}ms` }}><Pouch color={i === 1 ? '#C47716' : '#A9000C'} /></g></g>)}
      <path d="M35 105V172L96 194V131Z" fill="#C69D73" /><path d="M96 131L151 103V169L96 194Z" fill="#AF8258" /><path d="M35 105L96 131L77 149L17 123M96 131L151 103L169 120L113 149" fill="#E3C5A2" /><text x="49" y="161" fill="#63432D" fontSize="9" fontWeight="700" transform="rotate(20 49 161)">DAISUKI</text>
      <path d="M163 137Q190 120 220 133" fill="none" stroke={confirmed ? '#10B981' : '#D8D1C6'} strokeWidth="2" strokeDasharray="4 5" className={confirmed ? 'motion-transfer-path' : ''} /><path d="M213 126L222 133L212 138" fill="none" stroke={confirmed ? '#10B981' : '#D8D1C6'} strokeWidth="2" />
      <path d="M241 74V194M371 74V194" stroke="#9C7F60" strokeWidth="7" strokeLinecap="round" /><path d="M233 152H379" stroke="#B69773" strokeWidth="10" strokeLinecap="round" /><path d="M234 147H378" stroke="#E2C7A5" strokeWidth="3" /><path d="M239 185H373" stroke="#B69773" strokeWidth="6" /><path d="M245 159H367M245 188H367" stroke="#85694F" strokeWidth="1" opacity=".4" />
      <g transform="translate(247 108) scale(.85)"><Pouch /></g>
      {confirmed && [0, 1, 2].map((i) => <g key={i} transform={`translate(${278 + i * 30} 108)`}><g className="motion-inflow" style={{ '--inflow-x': `${-208 - i * 3}px`, '--inflow-y': `${-28 + i % 2 * 7}px`, animationDelay: `${80 + i * 80}ms` } as CSSProperties}><g transform="scale(.85)"><Pouch color={i === 1 ? '#A9000C' : '#C47716'} label={i === 1 ? 'BASRENG' : 'SEBLAK'} /></g></g></g>)}
      {confirmed && <path className="motion-shelf-highlight" d="M235 147H377" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />}
      <text x="305" y="47" textAnchor="middle" fontSize="11" fill="#647087">Stok rak toko</text><g key={String(confirmed)} className={confirmed ? 'motion-counter-pop' : ''}><text x="305" y="77" textAnchor="middle" fontSize="26" fill="#1E2337" fontWeight="700" fontFamily="var(--font-display)" className="num">{confirmed ? '58' : '8'} pcs</text></g>
    </svg>
    <div className={`motion-stock-chip ${confirmed ? 'motion-stock-safe' : ''}`} aria-live="polite">{confirmed && <Check size={14} />}{confirmed ? 'Aman: 58 pcs' : 'Kritis: sisa 8 pcs'}</div>
    <div className="intro-action-container"><button type="button" className={`intro-example-action ${confirmed ? 'intro-example-success' : ''}`} onClick={() => setConfirmed(true)} disabled={confirmed}>{confirmed ? <Check size={15} /> : <Plus size={15} />}{confirmed ? '50 pcs masuk ke stok' : 'Konfirmasi terima 50 pcs'}</button><button type="button" className="intro-reset-btn" aria-label="Ulangi serah terima" onClick={() => setConfirmed(false)}><RotateCcw size={14} /></button></div>
  </div>
}
