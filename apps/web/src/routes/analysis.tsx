import { createFileRoute, Link, Navigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { actionAnalysisRun, createAnalysisRun, createAnalysisTeamUser, getAnalysisRuns, type AnalysisRun } from '@/lib/api'
import { useAuth } from '@/lib/auth'

export const Route = createFileRoute('/analysis')({ component: AnalysisPage })

const statusName: Record<AnalysisRun['status'], string> = {
  creating: 'Membuat laporan', draft: 'Menunggu tinjauan', approved: 'Siap diproses',
  rejected: 'Ditolak', processing: 'Sedang diproses', published: 'Terbit', failed: 'Gagal',
}

function AnalysisPage() {
  const { user, isLoading, logout } = useAuth()
  const client = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [start, setStart] = useState(() => new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10))
  const [end, setEnd] = useState(() => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10))
  const [team, setTeam] = useState({ full_name: '', email: '', password: '', role: 'data_science' as 'data_science' | 'ai_engineer' })
  const runs = useQuery({ queryKey: ['analysis-runs'], queryFn: getAnalysisRuns,
    enabled: !!user && user.role !== 'mitra', refetchInterval: 3000 })

  if (isLoading) return <main className="grid min-h-dvh place-items-center" role="status">Memeriksa sesi...</main>
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'mitra') return <Navigate to="/mitra" replace />

  const perform = async (key: string, task: () => Promise<unknown>, success: string) => {
    setBusy(key)
    try {
      await task()
      toast.success(success)
      await client.invalidateQueries({ queryKey: ['analysis-runs'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Permintaan gagal')
    } finally { setBusy(null) }
  }

  return <main className="min-h-dvh bg-paper px-4 py-6 text-ink-900 sm:px-8 sm:py-10">
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ume">Daisuki · Analisis operasional</p>
          <h1 className="mt-2 font-display text-3xl font-semibold">Alur Data Science dan AI</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">Laporan bertanggal ditinjau Admin sebelum diproses AI Engineer. Hasil baru tampil setelah seluruh langkah lolos validasi.</p>
        </div>
        <div className="flex gap-2">
          {user.role === 'admin' && <Link to="/admin" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ume">Dashboard</Link>}
          <button type="button" onClick={() => void logout().then(() => { window.location.href = '/login' })} className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ume">Keluar</button>
        </div>
      </header>

      {user.role === 'data_science' && <form className="rounded-xl border border-line bg-white p-5" onSubmit={(event) => {
        event.preventDefault()
        void perform('create', () => createAnalysisRun(start, end), 'Laporan dibuat dan menunggu tinjauan Admin.')
      }}>
        <h2 className="font-display text-lg font-semibold">Buat laporan Data Science</h2>
        <p className="mt-1 text-sm text-muted">Periode inklusif, maksimal 31 hari. Sumber: log stok PostgreSQL.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-medium">Mulai<input required type="date" value={start} onChange={(event) => setStart(event.target.value)} className="min-h-11 rounded-lg border border-line px-3" /></label>
          <label className="grid gap-1 text-sm font-medium">Selesai<input required type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="min-h-11 rounded-lg border border-line px-3" /></label>
          <button disabled={busy !== null} className="min-h-11 rounded-lg bg-ink-900 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy === 'create' ? 'Membuat...' : 'Buat laporan'}</button>
        </div>
      </form>}

      <section className="space-y-3" aria-labelledby="run-title">
        <div className="flex items-center justify-between gap-3"><h2 id="run-title" className="font-display text-xl font-semibold">Riwayat laporan</h2><button type="button" onClick={() => void runs.refetch()} className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold">Segarkan</button></div>
        {runs.isLoading && <p role="status" className="text-sm text-muted">Memuat laporan...</p>}
        {runs.isError && <p role="alert" className="text-sm text-crit-fg">{runs.error instanceof Error ? runs.error.message : 'Gagal memuat laporan'}</p>}
        {runs.data?.runs.length === 0 && <p className="rounded-xl border border-line bg-white p-5 text-sm text-muted">Belum ada laporan. Data Science dapat membuat laporan untuk periode yang dipilih.</p>}
        {runs.data?.runs.map((run) => <article key={run.id} className="rounded-xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-semibold">{run.start_date} sampai {run.end_date}</h3><p className="mt-1 font-mono text-xs text-muted">Run {run.id}</p></div>
            <span className="rounded-full border border-line bg-ink-50 px-3 py-1 text-xs font-semibold">{run.is_active ? 'Aktif · ' : ''}{statusName[run.status]}</span>
          </div>
          <p className="mt-3 text-sm text-muted">{run.manifest ? `${run.manifest.partner_product_rows ?? 0} baris mitra-produk · ${run.manifest.product_count ?? 0} produk` : 'Laporan belum selesai dibuat'}{run.published_at ? ` · Terbit ${new Date(run.published_at).toLocaleString('id-ID')}` : ''}</p>
          {run.current_step && <p role="status" className="mt-2 text-sm">Langkah aktif: {run.current_step}</p>}
          {run.steps?.length > 0 && <ol className="mt-3 grid gap-1 text-xs sm:grid-cols-2">{run.steps.map((step, index) => <li key={step.label}>{index + 1}. {step.label}: {step.status === 'succeeded' ? 'selesai' : step.status === 'failed' ? 'gagal' : 'berjalan'}</li>)}</ol>}
          {run.error && <p role="alert" className="mt-3 text-sm text-crit-fg">{run.error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {user.role === 'admin' && run.status === 'draft' && <button type="button" disabled={busy !== null} onClick={() => void perform(run.id, () => actionAnalysisRun(run.id, 'approve'), 'Laporan disetujui.')} className="min-h-11 rounded-lg bg-ink-900 px-4 text-sm font-semibold text-white disabled:opacity-50">Setujui laporan</button>}
            {user.role === 'admin' && run.status === 'draft' && <button type="button" disabled={busy !== null} onClick={() => { const reason = window.prompt('Alasan penolakan laporan:'); if (reason?.trim()) void perform(run.id, () => actionAnalysisRun(run.id, 'reject', reason.trim()), 'Laporan ditolak.') }} className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold disabled:opacity-50">Tolak</button>}
            {user.role === 'ai_engineer' && run.status === 'approved' && <button type="button" disabled={busy !== null} onClick={() => void perform(run.id, () => actionAnalysisRun(run.id, 'process'), 'Pemrosesan AI dimulai.')} className="min-h-11 rounded-lg bg-ink-900 px-4 text-sm font-semibold text-white disabled:opacity-50">Proses laporan</button>}
            {user.role === 'admin' && run.status === 'published' && !run.is_active && <button type="button" disabled={busy !== null} onClick={() => void perform(run.id, () => actionAnalysisRun(run.id, 'rollback'), 'Hasil lama diaktifkan kembali.')} className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold disabled:opacity-50">Aktifkan kembali</button>}
          </div>
        </article>)}
      </section>

      {user.role === 'admin' && <form className="rounded-xl border border-line bg-white p-5" onSubmit={(event) => {
        event.preventDefault()
        void perform('team', () => createAnalysisTeamUser(team), 'Akun tim dibuat.')
      }}>
        <h2 className="font-display text-lg font-semibold">Akun tim analisis</h2>
        <p className="mt-1 text-sm text-muted">Akun Data Science membuat laporan; akun AI Engineer memproses laporan yang disetujui.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">Nama<input required minLength={2} value={team.full_name} onChange={(event) => setTeam({ ...team, full_name: event.target.value })} className="min-h-11 rounded-lg border border-line px-3" /></label>
          <label className="grid gap-1 text-sm font-medium">Email<input required type="email" value={team.email} onChange={(event) => setTeam({ ...team, email: event.target.value })} className="min-h-11 rounded-lg border border-line px-3" /></label>
          <label className="grid gap-1 text-sm font-medium">Kata sandi baru<input required type="password" minLength={12} autoComplete="new-password" value={team.password} onChange={(event) => setTeam({ ...team, password: event.target.value })} className="min-h-11 rounded-lg border border-line px-3" /></label>
          <label className="grid gap-1 text-sm font-medium">Peran<select value={team.role} onChange={(event) => setTeam({ ...team, role: event.target.value as typeof team.role })} className="min-h-11 rounded-lg border border-line px-3"><option value="data_science">Data Science</option><option value="ai_engineer">AI Engineer</option></select></label>
        </div>
        <button disabled={busy !== null} className="mt-4 min-h-11 rounded-lg bg-ink-900 px-4 text-sm font-semibold text-white disabled:opacity-50">Buat akun</button>
      </form>}
    </div>
  </main>
}
