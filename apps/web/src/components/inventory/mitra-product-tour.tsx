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
    { tab: 'history', target: 'delivery-order-card', fallback: 'order-history-list', title: 'Pilih kiriman yang tiba', description: 'Buka detail pesanan Dalam Pengiriman. Jika belum ada kiriman, tunggu admin pusat mengubah statusnya.' },
    { tab: 'history', target: 'delivery-confirm-button', fallback: 'order-history-list', title: 'Buka pemindai resi', description: 'Saat dus fisik sudah tiba, tekan tombol pindai pada detail pesanan. Jika tombol belum ada, belum ada kiriman yang bisa diterima.' },
    { tab: 'history', target: 'delivery-confirm-button', fallback: 'order-history-list', title: 'Verifikasi barang fisik', description: 'Pindai barcode atau masukkan kode resi pada dus. Setelah verifikasi berhasil, status menjadi Selesai dan stok toko bertambah sesuai jumlah disetujui.' },
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
  const [isScrolling, setIsScrolling] = useState(false)
  const [dialogHeight, setDialogHeight] = useState(240)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousTabRef = useRef<MitraTab | null>(null)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const step = tours[tour][index]

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    return () => previous?.focus()
  }, [])

  // Pantau ukuran aktual dialog popover agar kalkulasi posisi selalu presisi tanpa terpotong
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

    // Jika berpindah tab, bersihkan rect sebentar agar tidak ada glitch posisi.
    // Jika pada tab yang sama, pertahankan rect agar animasi perpindahan spotlight meluncur halus (smooth glide).
    if (isTabSwitching) {
      setRect(null)
    }
    setUsingFallback(false)

    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let active = true

    const measure = (shouldScroll = true) => {
      if (!active) return
      const target = visibleTarget(step.target)
      const fallback = target ? null : (step.fallback ? visibleTarget(step.fallback) : null)
      const element = target ?? fallback
      if (element) {
        if (shouldScroll) {
          element.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
        const bounds = element.getBoundingClientRect()
        setRect(bounds)
        setUsingFallback(Boolean(fallback))
      } else if (isTabSwitching) {
        setRect(null)
      }
      if (!target && attempts < 35) {
        attempts += 1
        timer = setTimeout(() => measure(true), 150)
      }
    }

    // Interval bertahap agar saat smooth scroll dan rendering selesai, posisi tetap presisi
    timer = setTimeout(() => {
      measure(true)
      // Pengukuran susulan saat animasi scroll selesai
      setTimeout(() => measure(false), 220)
      setTimeout(() => measure(false), 450)
    }, isTabSwitching ? 120 : 30)

    // Gunakan requestAnimationFrame throttling agar event scroll di mobile (60-120fps) tidak patah-patah
    let rafId: number | null = null
    const refresh = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (!active) return
        const target = visibleTarget(step.target) ?? (step.fallback ? visibleTarget(step.fallback) : null)
        if (target) {
          setRect(target.getBoundingClientRect())
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

    return () => {
      active = false
      clearTimeout(timer)
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      if (rafId !== null) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', refresh)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [index, step, tour, onTabChange, onDeliveryStepChange])

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

  // Hitung posisi dinamis tooltip dengan pertimbangan safe area mobile dan floating nav bar
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const vw = typeof window !== 'undefined' ? window.innerWidth : 375
  const isMobile = vw < 640
  const topSafeBoundary = 16
  const bottomSafeBoundary = isMobile ? 84 : 24
  const dialogW = isMobile ? Math.min(448, vw - 24) : Math.min(448, vw - 32)
  const minDialogTop = topSafeBoundary
  const maxDialogTop = Math.max(topSafeBoundary, vh - bottomSafeBoundary - dialogHeight)

  const isTargetInViewport = Boolean(
    rect &&
    rect.bottom > topSafeBoundary &&
    rect.top < vh - bottomSafeBoundary
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

  const dialogPositionStyle: React.CSSProperties = rect
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
          className={`pointer-events-none fixed rounded-xl border-2 border-white will-change-[top,left,width,height] ${
            isScrolling
              ? 'transition-none'
              : 'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]'
          }`}
          style={{
            left: Math.max(4, rect.left - 6),
            top: Math.max(4, rect.top - 6),
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(12, 16, 36, 0.72)',
          }}
          aria-hidden="true"
        />
      ) : null}
      <div className="absolute inset-0" aria-hidden="true" />
      <div
        ref={dialogRef}
        style={rect ? dialogPositionStyle : undefined}
        className={`fixed z-10 overflow-y-auto rounded-2xl border border-line bg-white p-4.5 shadow-float sm:p-5 will-change-[top,bottom,left,transform] ${
          isScrolling
            ? 'transition-none'
            : 'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]'
        } ${
          rect
            ? ''
            : 'inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] mx-auto max-h-[min(44dvh,310px)] max-w-md sm:bottom-6'
        }`}
      >
        {rect && isTargetInViewport ? (
          <div
            className={`pointer-events-none absolute size-3.5 rotate-45 bg-white transition-all duration-300 ease-out ${
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
            className="-m-2 grid size-10 shrink-0 place-items-center rounded-full text-ink-600 hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-ink-700 active:scale-95 transition-transform"
          >
            <X className="size-4.5" />
          </button>
        </div>
        <div key={index} className="animate-in fade-in-50 duration-200">
          <h2 id="mitra-tour-title" className="mt-2 font-display text-base sm:text-lg font-semibold text-ink-900 leading-snug">
            {step.title}
          </h2>
          <p id="mitra-tour-description" className="mt-1.5 text-xs sm:text-sm leading-relaxed text-text">
            {step.description}
          </p>
        </div>
        {usingFallback || !rect ? (
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
