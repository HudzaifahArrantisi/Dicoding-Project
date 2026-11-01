import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Maximize,
  Minimize,
  Minus,
  PackageCheck,
  Plus,
  ScanLine,
  Truck,
} from 'lucide-react'
import './onboarding-walkthrough.css'

const steps = [
  {
    tag: 'Pencatatan Toko',
    icon: Clock,
    title: 'Hitung sisa stok rak dalam 10 detik, tanpa kertas.',
    description:
      'Cukup ketuk tombol minus di ponsel saat tutup toko. Perubahan stok langsung tersimpan rapi tanpa risiko nota tercecer atau selisih pembukuan.',
    caption: '01 / Catat sisa stok fisik harian',
    stepLabel: 'Catat Stok',
  },
  {
    tag: 'Pasokan Cerdas',
    icon: ArrowUpRight,
    title: 'Gudang pusat kirim pasokan sebelum rak toko kosong.',
    description:
      'Sistem cerdas memantau laju konsumsi dan jarak pengiriman. Ajukan pesanan restok ke gudang pusat dengan satu ketukan sebelum stok habis.',
    caption: '02 / Ajukan pasokan restok terencana',
    stepLabel: 'Pasokan PO',
  },
  {
    tag: 'Logistik & Penerimaan',
    icon: Truck,
    title: 'Pindai barcode kiriman kurir, verifikasi seketika.',
    description:
      'Arahkan kamera ponsel ke label kardus yang diantar kurir. Sistem langsung mencocokkan surat jalan dan memasukkan barang ke stok toko.',
    caption: '03 / Konfirmasi penerimaan surat jalan',
    stepLabel: 'Terima Barang',
  },
]

function StockDemo() {
  const [quantity, setQuantity] = useState<number | null>(null)
  return (
    <div className="tour-artifact-card">
      <div className="flex items-center justify-between border-b border-border/80 pb-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-ink-900">
          <Boxes className="size-3.5 text-ink-700" /> Sesi Tutup Toko
        </span>
        <span className="num rounded bg-ink-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink-700">
          20:00 WIB
        </span>
      </div>

      <div className="mt-4">
        <span className="inline-block rounded-md bg-ink-50 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          DSK-BR-002
        </span>
        <h4 className="mt-1 font-display text-base font-bold text-ink-900">
          Basreng Daun Jeruk (200g)
        </h4>
        <p className="text-xs text-muted-foreground">Stok fisik tersisa di rak display</p>
      </div>

      <div className="my-5 flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-[#fafafa] p-3">
        <button
          type="button"
          aria-label="Kurangi stok simulasi"
          onClick={() => setQuantity((q) => Math.max(0, (q ?? 35) - 1))}
          className="tour-stepper-btn relative"
        >
          <Minus className="size-4 text-ink-900" />
          {quantity === null && <span className="tour-pulse-ring" />}
        </button>

        <div className="text-center">
          <div className="flex items-baseline justify-center gap-1">
            <span
              className="relative inline-grid h-10 overflow-hidden font-display text-3xl font-extrabold text-ink-900 tabular-nums"
              aria-label={`${quantity ?? 35} pcs`}
            >
              {quantity === null ? (
                <>
                  <span className="tour-count-before col-start-1 row-start-1" aria-hidden="true">
                    40
                  </span>
                  <span className="tour-count-after col-start-1 row-start-1" aria-hidden="true">
                    35
                  </span>
                </>
              ) : (
                quantity
              )}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">pcs</span>
          </div>
        </div>

        <button
          type="button"
          aria-label="Tambah stok simulasi"
          onClick={() => setQuantity((q) => (q ?? 35) + 1)}
          className="tour-stepper-btn"
        >
          <Plus className="size-4 text-ink-900" />
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
          <span>Sisa stok</span>
          <span className="num font-semibold text-ink-900">{quantity === null ? 'Contoh pencatatan' : `${quantity} pcs`}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-ink-50">
          <div
            className={`h-full origin-left rounded-full bg-emerald-600 transition-all ${
              quantity === null ? 'tour-stock-bar' : 'w-[70%]'
            }`}
          />
        </div>
      </div>

      <div
        className={`mt-4 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 ${
          quantity === null ? 'tour-saved-badge' : ''
        }`}
      >
        <Check className="size-3.5 shrink-0 text-emerald-600" />
        <span>Tersimpan Otomatis ke Cloud Pusat</span>
      </div>
    </div>
  )
}

