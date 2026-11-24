import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import type { MitraTour } from '@/lib/api/assistant'

export type MitraTab = 'stocks' | 'order' | 'history' | 'logs' | 'profile'

type TourStep = { tab: MitraTab; target: string; fallback?: string; title: string; description: string }

const tours: Record<MitraTour, TourStep[]> = {
  restock: [
    { tab: 'stocks', target: 'central-stock-card', title: 'Cek stok gudang pusat', description: 'Lihat jumlah barang yang siap dipesan sebelum membuat pengajuan.' },
    { tab: 'order', target: 'restock-item-input', title: 'Pilih barang dan jumlah', description: 'Tekan Tambah Pesanan, lalu isi kebutuhan toko. Stok toko tidak punya batas maksimum; jumlah pesanan mengikuti stok pusat yang tersedia.' },
    { tab: 'order', target: 'restock-note-input', title: 'Tambahkan catatan bila perlu', description: 'Tulis informasi pengiriman untuk admin pusat. Kolom ini boleh dikosongkan.' },
    { tab: 'order', target: 'submit-order-button', title: 'Kirim pengajuan', description: 'Periksa jumlah tiap barang, lalu kirim. Admin akan meninjau pesanan sebelum pengiriman.' },
  ],
  stock_report: [
    { tab: 'stocks', target: 'daily-report-card', title: 'Buka laporan stok toko', description: 'Bagian ini menunjukkan sisa stok fisik yang terakhir dilaporkan.' },
    { tab: 'stocks', target: 'daily-report-counter', fallback: 'daily-report-card', title: 'Sesuaikan jumlah fisik', description: 'Hitung barang yang benar-benar ada di toko. Gunakan tombol tambah, kurang, atau ketik angka stok.' },
    { tab: 'stocks', target: 'stock-status-badge', fallback: 'daily-report-card', title: 'Baca status stok', description: 'Aman, Waspada, dan Kritis dihitung dari buffer minimal. Buffer ini bukan kapasitas maksimum toko.' },
    { tab: 'stocks', target: 'save-stock-button', fallback: 'daily-report-card', title: 'Simpan laporan', description: 'Setelah angka sesuai kondisi fisik, simpan perubahan. Jika tidak ada angka yang berubah, tombol simpan tetap nonaktif.' },
  ],
  delivery: [
    { tab: 'history', target: 'order-history-list', title: 'Buka riwayat pesanan', description: 'Cari pesanan yang berstatus Dalam Pengiriman. Barang belum menambah stok toko pada tahap ini.' },
    { tab: 'history', target: 'delivery-order-card', fallback: 'order-history-list', title: 'Pilih kiriman yang tiba', description: 'Buka detail pesanan Dalam Pengiriman. Jika belum ada kiriman, kartu contoh akan menunjukkan letak dan bentuknya.' },
    { tab: 'history', target: 'delivery-confirm-button', fallback: 'order-history-list', title: 'Buka pemindai resi', description: 'Saat dus fisik tiba, buka detail pesanan lalu tekan Scan Barcode. Pada kartu contoh, tombol ini hanya menampilkan simulasi.' },
    { tab: 'history', target: 'delivery-scanner-viewfinder', title: 'Arahkan ke barcode resi', description: 'Pada penerimaan asli, area ini menampilkan kamera untuk membaca barcode atau QR pada resi. Pratinjau ini tidak menyalakan kamera.' },
    { tab: 'history', target: 'delivery-scanner-photo', title: 'Gunakan foto jika perlu', description: 'Jika kamera tidak bisa dipakai, unggah atau ambil foto barcode resi dari tombol ini. Dalam panduan, tombol tidak membuka kamera atau galeri.' },
    { tab: 'history', target: 'delivery-scanner-manual', title: 'Masukkan kode secara manual', description: 'Ketik kode resi yang tercetak pada dus jika barcode tidak terbaca. Kolom contoh ini tidak menyimpan kode.' },
    { tab: 'history', target: 'delivery-scanner-verify', title: 'Verifikasi penerimaan', description: 'Periksa barang fisik dan kode resi sebelum menekan Verifikasi penerimaan pada pesanan asli. Setelah berhasil, status menjadi Selesai dan stok toko bertambah sesuai jumlah disetujui.' },
  ],
  logs: [
    { tab: 'history', target: 'order-history-list', title: 'Lihat status pesanan', description: 'Riwayat menampilkan status setiap pesanan serta catatan admin bila ada.' },
    { tab: 'logs', target: 'logs-tab', fallback: 'stock-log-panel', title: 'Baca log perubahan stok', description: 'Tab Log mencatat laporan stok fisik dan barang restock yang sudah diterima. Gunakan filter untuk mencari catatan.' },
  ],
  profile: [
    { tab: 'profile', target: 'profile-section', title: 'Periksa data toko', description: 'Pastikan nama penanggung jawab, nomor telepon, dan alamat cabang sudah benar.' },
    { tab: 'profile', target: 'profile-region', fallback: 'profile-section', title: 'Lengkapi wilayah', description: 'Pilih wilayah dari provinsi hingga desa atau kelurahan, lalu simpan agar tujuan pengiriman jelas.' },
  ],
}

