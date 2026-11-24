import { useState } from 'react'
import { ArrowRight, BarChart3, Check, CheckCircle2, Copy, Download, FileText, PieChart } from 'lucide-react'
import { generateDaisukiPdf, type PdfExportData } from '@/lib/pdf/sales-report-pdf'

export function CopyButton({
  text,
  label = 'Salin',
  className,
}: {
  text: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback if clipboard API is not available
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } finally {
        document.body.removeChild(textarea)
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Teks berhasil disalin' : 'Salin teks ke papan klip'}
      title={copied ? 'Tersalin ke clipboard!' : 'Salin teks'}
      className={
        className ??
        'inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-line/80 bg-surface/90 px-2.5 py-1 text-[11px] font-medium text-ink-700 shadow-2xs backdrop-blur-xs transition-colors hover:border-ink-400 hover:bg-surface hover:text-ink-950 focus-visible:outline-2 focus-visible:outline-ink-900 active:scale-95'
      }
    >
      {copied ? (
        <>
          <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
          <span className="font-semibold text-emerald-700">Tersalin</span>
        </>
      ) : (
        <>
          <Copy className="size-3.5 text-ink-500" aria-hidden="true" />
          <span>{label}</span>
        </>
      )}
    </button>
  )
}

export interface ChartToolData {
  type?: 'bar' | 'pie' | 'line'
  title?: string
  unit_label?: string
  data?: Array<{
    label: string
    value: number
    formatted_value?: string
    color?: string
  }>
}

const BRAND_SNACK_COLORS = ['#ea580c', '#e11d48', '#16a34a', '#78350f', '#0284c7']

