import { useState } from 'react'
import { BarChart3, CheckCircle2, Download, FileText, PieChart, Sparkles } from 'lucide-react'
import { generateDaisukiPdf, type PdfExportData } from '@/lib/pdf/sales-report-pdf'

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

export function ChatToolChart({ data }: { data: ChartToolData }) {
  const items = data.data || []
  if (items.length === 0) return null

  const isPie = data.type === 'pie'
  const maxValue = Math.max(...items.map((i) => i.value), 1)
  const totalValue = items.reduce((acc, i) => acc + i.value, 0) || 1

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-line bg-surface/80 p-3.5 shadow-xs transition-all">
      <div className="mb-3 flex items-center justify-between border-b border-line/60 pb-2">
        <div className="flex items-center gap-2">
          {isPie ? (
            <PieChart className="size-4 text-accent-500" />
          ) : (
            <BarChart3 className="size-4 text-accent-500" />
          )}
          <span className="font-display text-xs font-bold text-ink-900">
            {data.title || 'Visualisasi Data'}
          </span>
        </div>
        {data.unit_label && (
          <span className="rounded-md bg-paper px-2 py-0.5 font-mono text-[10px] text-ink-500">
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
                  const color = item.color || ['#f97316', '#eab308', '#06b6d4', '#8b5cf6'][idx % 4]
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
              const color = item.color || ['#f97316', '#eab308', '#06b6d4', '#8b5cf6'][idx % 4]
              return (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="font-medium text-ink-800">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="font-semibold text-ink-900">
                      {item.formatted_value || item.value.toLocaleString('id-ID')}
                    </span>
                    <span className="text-[10px] text-ink-400">({pct}%)</span>
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
            const color = item.color || ['#f97316', '#eab308', '#06b6d4', '#8b5cf6'][idx % 4]
            return (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-ink-800">{item.label}</span>
                  <span className="font-semibold tabular-nums text-ink-900">
                    {item.formatted_value || item.value.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-line/60">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: color }}
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
    <div className="my-3.5 overflow-hidden rounded-xl border border-line bg-gradient-to-br from-white via-surface to-accent-50/30 p-4 shadow-sm transition-all hover:border-accent-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-red-50 text-red-600 ring-1 ring-red-200/60">
            <FileText className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="font-display text-sm font-bold text-ink-950">{title}</h4>
            </div>
            <p className="text-[11px] text-ink-500">
              {partner} • Periode: <span className="font-medium text-ink-700">{period}</span>
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200/50">
          <Sparkles className="size-3" />
          Siap Cetak
        </span>
      </div>

      {/* Metrics pills if present */}
      {(data.summary_metrics?.total_units_sold != null || totalRev) && (
        <div className="mt-3.5 flex flex-wrap gap-2 pt-2 border-t border-line/60">
          {data.summary_metrics?.total_units_sold != null && (
            <div className="flex-1 min-w-[120px] rounded-lg bg-surface/80 px-2.5 py-1.5 border border-line/50">
              <div className="text-[10px] text-ink-400">Total Terjual</div>
              <div className="font-display text-xs font-bold text-ink-900 tabular-nums">
                {data.summary_metrics.total_units_sold.toLocaleString('id-ID')} pcs
              </div>
            </div>
          )}
          {totalRev && (
            <div className="flex-1 min-w-[120px] rounded-lg bg-accent-50/50 px-2.5 py-1.5 border border-accent-100/60">
              <div className="text-[10px] text-accent-700">Estimasi Omset</div>
              <div className="font-display text-xs font-bold text-accent-950 tabular-nums">
                {totalRev}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Items Count Preview */}
      {data.items && data.items.length > 0 && (
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-ink-500">
          <span>Memuat rincian {data.items.length} produk resmi Daisuki</span>
          <span className="font-mono text-[10px] text-ink-400">{data.file_name || 'Laporan.pdf'}</span>
        </div>
      )}

      {/* Download Action Button (Min 44px height for mobile accessibility) */}
      <div className="mt-3.5 pt-1">
        <button
          type="button"
          onClick={handleDownload}
          disabled={loading}
          className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold shadow-xs transition-all ${
            downloaded
              ? 'bg-emerald-600 text-white'
              : 'bg-ink-900 text-white hover:bg-ink-800 active:scale-[0.99]'
          }`}
        >
          {downloaded ? (
            <>
              <CheckCircle2 className="size-4" />
              <span>Dokumen PDF Berhasil Diunduh!</span>
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