function visibleTarget(name: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)
  return Array.from(candidates).find((element) => {
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }) ?? null
}

export function MitraProductTour({
  tour,
  onClose,
  onTabChange,
  onDeliveryStepChange,
}: {
  tour: MitraTour
  onClose: () => void
  onTabChange: (tab: MitraTab) => void
  onDeliveryStepChange: (step: number) => void
}) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [usingFallback, setUsingFallback] = useState(false)
  const [isLocating, setIsLocating] = useState(true)
  const [isScrolling, setIsScrolling] = useState(false)
  const [dialogHeight, setDialogHeight] = useState(240)
  const [viewport, setViewport] = useState({ width: 375, height: 800 })
  const [reducedMotion, setReducedMotion] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousTabRef = useRef<MitraTab | null>(null)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dialogHeightRef = useRef(dialogHeight)
  dialogHeightRef.current = dialogHeight
  const step = tours[tour][index]

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReducedMotion(media.matches)
    const updateViewport = () => setViewport({
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight,
    })
    updateMotion()
    updateViewport()
    media.addEventListener('change', updateMotion)
    window.addEventListener('resize', updateViewport)
    window.visualViewport?.addEventListener('resize', updateViewport)
    return () => {
      media.removeEventListener('change', updateMotion)
      window.removeEventListener('resize', updateViewport)
      window.visualViewport?.removeEventListener('resize', updateViewport)
    }
  }, [])

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    return () => previous?.focus()
  }, [])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const update = () => {
      setDialogHeight(el.offsetHeight || 240)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [index])

  useEffect(() => {
    const isTabSwitching = previousTabRef.current !== null && previousTabRef.current !== step.tab
    previousTabRef.current = step.tab

    onTabChange(step.tab)
    onDeliveryStepChange(tour === 'delivery' ? index : -1)

    if (isTabSwitching) {
      setRect(null)
    }
    setUsingFallback(false)
    setIsLocating(true)

    let attempts = 0
    const timers = new Set<ReturnType<typeof setTimeout>>()
    let active = true
    let scrolledElement: HTMLElement | null = null
    const schedule = (callback: () => void, delay: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer)
        callback()
      }, delay)
      timers.add(timer)
    }

    const measure = () => {
      if (!active) return
      const target = visibleTarget(step.target)
      const fallback = target ? null : (step.fallback ? visibleTarget(step.fallback) : null)
      const element = target ?? fallback
      if (element) {
        if (scrolledElement !== element) {
          scrolledElement = element
          element.scrollIntoView({ block: window.innerWidth < 640 ? 'start' : 'center', behavior: reducedMotion ? 'auto' : 'smooth' })
          schedule(() => {
            const bounds = element.getBoundingClientRect()
            const mobile = window.innerWidth < 640
            const visibleBottom = (window.visualViewport?.height ?? window.innerHeight) - (mobile ? 92 + dialogHeightRef.current + 24 : 24)
            if (mobile && bounds.top < 20 && bounds.height < visibleBottom - 20) {
              window.scrollBy({ top: bounds.top - 20, behavior: reducedMotion ? 'auto' : 'smooth' })
            } else if (mobile && bounds.bottom > visibleBottom) {
              window.scrollBy({ top: bounds.bottom - visibleBottom, behavior: reducedMotion ? 'auto' : 'smooth' })
            }
            refresh()
          }, reducedMotion ? 30 : 360)
        }
        const bounds = element.getBoundingClientRect()
        setRect(bounds)
        setUsingFallback(Boolean(fallback))
        setIsLocating(false)
      } else if (isTabSwitching) {
        setRect(null)
      }
      if (!target && attempts < 35) {
        attempts += 1
        schedule(measure, 150)
      } else if (!element) {
        setIsLocating(false)
      }
    }

    schedule(measure, isTabSwitching ? 120 : 30)

    let rafId: number | null = null
    const refresh = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (!active) return
        const target = visibleTarget(step.target) ?? (step.fallback ? visibleTarget(step.fallback) : null)
        if (target) {
          setRect(target.getBoundingClientRect())
          setUsingFallback(target.dataset.tour !== step.target)
        }
      })
    }

    const handleScroll = () => {
      setIsScrolling(true)
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = setTimeout(() => {
        setIsScrolling(false)
      }, 120)
      refresh()
    }

    window.addEventListener('resize', refresh, { passive: true })
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true })
    window.visualViewport?.addEventListener('resize', refresh)
    window.visualViewport?.addEventListener('scroll', refresh)

    return () => {
      active = false
      timers.forEach(clearTimeout)
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      if (rafId !== null) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', refresh)
      window.removeEventListener('scroll', handleScroll, true)
      window.visualViewport?.removeEventListener('resize', refresh)
      window.visualViewport?.removeEventListener('scroll', refresh)
    }
  }, [index, step, tour, onTabChange, onDeliveryStepChange, reducedMotion])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !dialogRef.current) return
      const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'))
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const last = index === tours[tour].length - 1

  const vh = viewport.height
  const vw = viewport.width
  const isMobile = vw < 640
  const topSafeBoundary = 16
  const bottomSafeBoundary = isMobile ? 84 : 24
  const sheetAtTop = Boolean(isMobile && rect &&
    rect.top > vh - bottomSafeBoundary - dialogHeight - 20 &&
    rect.top > dialogHeight + 32 &&
    rect.bottom < vh - bottomSafeBoundary)
  const spotlightTop = sheetAtTop ? dialogHeight + 28 : 0
  const spotlightBottom = isMobile && !sheetAtTop ? vh - bottomSafeBoundary - dialogHeight - 20 : vh - bottomSafeBoundary
  const dialogW = isMobile ? Math.min(448, vw - 24) : Math.min(448, vw - 32)
  const minDialogTop = topSafeBoundary
  const maxDialogTop = Math.max(topSafeBoundary, vh - bottomSafeBoundary - dialogHeight)

  const isTargetInViewport = Boolean(
    rect &&
    rect.top >= spotlightTop &&
    rect.bottom > topSafeBoundary &&
    rect.top < spotlightBottom &&
    (!isMobile || rect.bottom <= spotlightBottom)
  )

  let placeAbove = false
  let clampedTop = maxDialogTop
  let leftPos = Math.max(12, Math.min(vw - dialogW - 12, (vw - dialogW) / 2))
  let arrowLeft = 24

  if (rect && typeof window !== 'undefined') {
    const targetCenterX = rect.left + rect.width / 2
    leftPos = Math.max(12, Math.min(vw - dialogW - 12, targetCenterX - dialogW / 2))
    arrowLeft = Math.max(20, Math.min(dialogW - 20, targetCenterX - leftPos))

    if (isTargetInViewport) {
      const spaceAbove = rect.top - topSafeBoundary
      const spaceBelow = vh - bottomSafeBoundary - rect.bottom

      if (spaceBelow >= dialogHeight + 12) {
        // Cukup ruang di bawah elemen target
        placeAbove = false
        const desiredTop = rect.bottom + 12
        clampedTop = Math.max(minDialogTop, Math.min(maxDialogTop, desiredTop))
      } else if (spaceAbove >= dialogHeight + 12) {
        // Cukup ruang di atas elemen target
        placeAbove = true
        const desiredTop = rect.top - dialogHeight - 12
        clampedTop = Math.max(minDialogTop, Math.min(maxDialogTop, desiredTop))
      } else {
        // Ruang sempit: pilih sisi yang memiliki jarak sisa lebih besar
        const preferAbove = spaceAbove >= spaceBelow
        placeAbove = preferAbove
        const desiredTop = preferAbove ? rect.top - dialogHeight - 12 : rect.bottom + 12
        clampedTop = Math.max(minDialogTop, Math.min(maxDialogTop, desiredTop))
      }
    } else {
      // Elemen target tergulir ke luar layar
      if (rect.bottom <= topSafeBoundary) {
        // Target tergulir ke atas layar: posisikan tooltip di bawah agar tetap terlihat aman
        clampedTop = maxDialogTop
        placeAbove = false
      } else {
        // Target tergulir ke bawah layar: posisikan tooltip di atas agar tetap terlihat aman
        clampedTop = minDialogTop
        placeAbove = false
      }
    }
  }

  const dialogPositionStyle: React.CSSProperties = isMobile
    ? {
        ...(sheetAtTop ? { top: 'max(12px, env(safe-area-inset-top))' } : { bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }),
        left: '12px',
        width: 'calc(100vw - 24px)',
        maxHeight: 'min(44dvh, 340px)',
      }
    : rect
    ? {
        top: `${clampedTop}px`,
        left: `${leftPos}px`,
        width: `${dialogW}px`,
        maxHeight: `min(85dvh, calc(100dvh - ${topSafeBoundary + bottomSafeBoundary}px))`,
      }
    : {}

  return (
    <div className="fixed inset-0 z-[80] font-sans" role="dialog" aria-modal="true" aria-labelledby="mitra-tour-title" aria-describedby="mitra-tour-description">
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          rect && isTargetInViewport ? 'opacity-100' : 'bg-ink-900/75 opacity-90'
        }`}
        aria-hidden="true"
      />
      {rect && isTargetInViewport ? (
        <div
          className={`pointer-events-none fixed rounded-xl border-[3px] border-white ring-2 ring-amber-400 will-change-[top,left,width,height] ${
            isScrolling || reducedMotion
              ? 'transition-none'
              : 'transition-all duration-250 ease-out'
          }`}
          style={{
            left: Math.max(4, rect.left - 6),
            top: Math.max(4, rect.top - 6),
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(12, 16, 36, 0.78)',
          }}
          aria-hidden="true"
        />
      ) : null}
      <div className="absolute inset-0" aria-hidden="true" />
      <div
        ref={dialogRef}
        style={dialogPositionStyle}
        className={`fixed z-10 overflow-y-auto rounded-2xl border border-line bg-surface shadow-xs p-4 shadow-float sm:p-5 ${
          isScrolling || reducedMotion || isMobile
            ? 'transition-none'
            : 'transition-[top,left] duration-250 ease-out'
        } ${
          rect || isMobile
            ? ''
            : 'inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] mx-auto max-h-[min(44dvh,310px)] max-w-md sm:bottom-6'
        }`}
      >
        {rect && isTargetInViewport && !isMobile ? (
          <div
            className={`pointer-events-none absolute size-3.5 rotate-45 bg-surface transition-all duration-300 ease-out ${
              placeAbove
                ? '-bottom-1.5 border-r border-b border-line shadow-2xs'
                : '-top-1.5 border-l border-t border-line shadow-2xs'
            }`}
            style={{ left: `${arrowLeft}px`, transform: 'translateX(-50%) rotate(45deg)' }}
            aria-hidden="true"
          />
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-100/90 px-2.5 py-0.5 text-[11px] font-bold text-ink-800">
            Langkah {index + 1} dari {tours[tour].length}
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Tutup panduan"
            className="grid size-11 shrink-0 place-items-center rounded-full text-ink-600 hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 active:scale-95 transition-transform"
          >
            <X className="size-4.5" />
          </button>
        </div>
        <div key={index} className={reducedMotion ? '' : 'animate-in fade-in-50 duration-200'}>
          <h2 id="mitra-tour-title" className="mt-2 font-display text-base sm:text-lg font-semibold text-ink-900 leading-snug">
            {step.title}
          </h2>
          <p id="mitra-tour-description" className="mt-1.5 text-xs sm:text-sm leading-relaxed text-text">
            {step.description}
          </p>
        </div>
        {!rect && isLocating ? (
          <p className="mt-2 text-xs text-muted" role="status">Menyiapkan sorotan fitur...</p>
        ) : null}
        {usingFallback || (!rect && !isLocating) ? (
          <p className="mt-2 text-xs text-muted">
            Bagian ini belum tersedia pada kondisi toko saat ini. Kamu tetap bisa lanjut ke langkah berikutnya.
          </p>
        ) : null}
        {rect && !isTargetInViewport ? (
          <p className="mt-2 text-xs text-muted">
            Bagian ini tergulir di luar layar. Gulir halaman untuk melihatnya atau tekan Lanjut.
          </p>
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-3 pt-2 border-t border-line/60">
          <button
            type="button"
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
            disabled={index === 0}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line px-3.5 text-xs sm:text-sm font-semibold text-ink-700 disabled:opacity-30 hover:bg-ink-50 active:scale-98 transition-all focus-visible:outline-2 focus-visible:outline-ink-700"
          >
            <ArrowLeft className="size-3.5" /> Mundur
          </button>
          <button
            type="button"
            onClick={last ? onClose : () => setIndex((value) => value + 1)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-ink-900 px-4.5 text-xs sm:text-sm font-semibold text-white hover:bg-ink-800 active:scale-98 shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
          >
            {last ? 'Selesai' : 'Lanjut'}
            {last ? null : <ArrowRight className="size-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
