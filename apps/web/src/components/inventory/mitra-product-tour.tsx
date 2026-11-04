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
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const step = tours[tour][index]

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    return () => previous?.focus()
  }, [])

  useEffect(() => {
    onTabChange(step.tab)
    onDeliveryStepChange(tour === 'delivery' ? index : -1)
    setRect(null)
    setUsingFallback(false)

    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let active = true
    const measure = () => {
      if (!active) return
      const target = visibleTarget(step.target)
      const fallback = target ? null : (step.fallback ? visibleTarget(step.fallback) : null)
      const element = target ?? fallback
      if (element) {
        if (target || attempts === 0) element.scrollIntoView({ block: 'center', behavior: 'smooth' })
        const bounds = element.getBoundingClientRect()
        setRect(bounds)
        setUsingFallback(Boolean(fallback))
      } else {
        setRect(null)
      }
      if (!target && attempts < 40) {
        attempts += 1
        timer = setTimeout(measure, 250)
      }
    }
    timer = setTimeout(measure, 80)
    const refresh = () => {
      const target = visibleTarget(step.target) ?? (step.fallback ? visibleTarget(step.fallback) : null)
      if (target) setRect(target.getBoundingClientRect())
    }
    window.addEventListener('resize', refresh)
    window.addEventListener('scroll', refresh, true)
    return () => {
      active = false
      clearTimeout(timer)
      window.removeEventListener('resize', refresh)
      window.removeEventListener('scroll', refresh, true)
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
  return (
    <div className="fixed inset-0 z-[80] font-sans" role="dialog" aria-modal="true" aria-labelledby="mitra-tour-title" aria-describedby="mitra-tour-description">
      <div className={`absolute inset-0 ${rect ? '' : 'bg-ink-900/75'}`} aria-hidden="true" />
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-md border-2 border-white transition-all duration-200"
          style={{ left: Math.max(4, rect.left - 5), top: Math.max(4, rect.top - 5), width: rect.width + 10, height: rect.height + 10, boxShadow: '0 0 0 9999px rgba(12, 16, 36, 0.75)' }}
          aria-hidden="true"
        />
      ) : null}
      <div className="absolute inset-0" aria-hidden="true" />
      <div ref={dialogRef} className="fixed inset-x-3 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-10 mx-auto max-h-[min(44dvh,310px)] max-w-md overflow-y-auto rounded-xl border border-line bg-white p-4 shadow-float sm:bottom-6 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold text-ink-700">Langkah {index + 1} dari {tours[tour].length}</p>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Tutup panduan" className="-m-2 grid size-11 shrink-0 place-items-center rounded-md text-ink-700 hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-ink-700"><X className="size-5" /></button>
        </div>
        <h2 id="mitra-tour-title" className="font-display text-lg font-semibold text-ink-900">{step.title}</h2>
        <p id="mitra-tour-description" className="mt-2 text-sm leading-relaxed text-text">{step.description}</p>
        {usingFallback || !rect ? <p className="mt-2 text-xs text-muted">Bagian ini belum tersedia pada kondisi toko saat ini. Kamu tetap bisa lanjut ke langkah berikutnya.</p> : null}
        <div className="mt-4 flex justify-between gap-3">
          <button type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-line px-3 text-sm font-semibold text-ink-700 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ink-700"><ArrowLeft className="size-4" /> Mundur</button>
          <button type="button" onClick={last ? onClose : () => setIndex((value) => value + 1)} className="inline-flex min-h-11 items-center gap-1 rounded-md bg-ink-700 px-4 text-sm font-semibold text-white hover:bg-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700">{last ? 'Selesai' : 'Lanjut'}{last ? null : <ArrowRight className="size-4" />}</button>
        </div>
      </div>
    </div>
  )
}
