import type { AiRunStatus } from '@/lib/api'

export function AiPipelineChart({ status, pending, loading, onRun, buttonLabel = 'Buka alur analisis' }: {
  status?: AiRunStatus
  pending: boolean
  loading: boolean
  onRun: () => void
  buttonLabel?: string
}) {
  const days = status?.chart?.days ?? []
  const width = 680
  const height = 220
  const left = 42
  const top = 18
  const plotWidth = width - left - 18
  const plotHeight = height - top - 42
  const maxUnits = Math.max(1, ...days.map((day) => day.units))
  const yMax = Math.ceil(maxUnits / 5) * 5
  const points = days.map((day, index) => ({
    x: left + (days.length <= 1 ? plotWidth / 2 : index * plotWidth / (days.length - 1)),
    y: top + plotHeight * (1 - day.units / yMax),
  }))
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const model = status?.chart?.model
  const hasConsumption = days.some((day) => day.units > 0)

  return (
    <section className="dashboard-surface space-y-4 p-4 sm:p-5" aria-labelledby="python-analysis-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="python-analysis-title" className="font-display text-lg font-semibold text-ink-900">Analisis Python</h2>
          <p className="mt-1 text-sm text-muted">Perbarui grafik dan model dari CSV Data Science yang tersedia, atau data PostgreSQL.</p>
        </div>
        <button type="button" onClick={onRun} disabled={pending || status?.status === 'running'} className="inline-flex min-h-11 items-center justify-center rounded-md bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700 disabled:cursor-not-allowed disabled:opacity-50">
          {pending || status?.status === 'running' ? 'Analisis berjalan...' : buttonLabel}
        </button>
      </div>

      {status?.status === 'running' ? <p role="status" className="text-sm text-ink-700">Sedang menjalankan: {status.current_step ?? 'Menyiapkan proses'}</p> : null}
      {status?.status !== 'idle' && status?.training_source ? <p className="text-xs text-muted">Sumber training risiko: {status.training_source === 'data_science_csv' ? 'CSV Data Science' : 'PostgreSQL'}.</p> : null}
      {status?.status === 'failed' ? <p role="alert" className="text-sm text-crit-fg">Analisis gagal pada langkah {status.steps.find((step) => step.status === 'failed')?.label ?? 'Python'}. Periksa log API, lalu coba lagi.</p> : null}
      {status?.status === 'succeeded' ? <p role="status" className="text-sm text-ok-fg">Analisis selesai. Grafik menggunakan data dari proses terakhir.</p> : null}

      {status?.steps.length ? (
        <ol className="grid gap-2 text-sm sm:grid-cols-2" aria-label="Progres analisis Python">
          {status.steps.map((step, index) => (
            <li key={step.label} className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-ink-700">
              <span className="num text-xs text-muted">{index + 1}.</span>
              <span className="flex-1">{step.label}</span>
              <span className={step.status === 'failed' ? 'text-crit-fg' : step.status === 'succeeded' ? 'text-ok-fg' : 'text-ink-900'}>
                {step.status === 'failed' ? 'Gagal' : step.status === 'succeeded' ? 'Selesai' : 'Berjalan'}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {days.length ? (
        <div className="space-y-3 border-t border-line pt-4">
          <div>
            <h3 className="text-sm font-semibold text-ink-900">Konsumsi stok harian · 14 hari</h3>
            <p className="mt-1 text-xs text-muted">Unit berkurang pada laporan stok fisik; penerimaan barang tidak dihitung. Angka 0 berarti belum ada penurunan stok yang tercatat pada hari itu.</p>
          </div>
          {hasConsumption ? <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-labelledby="python-chart-title python-chart-desc">
            <title id="python-chart-title">Grafik garis konsumsi stok harian</title>
            <desc id="python-chart-desc">Konsumsi stok berdasarkan laporan fisik selama 14 hari terakhir.</desc>
            {[0, 0.5, 1].map((fraction) => {
              const y = top + plotHeight * (1 - fraction)
              return <g key={fraction}><line x1={left} x2={left + plotWidth} y1={y} y2={y} stroke="var(--color-line)" /><text x={left - 7} y={y + 4} textAnchor="end" className="fill-ink-700 text-[11px] tabular-nums">{Math.round(yMax * fraction)}</text></g>
            })}
            <path d={path} fill="none" stroke="var(--color-ink-700)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((point, index) => <g key={days[index].day}><circle cx={point.x} cy={point.y} r="3.5" fill="var(--color-ink-700)" /><title>{days[index].day}: {days[index].units} pcs</title></g>)}
            {days.filter((_, index) => index === 0 || index === days.length - 1 || index % 3 === 0).map((day) => {
              const index = days.indexOf(day)
              return <text key={day.day} x={points[index].x} y={height - 10} textAnchor={index === 0 ? 'start' : index === days.length - 1 ? 'end' : 'middle'} className="fill-ink-700 text-[11px]">{day.day.slice(5)}</text>
            })}
          </svg> : <p className="rounded-md border border-line bg-ink-50 p-3 text-sm text-muted">Belum ada penurunan stok yang tercatat selama 14 hari. Grafik akan muncul setelah mitra melaporkan perubahan stok.</p>}
          {hasConsumption ? <details className="text-xs text-ink-700"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-ink-700">Lihat angka harian</summary><ul className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4">{days.map((day) => <li key={day.day} className="num">{day.day}: {day.units} pcs</li>)}</ul></details> : null}
          {model?.available ? <p className="text-xs text-muted">daisuki.pkl mengklasifikasikan <span className="num">{model.sample_count}</span> pasangan mitra-produk saat analisis: <span className="num">{model.risk_counts.urgent_restock ?? 0}</span> mendesak, <span className="num">{model.risk_counts.regular_order ?? 0}</span> perlu restock, <span className="num">{model.risk_counts.normal ?? 0}</span> normal.</p> : <p className="text-xs text-warn-fg">Model risiko daisuki.pkl belum tersedia; grafik konsumsi tetap berasal dari log stok.</p>}
        </div>
      ) : loading ? <p role="status" className="text-sm text-muted">Memuat status analisis...</p> : status?.status === 'idle' || !status ? <p className="text-sm text-muted">Grafik akan muncul setelah analisis pertama selesai.</p> : null}
    </section>
  )
}
