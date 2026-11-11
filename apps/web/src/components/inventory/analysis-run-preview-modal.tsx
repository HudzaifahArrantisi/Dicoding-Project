import { Dialog } from 'radix-ui'
import { CheckCircle2, FileJson, FileText, Loader2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AnalysisArtifacts, AnalysisRun } from '@/lib/api'

export function AnalysisRunPreviewModal({
  run,
  artifacts,
  loading,
  open,
  continuing,
  onOpenChange,
  onContinue,
}: {
  run: AnalysisRun | null
  artifacts?: AnalysisArtifacts
  loading: boolean
  open: boolean
  continuing: boolean
  onOpenChange: (open: boolean) => void
  onContinue: () => void
}) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/55 backdrop-blur-xs" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100%-1rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-line bg-white shadow-2xl focus:outline-none sm:w-[calc(100%-2rem)]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <Dialog.Title className="font-display text-xl font-semibold text-ink-900">Pratinjau hasil Data Science</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted">Periksa tiga file laporan sebelum AI menjalankan Naive Bayes, training model, dan grafik.</Dialog.Description>
            {run && <p className="mt-2 font-mono text-xs text-muted">{run.start_date} sampai {run.end_date} · Run {run.id}</p>}
          </div>
          <Dialog.Close asChild><button type="button" className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-ink-700" aria-label="Tutup pratinjau"><X className="size-5" /></button></Dialog.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? <div className="flex items-center gap-2 py-12 text-sm text-muted" role="status"><Loader2 className="size-4 animate-spin" /> Memuat file laporan...</div> : artifacts ? <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <FileCard icon={<FileJson className="size-4" />} label="JSON analitik" value={`${artifacts.manifest.partner_product_rows ?? 0} baris · ${artifacts.manifest.product_count ?? 0} produk`} />
              <FileCard icon={<FileText className="size-4" />} label="CSV handoff" value="Preview 15 baris pertama" />
              <FileCard icon={<FileText className="size-4" />} label="Laporan Markdown" value="Ringkasan eksekutif" />
            </div>
            <section className="rounded-lg border border-line p-4"><h3 className="text-sm font-semibold text-ink-900">Empat file kategori AI Insights</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{(['products', 'partners', 'regions', 'reporting'] as const).map((key) => <div key={key} className="flex items-center justify-between rounded-md bg-ink-50 px-3 py-2 text-xs"><span className="font-mono">category_{key}.json</span><span className="text-muted">{artifacts.categories[key]?.items.length ?? 0} baris</span></div>)}</div></section>
            <div className="grid gap-4 lg:grid-cols-2">
              <Preview title="weekly_analytics_summary.json"><pre className="max-h-72 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-ink-700">{JSON.stringify(artifacts.json, null, 2).slice(0, 12000)}</pre></Preview>
              <Preview title="weekly_analytics_report.md"><pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5 text-ink-700">{artifacts.markdown}</pre></Preview>
            </div>
            <Preview title="cleaned_inventory_summary.csv"><pre className="max-h-56 overflow-auto whitespace-pre text-[11px] leading-5 text-ink-700">{artifacts.csv_preview}</pre></Preview>
            {run?.steps?.length ? <section className="rounded-lg border border-line p-4" aria-label="Progres analisis AI"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-ink-900">Progres AI Engineer</h3><span className="text-xs text-muted">{run.steps.filter((step) => step.status === 'succeeded').length}/{run.steps.length} selesai</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-ink-900 transition-all" style={{ width: `${Math.round(run.steps.filter((step) => step.status === 'succeeded').length / Math.max(1, run.steps.length) * 100)}%` }} /></div><ol className="mt-3 grid gap-1 text-xs sm:grid-cols-2">{run.steps.map((step, index) => <li key={step.label} className={step.status === 'failed' ? 'text-crit-fg' : step.status === 'succeeded' ? 'text-ok-fg' : 'text-muted'}>{index + 1}. {step.label} · {step.status === 'succeeded' ? 'Selesai' : step.status === 'failed' ? 'Gagal' : 'Berjalan'}</li>)}</ol></section> : null}
          </div> : <p className="py-12 text-sm text-muted">File hasil analisis belum tersedia.</p>}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">AI hanya dapat memproses file dari run yang sama.</p>
          <div className="flex gap-2"><Dialog.Close asChild><button type="button" className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold">Tutup</button></Dialog.Close><button type="button" onClick={onContinue} disabled={!artifacts || continuing || !['draft', 'approved'].includes(run?.status ?? '')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{continuing ? <><Loader2 className="size-4 animate-spin" /> Menjalankan AI...</> : <><CheckCircle2 className="size-4" /> Lanjutkan dengan hasil file</>}</button></div>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}

function FileCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-lg border border-line bg-ink-50 p-3"><div className="flex items-center gap-2 text-sm font-semibold text-ink-900">{icon}{label}</div><p className="mt-1 text-xs text-muted">{value}</p></div>
}

function Preview({ title, children }: { title: string; children: ReactNode }) {
  return <section className="overflow-hidden rounded-lg border border-line"><h3 className="border-b border-line bg-ink-50 px-3 py-2 font-mono text-xs font-semibold text-ink-900">{title}</h3><div className="bg-white p-3">{children}</div></section>
}