function SupplyDemo() {
  const [requested, setRequested] = useState(false)
  return (
    <div className="tour-artifact-card">
      <div className="flex items-center justify-between border-b border-border/80 pb-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-ink-900">
          <Boxes className="size-3.5 text-ink-700" /> Rekomendasi Restok
        </span>
        <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
          Perlu Pasokan
        </span>
      </div>

      <div className="mt-4">
        <span className="inline-block rounded-md bg-ink-50 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          DSK-MK-003
        </span>
        <h4 className="mt-1 font-display text-base font-bold text-ink-900">
          Makaroni Daun Jeruk (150g)
        </h4>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-muted-foreground">Sisa:</span>
            <strong className="num font-display text-2xl font-bold text-ink-900">6</strong>
            <span className="text-xs font-medium text-muted-foreground">pcs</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-amber-100/80 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
            <span className="tour-radar-dot size-1.5 rounded-full bg-amber-600" />
            Buffer Menipis
          </span>
        </div>
      </div>

      <div className="my-4 rounded-lg border border-amber-200/80 bg-amber-50/50 p-2.5 text-xs text-amber-900">
        <p className="font-semibold tabular-nums">Perkiraan Habis: 0,75 Hari</p>
        <p className="mt-0.5 text-[11px] text-amber-700">
          Konsumsi harian rata-rata 8 pcs/hari. Gudang pusat siap kirim 40 pcs.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setRequested(true)}
        disabled={requested}
        className="relative flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-ink-700 active:scale-[0.99] disabled:bg-emerald-800"
      >
        {requested ? <Check className="size-4 shrink-0" /> : <PackageCheck className="size-4 shrink-0" />}
        {requested ? 'PO Masuk Antrean Verifikasi Pusat' : 'Pesan Pasokan 40 pcs Sekarang'}
        {!requested && <span className="tour-pulse-ring" />}
      </button>

      <div
        className={`mt-3 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 ${
          requested ? '' : 'tour-saved-badge'
        }`}
      >
        <Check className="size-3.5 shrink-0 text-emerald-600" />
        <span>Pesanan PO Masuk Antrean Verifikasi Pusat</span>
      </div>
    </div>
  )
}

function DeliveryDemo() {
  return (
    <div className="tour-phone-frame">
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5 text-[11px] font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5 text-ink-900 font-semibold">
          <ScanLine className="size-3.5 text-ink-700" /> Pindai Surat Jalan
        </span>
        <span className="num font-mono">09:41</span>
      </div>

      <div className="tour-viewfinder-box">
        <svg
          viewBox="0 0 240 160"
          className="w-full"
          aria-label="Ilustrasi label barcode kardus surat jalan"
          role="img"
        >
          {/* Viewfinder corner brackets */}
          <path
            d="M 16 36 L 16 16 L 36 16 M 204 16 L 224 16 L 224 36 M 224 124 L 224 144 L 204 144 M 36 144 L 16 144 L 16 124"
            fill="none"
            stroke="#141B3D"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Shipping label carton sticker */}
          <rect
            x="36"
            y="28"
            width="168"
            height="104"
            rx="6"
            fill="#FFFFFF"
            stroke="#E2DFD7"
            strokeWidth="1.5"
          />

          <text x="48" y="44" fill="#64748B" fontSize="7.5" fontWeight="600" fontFamily="sans-serif">
            DAISUKI GUDANG PUSAT
          </text>
          <text x="48" y="54" fill="#141B3D" fontSize="8" fontWeight="700" fontFamily="sans-serif">
            SURAT JALAN #PO-241101
          </text>

          {/* Barcode lines */}
          {Array.from({ length: 32 }, (_, i) => {
            const x = 50 + i * 4.4
            const isThick = i % 3 === 0 || i % 7 === 0
            return (
              <rect
                key={i}
                x={x}
                y="64"
                width={isThick ? 2.8 : 1.4}
                height="38"
                fill="#141B3D"
              />
            )
          })}

          <text
            x="120"
            y="118"
            textAnchor="middle"
            fill="#64748B"
            fontSize="8"
            fontFamily="monospace"
            letterSpacing="1"
          >
            * PO-241101-BDG *
          </text>
        </svg>

        <span className="tour-laser-line" />

        <div className="tour-receipt-modal">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            <p className="text-xs font-bold text-ink-900">Barcode Terverifikasi</p>
          </div>
          <div className="mt-1 flex items-baseline justify-between border-t border-border/60 pt-1.5 text-[11px]">
            <span className="text-muted-foreground">Surat Jalan:</span>
            <span className="font-mono font-semibold text-ink-900">PO-241101</span>
          </div>
          <div className="mt-0.5 flex items-baseline justify-between text-[11px]">
            <span className="text-muted-foreground">Barang Diterima:</span>
            <span className="num font-bold text-emerald-700">50 pcs (Lengkap)</span>
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] font-medium text-muted-foreground">
        Arahkan kamera ke barcode kardus pengiriman
      </p>
    </div>
  )
}

