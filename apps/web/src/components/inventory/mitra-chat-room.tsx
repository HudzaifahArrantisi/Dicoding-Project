import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'radix-ui'
import { ArrowUp, Loader2, LockKeyhole, LockKeyholeOpen, Menu, MessageSquare, Plus, Trash2, X } from 'lucide-react'
import {
  askMitraAssistant, deleteMitraChatSession, endMitraAssistantSession, getMitraChatSession, getMitraChatSessions,
  reopenMitraChatSession,
  type MitraChatHistoryItem, type MitraChatSession,
} from '@/lib/api/assistant'
import { AssistantMessageText } from '@/components/inventory/mitra-ai-assistant'

type Message = { id: string; author: 'mitra' | 'assistant'; text: string }

export function MitraChatRoom({ sessionId, onSelectSession, onNewSession }: {
  sessionId: string
  onSelectSession: (id: string) => void
  onNewSession: () => void
}) {
  const [sessions, setSessions] = useState<MitraChatSession[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [ending, setEnding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MitraChatSession | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [togglingSessionId, setTogglingSessionId] = useState<string | null>(null)
  const [sessionActionError, setSessionActionError] = useState('')
  const feedRef = useRef<HTMLDivElement>(null)
  const active = sessions.find((item) => item.session_id === sessionId)
  const closed = active?.is_closed ?? false

  async function refreshSessions() {
    const list = await getMitraChatSessions()
    setSessions(list)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessages([])
    setSummary(null)
    setError('')
    feedRef.current?.scrollTo({ top: 0 })
    void Promise.all([getMitraChatSessions(), getMitraChatSession(sessionId)]).then(([list, history]) => {
      if (cancelled) return
      setSessions(list)
      setMessages(history.data.flatMap((item: MitraChatHistoryItem) => [
        { id: `${item.id}-user`, author: 'mitra' as const, text: item.message },
        { id: item.id, author: 'assistant' as const, text: item.reply },
      ]))
      setSummary(history.summary)
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Riwayat chat belum dapat dimuat.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sessionId])

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [busy, ending])

  async function send() {
    const message = draft.trim()
    if (!message || busy || closed || togglingSessionId) return
    setDraft('')
    setError('')
    const optimisticId = crypto.randomUUID()
    setMessages((current) => [...current, { id: optimisticId, author: 'mitra', text: message }])
    setBusy(true)
    try {
      const result = await askMitraAssistant(message, sessionId)
      setMessages((current) => [...current, { id: result.interactionId, author: 'assistant', text: result.reply }])
      await refreshSessions()
    } catch (reason) {
      setMessages((current) => current.filter((item) => item.id !== optimisticId))
      setError(reason instanceof Error ? reason.message : 'Pesan belum terkirim.')
    } finally {
      setBusy(false)
    }
  }

  async function closeSession() {
    if (busy || ending || closed || togglingSessionId) return
    setEnding(true)
    setError('')
    try {
      await endMitraAssistantSession(sessionId)
      const [list, history] = await Promise.all([getMitraChatSessions(), getMitraChatSession(sessionId)])
      setSessions(list)
      setSummary(history.summary)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sesi belum dapat ditutup.')
    } finally {
      setEnding(false)
    }
  }

  async function toggleSession(item: MitraChatSession) {
    if (busy || ending || deleting || togglingSessionId || (item.is_closed && item.message_count === 0)) return
    setTogglingSessionId(item.session_id)
    setSessionActionError('')
    try {
      if (item.is_closed) await reopenMitraChatSession(item.session_id)
      else await endMitraAssistantSession(item.session_id)
      const list = await getMitraChatSessions()
      setSessions(list)
      if (item.session_id === sessionId) {
        const history = await getMitraChatSession(sessionId)
        setSummary(history.summary)
      }
    } catch (reason) {
      setSessionActionError(reason instanceof Error ? reason.message : 'Status sesi belum dapat diubah.')
    } finally {
      setTogglingSessionId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting || busy || ending || togglingSessionId) return
    const deletedId = deleteTarget.session_id
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteMitraChatSession(deletedId)
      setSessions((current) => current.filter((item) => item.session_id !== deletedId))
      setDeleteTarget(null)
      if (deletedId === sessionId) {
        setSidebarOpen(false)
        onNewSession()
      }
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : 'Sesi belum dapat dihapus.')
    } finally {
      setDeleting(false)
    }
  }

  return <section aria-label="Ruang chat Daisuki AI" className="flex h-[calc(100dvh-12rem)] min-h-[420px] overflow-hidden rounded-2xl border border-line bg-white shadow-xs sm:h-[calc(100dvh-11rem)]">
    {sidebarOpen ? <button type="button" aria-label="Tutup daftar sesi" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-ink-950/30 lg:hidden" /> : null}
    <aside className={`${sidebarOpen ? 'fixed inset-y-0 left-0 z-40 flex w-[min(84vw,320px)] flex-col' : 'hidden'} shrink-0 border-r border-line bg-paper/70 lg:relative lg:flex lg:w-72 lg:flex-col`}>
      <div className="flex items-center justify-between border-b border-line px-4 py-4">
        <div>
          <p className="dashboard-eyebrow">Daisuki AI</p>
          <h2 className="font-display text-base font-bold text-ink-900">Riwayat chat</h2>
        </div>
        <button type="button" onClick={() => setSidebarOpen(false)} aria-label="Tutup daftar sesi" className="grid size-11 place-items-center rounded-md lg:hidden"><X className="size-5" /></button>
      </div>
      <div className="p-3">
        <button type="button" onClick={() => { setSidebarOpen(false); onNewSession() }} className="flex min-h-11 w-full items-center gap-2 rounded-lg bg-ink-900 px-3 text-sm font-semibold text-white hover:bg-ink-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900">
          <Plus className="size-4" aria-hidden="true" /> Chat baru
        </button>
      </div>
      <nav aria-label="Sesi percakapan" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {sessionActionError ? <p role="alert" className="px-2 py-2 text-xs text-crit-fg">{sessionActionError}</p> : null}
        {sessions.length === 0 ? <p className="px-2 py-4 text-sm text-muted">Belum ada percakapan tersimpan.</p> : null}
        {sessions.map((item) => <div key={item.session_id} className="group flex items-center gap-1">
          <button type="button" onClick={() => { setSidebarOpen(false); onSelectSession(item.session_id) }} aria-current={item.session_id === sessionId ? 'page' : undefined}
            className={`flex min-h-14 min-w-0 flex-1 items-start gap-2 rounded-full px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 ${item.session_id === sessionId ? 'bg-ink-900 text-white' : 'text-ink-800 hover:bg-ink-100'}`}>
            <MessageSquare className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.title || 'Percakapan'}</span><span className={`mt-0.5 block text-xs ${item.session_id === sessionId ? 'text-white/75' : 'text-muted'}`}>{item.message_count === 0 ? 'Ringkasan saja' : item.is_closed ? 'Selesai' : 'Aktif'} · {new Date(item.last_at).toLocaleDateString('id-ID')}</span></span>
          </button>
          <button type="button" onClick={() => void toggleSession(item)} disabled={deleting || busy || ending || Boolean(togglingSessionId) || (item.is_closed && item.message_count === 0)}
            aria-label={`${item.is_closed ? 'Buka kembali' : 'Tutup'} sesi ${item.title || 'Percakapan'}`}
            title={item.is_closed && item.message_count === 0 ? 'Sesi lama hanya memiliki ringkasan' : item.is_closed ? 'Buka kembali sesi' : 'Tutup sesi'}
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 disabled:opacity-40">
            {togglingSessionId === item.session_id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : item.is_closed ? <LockKeyholeOpen className="size-4" aria-hidden="true" /> : <LockKeyhole className="size-4" aria-hidden="true" />}
          </button>
          <button type="button" onClick={() => { setDeleteError(''); setDeleteTarget(item) }} disabled={deleting || busy || ending || Boolean(togglingSessionId)}
            aria-label={`Hapus sesi ${item.title || 'Percakapan'}`} title="Hapus sesi"
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-crit-bg hover:text-crit-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crit disabled:opacity-40">
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>)}
      </nav>
    </aside>

    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex min-h-16 items-center justify-between gap-3 border-b border-line px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Buka daftar sesi" className="grid size-11 shrink-0 place-items-center rounded-md lg:hidden"><Menu className="size-5" /></button>
          <img src="/icons/logo.jpg" alt="" className="size-10 shrink-0 rounded-full object-cover" />
          <div className="min-w-0"><h1 className="truncate font-display text-base font-bold text-ink-900">Daisuki AI</h1><p className="truncate text-xs text-muted">{closed ? 'Sesi selesai' : 'Asisten stok dan pemesanan'}</p></div>
        </div>
        <button type="button" onClick={() => void closeSession()} disabled={busy || ending || closed || Boolean(togglingSessionId) || messages.length === 0} className="min-h-11 shrink-0 rounded-md px-3 text-xs font-semibold text-ink-700 hover:bg-ink-100 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900">
          {ending ? 'Meringkas...' : closed ? 'Selesai' : 'Akhiri chat'}
        </button>
      </header>
      <div ref={feedRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-8" aria-live="polite">
        {loading ? <p role="status" className="text-sm text-muted">Memuat percakapan...</p> : null}
        {!loading && messages.length === 0 && closed ? <div className="mx-auto max-w-xl rounded-xl border border-line bg-paper/70 p-5 text-sm text-ink-700" role="status"><h2 className="font-display font-bold text-ink-900">Transkrip sesi lama tidak tersedia</h2><p className="mt-2">Sesi ini dibuat sebelum riwayat pesan lengkap disimpan. Ringkasan yang tersisa ditampilkan di bawah; pesan yang sudah terhapus tidak dapat dimuat kembali.</p></div> : null}
        {!loading && messages.length === 0 && !closed ? <div className="mx-auto max-w-xl py-12 text-center"><img src="/icons/logo.jpg" alt="" className="mx-auto size-16 rounded-full object-cover" /><h2 className="mt-5 font-display text-2xl font-bold text-ink-900">Apa yang ingin Anda ketahui?</h2><p className="mt-2 text-sm text-muted">Tanyakan stok, restock, pengiriman, atau rangkuman kegiatan cabang.</p></div> : null}
        {messages.map((item) => <div key={item.id} className={`flex max-w-3xl gap-3 ${item.author === 'mitra' ? 'ml-auto justify-end' : ''}`}>
          {item.author === 'assistant' ? <img src="/icons/logo.jpg" alt="" className="size-8 shrink-0 rounded-full object-cover" /> : null}
          <div className={`max-w-[85%] break-words rounded-2xl px-4 py-3 text-sm leading-relaxed ${item.author === 'mitra' ? 'whitespace-pre-wrap bg-ink-900 text-white' : 'bg-paper text-ink-900'}`}>
            {item.author === 'assistant' ? <AssistantMessageText text={item.text} /> : item.text}
          </div>
        </div>)}
        {busy ? <p role="status" className="flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" /> Menyiapkan jawaban...</p> : null}
        {closed && summary ? <div className="mx-auto max-w-3xl rounded-xl border border-line bg-paper/70 p-4"><h2 className="font-display text-sm font-bold text-ink-900">Ringkasan sesi</h2><p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">{summary}</p></div> : null}
      </div>
      <div className="border-t border-line p-3 sm:p-4">
        {error ? <p role="alert" className="mb-2 text-sm text-crit-fg">{error}</p> : null}
        {closed ? <p className="text-center text-sm text-muted">Sesi ini selesai. Buka kembali dari riwayat untuk melanjutkan.</p> : <form onSubmit={(event) => { event.preventDefault(); void send() }} className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-line bg-paper/50 p-2 focus-within:border-ink-700">
          <label htmlFor="mitra-chat-input" className="sr-only">Tulis pesan ke Daisuki AI</label>
          <textarea id="mitra-chat-input" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} rows={2} placeholder="Tulis pertanyaan Anda..." disabled={busy || Boolean(togglingSessionId)} className="min-h-12 max-h-36 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-ink-900 outline-none placeholder:text-muted" />
          <button type="submit" disabled={busy || Boolean(togglingSessionId) || !draft.trim()} aria-label="Kirim pesan" className="grid size-11 shrink-0 place-items-center rounded-lg bg-ink-900 text-white disabled:opacity-40"><ArrowUp className="size-5" /></button>
        </form>}
        <p className="mt-2 text-center text-[11px] text-muted">Sesi {sessionId}</p>
      </div>
    </div>
    <Dialog.Root open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !deleting) { setDeleteTarget(null); setDeleteError('') } }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-950/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-white p-5 shadow-2xl focus:outline-none">
          <Dialog.Title className="font-display text-lg font-bold text-ink-900">Hapus sesi chat?</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted">
            Pesan dan ringkasan sesi <strong className="font-semibold text-ink-900">{deleteTarget?.title || 'Percakapan'}</strong> akan dihapus permanen dari riwayat Anda.
          </Dialog.Description>
          {deleteError ? <p role="alert" className="mt-3 text-sm text-crit-fg">{deleteError}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="min-h-11 rounded-md border border-line px-4 text-sm font-semibold text-ink-800 hover:bg-paper disabled:opacity-40">Batal</button>
            <button type="button" onClick={() => void confirmDelete()} disabled={deleting || Boolean(togglingSessionId)} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-crit-fg px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
              {deleting ? 'Menghapus...' : 'Hapus sesi'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </section>
}