export function ChatToolChart({ data }: { data: ChartToolData }) {
  const items = data.data || []
  if (items.length === 0) return null

  const isPie = data.type === 'pie'
  const maxValue = Math.max(...items.map((i) => i.value), 1)
  const totalValue = items.reduce((acc, i) => acc + i.value, 0) || 1

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-line bg-surface/60 p-3.5 shadow-xs">
      <div className="mb-3 flex items-center justify-between border-b border-line/60 pb-2">
        <div className="flex items-center gap-2">
          {isPie ? (
            <PieChart className="size-4 text-ink-700" />
          ) : (
            <BarChart3 className="size-4 text-ink-700" />
          )}
          <span className="font-display text-xs font-bold text-ink-950">
            {data.title || 'Visualisasi Data'}
          </span>
        </div>
        {data.unit_label && (
          <span className="rounded-md border border-line bg-paper px-2 py-0.5 text-[11px] text-muted">
            {data.unit_label}
          </span>
        )}
      </div>

      {isPie ? (
        // Pie / Donut Chart Representation with SVG and Legend
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex justify-center py-1">
            <svg viewBox="0 0 100 100" className="size-24 -rotate-90">
              {(() => {
                let cumulativeAngle = 0
                return items.map((item, idx) => {
                  const sliceAngle = (item.value / totalValue) * 360
                  const startAngle = cumulativeAngle
                  cumulativeAngle += sliceAngle
                  const x1 = 50 + 40 * Math.cos((Math.PI * startAngle) / 180)
                  const y1 = 50 + 40 * Math.sin((Math.PI * startAngle) / 180)
                  const x2 = 50 + 40 * Math.cos((Math.PI * (startAngle + sliceAngle)) / 180)
                  const y2 = 50 + 40 * Math.sin((Math.PI * (startAngle + sliceAngle)) / 180)
                  const largeArc = sliceAngle > 180 ? 1 : 0
                  const path =
                    items.length === 1 || sliceAngle >= 359.9
                      ? 'M 50 10 A 40 40 0 1 0 50 90 A 40 40 0 1 0 50 10'
                      : `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`
                  const color = item.color || BRAND_SNACK_COLORS[idx % BRAND_SNACK_COLORS.length]
                  return (
                    <path
                      key={idx}
                      d={path}
                      fill={color}
                      className="transition-opacity hover:opacity-85"
                    />
                  )
                })
              })()}
              <circle cx="50" cy="50" r="22" className="fill-surface" />
            </svg>
          </div>
          <div className="flex-1 space-y-1.5">
            {items.map((item, idx) => {
              const pct = Math.round((item.value / totalValue) * 100)
              const color = item.color || BRAND_SNACK_COLORS[idx % BRAND_SNACK_COLORS.length]
              return (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="font-medium text-ink-800">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="font-semibold text-ink-950">
                      {item.formatted_value || item.value.toLocaleString('id-ID')}
                    </span>
                    <span className="text-[11px] text-muted">({pct}%)</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        // Horizontal Bar Chart
        <div className="space-y-2.5 pt-1">
          {items.map((item, idx) => {
            const pct = Math.round((item.value / maxValue) * 100)
            const color = item.color || BRAND_SNACK_COLORS[idx % BRAND_SNACK_COLORS.length]
            return (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-ink-800">{item.label}</span>
                  <span className="font-semibold tabular-nums text-ink-950">
                    {item.formatted_value || item.value.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-line/60">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${item.value > 0 ? Math.max(pct, 3) : 0}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export interface FlowDiagramData {
  title: string
  direction: 'LR' | 'RL' | 'TB' | 'TD' | 'BT'
  edges: Array<{ from: string; to: string; label?: string }>
}

export function ChatToolFlowDiagram({ data }: { data: FlowDiagramData }) {
  const reverse = data.direction === 'RL' || data.direction === 'BT'
  const vertical = data.direction === 'TB' || data.direction === 'TD' || data.direction === 'BT'
  const arrowRotation = data.direction === 'RL' ? 'rotate-180' : data.direction === 'TB' || data.direction === 'TD' ? 'rotate-90' : data.direction === 'BT' ? '-rotate-90' : ''
  return (
    <figure aria-label={`Diagram alur: ${data.title}`} className="my-3 overflow-hidden rounded-xl border border-line bg-surface/60 p-3.5 shadow-xs">
      <figcaption className="mb-3 border-b border-line/60 pb-2 font-display text-xs font-bold text-ink-950">
        {data.title}
      </figcaption>
      <div className="space-y-2" role="list" aria-label="Hubungan antar langkah">
        {data.edges.map((edge, index) => (
          <div key={`${edge.from}-${edge.to}-${index}`} role="listitem" className={`flex flex-wrap ${vertical ? 'flex-col' : ''} items-center gap-2 rounded-lg bg-surface p-2.5 text-xs`}>
            <span className="rounded-lg border border-line bg-paper px-3 py-2 text-center font-semibold text-ink-900">{reverse ? edge.to : edge.from}</span>
            <span className="flex min-w-6 flex-col items-center text-accent-600" aria-label={`menuju ${edge.to}`}>
              {edge.label ? <span className="mb-0.5 text-[10px] text-muted">{edge.label}</span> : null}
              <ArrowRight className={`size-4 ${arrowRotation}`} aria-hidden="true" />
            </span>
            <span className="rounded-lg border border-line bg-paper px-3 py-2 text-center font-semibold text-ink-900">{reverse ? edge.from : edge.to}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted">Diagram alur</p>
    </figure>
  )
}

export function ChatToolPdfExport({ data }: { data: PdfExportData }) {
  const [downloaded, setDownloaded] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleDownload() {
    setLoading(true)
    setTimeout(() => {
      const ok = generateDaisukiPdf(data)
      setLoading(false)
      if (ok) {
        setDownloaded(true)
        setTimeout(() => setDownloaded(false), 4000)
      }
    }, 200)
  }

  const title = data.title || 'Laporan Rekapitulasi Penjualan & Omset'
  const partner = data.partner_name || 'Mitra Cabang'
  const period = data.period || '7 Hari Terakhir'
  const totalRev =
    data.summary_metrics?.formatted_revenue ||
    (data.summary_metrics?.total_revenue
      ? `Rp ${data.summary_metrics.total_revenue.toLocaleString('id-ID')}`
      : undefined)

  return (
    <div className="my-3.5 overflow-hidden rounded-xl border border-line bg-surface shadow-xs p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface shadow-xs text-ink-700">
            <FileText className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="font-display text-sm font-bold text-ink-950">{title}</h4>
            </div>
            <p className="text-[11px] text-muted">
              {partner} • Periode: <span className="font-medium text-ink-800">{period}</span>
            </p>
          </div>
        </div>
        <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
          Siap Cetak
        </span>
      </div>

      {/* Metrics pills if present */}
      {(data.summary_metrics?.total_units_sold != null || totalRev) && (
        <div className="mt-3.5 flex flex-wrap gap-2 pt-2 border-t border-line/60">
          {data.summary_metrics?.total_units_sold != null && (
            <div className="flex-1 min-w-[120px] rounded-lg bg-surface px-2.5 py-1.5 border border-line">
              <div className="text-[10px] text-muted">Total Terjual</div>
              <div className="font-display text-xs font-bold text-ink-950 tabular-nums">
                {data.summary_metrics.total_units_sold.toLocaleString('id-ID')} pcs
              </div>
            </div>
          )}
          {totalRev && (
            <div className="flex-1 min-w-[120px] rounded-lg bg-surface px-2.5 py-1.5 border border-line">
              <div className="text-[10px] text-muted">Estimasi Omset</div>
              <div className="font-display text-xs font-bold text-ink-950 tabular-nums">
                {totalRev}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Items Count Preview */}
      {data.items && data.items.length > 0 && (
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted">
          <span>Memuat rincian {data.items.length} produk resmi Daisuki</span>
          <span className="text-[11px] tabular-nums text-muted">{data.file_name || 'Laporan.pdf'}</span>
        </div>
      )}

      {/* Download Action Button (Min 44px height for mobile accessibility) */}
      <div className="mt-3.5 pt-1">
        <button
          type="button"
          onClick={handleDownload}
          disabled={loading}
          className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold shadow-xs transition-colors duration-150 ${
            downloaded
              ? 'bg-emerald-600 text-white'
              : 'bg-ink-900 text-white hover:bg-ink-800 active:scale-[0.99]'
          }`}
        >
          {downloaded ? (
            <>
              <CheckCircle2 className="size-4" />
              <span>Dokumen PDF Berhasil Diunduh</span>
            </>
          ) : (
            <>
              <Download className="size-4" />
              <span>{loading ? 'Menyiapkan Berkas PDF...' : 'Unduh Laporan PDF'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