export function OnboardingWalkthrough({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<'next' | 'previous'>('next')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenSupported, setFullscreenSupported] = useState(false)
  const [fullscreenError, setFullscreenError] = useState('')
  const [fullscreenPending, setFullscreenPending] = useState(false)
  const touch = useRef<{ x: number; y: number } | null>(null)

  function goTo(next: number) {
    const target = Math.max(0, Math.min(steps.length - 1, next))
    if (target === step) return
    setDirection(target > step ? 'next' : 'previous')
    setStep(target)
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return
      if ((e.target as HTMLElement).closest('button, a, input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        if (step < steps.length - 1) {
          goTo(step + 1)
        } else {
          onFinish()
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (step > 0) goTo(step - 1)
      } else if (e.key === 'Escape') {
        if (!document.fullscreenElement) onFinish()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [step, onFinish])

  // Fullscreen sync
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    setFullscreenSupported(Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen))
    handleFsChange()
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  const toggleFullscreen = async () => {
    setFullscreenError('')
    setFullscreenPending(true)
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen()
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        }
      }
    } catch {
      setFullscreenError('Browser tidak mengizinkan layar penuh. Panduan tetap dapat digunakan.')
    } finally {
      setFullscreenPending(false)
    }
  }

  const current = steps[step]
  const Icon = current.icon

  return (
    <main
      className="tour-shell min-h-dvh w-full bg-[#f6f5f2] font-sans text-ink-900"
      data-direction={direction}
    >
      <div className="tour-viewport-container mx-auto flex min-h-dvh flex-col justify-between lg:justify-center lg:p-6 xl:p-8">
        <section
          aria-label="Panduan sistem Daisuki"
          className="tour-frame mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden bg-white sm:rounded-2xl sm:border sm:border-border sm:shadow-[0_12px_40px_-15px_rgba(20,27,61,0.08)] lg:flex-none"
        >
          {/* Universal Header */}
          <header className="tour-header flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-white px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="font-display text-lg font-bold tracking-tight text-ink-900">
                Daisuki <span className="font-sans text-xs font-normal text-muted-foreground">Inventory</span>
              </span>
              <span className="hidden rounded-lg border border-border bg-ink-50 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground xl:inline-block">
                Panduan Sistem
              </span>
            </div>

            {/* Stepper Tabs (Desktop / Tablet) */}
            <nav className="tour-header-steps hidden sm:flex sm:items-center sm:gap-1.5" aria-label="Langkah panduan">
              {steps.map((item, index) => {
                const isActive = step === index
                const isPassed = step > index
                return (
                  <button
                    key={item.tag}
                    type="button"
                    aria-current={isActive ? 'step' : undefined}
                    onClick={() => goTo(index)}
                    className={`flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-ink-900 text-white font-semibold shadow-xs'
                        : isPassed
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'text-muted-foreground hover:bg-ink-50 hover:text-ink-900'
                    }`}
                  >
                    {isPassed ? (
                      <Check className="size-3 text-emerald-600" />
                    ) : (
                      <span className="num text-[11px] font-mono">{String(index + 1).padStart(2, '0')}</span>
                    )}
                    <span>{item.stepLabel}</span>
                  </button>
                )
              })}
            </nav>

            {/* Action Buttons: Fullscreen & Skip */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={toggleFullscreen}
                disabled={!fullscreenSupported || fullscreenPending}
                aria-pressed={isFullscreen}
                aria-label={isFullscreen ? 'Keluar mode layar penuh' : 'Tampilkan mode layar penuh'}
                title={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
                className="flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-ume disabled:opacity-40"
              >
                {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
              </button>

              <button
                type="button"
                onClick={onFinish}
                className="flex min-h-11 items-center rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-ume"
              >
                Lewati
              </button>
            </div>
          </header>
          {fullscreenError && <p role="status" className="px-5 py-2 text-xs text-muted">{fullscreenError}</p>}

          {/* Main Content Area (Split Grid on Desktop, Stacked on Mobile/Tablet) */}
          <div
            className="tour-main-grid flex-1 grid min-w-0 lg:grid-cols-[1.1fr_1fr]"
            onTouchStart={(event) => {
              touch.current = null
              if ((event.target as HTMLElement).closest('button')) return
              const p = event.touches[0]
              touch.current = { x: p.clientX, y: p.clientY }
            }}
            onTouchEnd={(event) => {
              const start = touch.current
              touch.current = null
              if (!start) return
              const p = event.changedTouches[0]
              const dx = p.clientX - start.x
              if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(p.clientY - start.y) * 1.5) {
                goTo(step + (dx < 0 ? 1 : -1))
              }
            }}
            onTouchCancel={() => {
              touch.current = null
            }}
          >
            {/* Interactive Simulation Stage (Left Column) */}
            <div className="tour-stage-area relative flex flex-col items-center justify-center border-b border-border/80 bg-[#fbfaf8] p-5 sm:p-8 lg:border-b-0 lg:border-r">
              <div className="mb-4 flex w-full max-w-[340px] items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span className="num font-mono">{current.caption}</span>
                <span className="hidden lg:inline text-[10px] text-muted-foreground/70">
                  Gunakan panah keyboard [←] [→]
                </span>
              </div>

              <div className="tour-demo-stage flex w-full items-center justify-center">
                <div className="tour-demo-stack w-full max-w-[340px]">
                  <div
                    className="tour-demo-slide"
                    data-active={step === 0}
                    aria-hidden={step !== 0}
                    inert={step !== 0}
                  >
                    <StockDemo />
                  </div>
                  <div
                    className="tour-demo-slide"
                    data-active={step === 1}
                    aria-hidden={step !== 1}
                    inert={step !== 1}
                  >
                    <SupplyDemo />
                  </div>
                  <div
                    className="tour-demo-slide"
                    data-active={step === 2}
                    aria-hidden={step !== 2}
                    inert={step !== 2}
                  >
                    <DeliveryDemo />
                  </div>
                </div>
              </div>

              <p className="mt-4 text-center text-[11px] text-muted-foreground">
                Simulasi interaktif · data contoh produk Daisuki
              </p>
            </div>

            {/* Editorial Narrative & Navigation (Right Column) */}
            <div className="tour-copy-area flex flex-col justify-between bg-white p-5 sm:p-8 lg:p-10">
              <div
                key={step}
                className="tour-editorial-content"
                aria-live="polite"
                aria-atomic="true"
              >
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-ink-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-700">
                  <Icon className="size-3.5 text-ink-700" />
                  <span>{current.tag}</span>
                </div>

                <h1 className="mt-3 font-display text-2xl font-bold leading-tight tracking-tight text-ink-900 sm:text-3xl lg:text-[2rem]">
                  {current.title}
                </h1>

                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base sm:leading-7">
                  {current.description}
                </p>
              </div>

              {/* Bottom Control Bar */}
              <div className="tour-bottom-controls mt-6 pt-4 border-t border-border/60">
                <div className="mb-4 flex items-center justify-between">
                  {/* Step dots (Mobile view) */}
                  <div className="flex items-center gap-1.5">
                    {steps.map((item, i) => (
                      <button
                        key={item.tag}
                        type="button"
                        aria-label={`Langkah ${i + 1}: ${item.tag}`}
                        aria-current={step === i ? 'step' : undefined}
                        onClick={() => goTo(i)}
                        className="grid size-11 place-items-center rounded-lg"
                      >
                        <span
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            step === i ? 'w-6 bg-ume' : 'w-1.5 bg-ink-200'
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="num text-xs font-semibold text-muted-foreground">
                      {step + 1} / {steps.length}
                    </span>

                    {step > 0 && (
                      <button
                        type="button"
                        onClick={() => goTo(step - 1)}
                        className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-ink-50 hover:text-ink-900 transition-colors"
                      >
                        <ChevronLeft className="size-3.5" /> Kembali
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => (step === 2 ? onFinish() : goTo(step + 1))}
                  className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white transition-all shadow-xs active:scale-[0.99] ${
                    step === 2
                      ? 'bg-[#A9000C] hover:bg-[#8E000A]'
                      : 'bg-ink-900 hover:bg-ink-700'
                  }`}
                >
                  <span>{step === 2 ? 'Masuk ke Akun Daisuki' : 'Lanjutkan'}</span>
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
