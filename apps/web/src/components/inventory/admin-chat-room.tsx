import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'radix-ui'
import { ArrowUp, Loader2, Menu, MessageSquare, Plus, Sparkles, Trash2, X } from 'lucide-react'
import {
  askAdminAssistant, deleteAdminChatSession, endAdminAssistantSession, getAdminChatSession, getAdminChatSessions,
  reopenAdminChatSession,
  type MitraChatHistoryItem, type MitraChatSession,
} from '@/lib/api/assistant'
import { AssistantMessageText } from '@/components/inventory/mitra-ai-assistant'

type Message = { id: string; author: 'admin' | 'assistant'; text: string }

const ADMIN_QUICK_CHIPS = [
  'Ringkasan stok pusat & cabang kritis',
  'Daftar pesanan menunggu persetujuan',
  'Analisis model Naive Bayes & risiko wilayah',
  'Jelaskan temuan Karya Ilmiah Hudzaifah',
]

export function AdminChatRoom({ sessionId, onSelectSession, onNewSession }: {
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
    const list = await getAdminChatSessions()
    setSessions(list)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessages([])
    setSummary(null)
    setError('')
    feedRef.current?.scrollTo({ top: 0 })
    void Promise.all([getAdminChatSessions(), getAdminChatSession(sessionId)]).then(([list, history]) => {
      if (cancelled) return
      setSessions(list)
      setMessages(history.data.flatMap((item: MitraChatHistoryItem) => [
        { id: `${item.id}-user`, author: 'admin' as const, text: item.message },
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
  }, [busy, ending, messages.length])

  async function send(textToSend?: string) {
    const message = (textToSend ?? draft).trim()
    if (!message || busy || closed || togglingSessionId) return
    setDraft('')
    setError('')
    const optimisticId = crypto.randomUUID()
    setMessages((current) => [...current, { id: optimisticId, author: 'admin', text: message }])
    setBusy(true)
    try {
      const result = await askAdminAssistant(message, sessionId)
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
      await endAdminAssistantSession(sessionId)
      const [list, history] = await Promise.all([getAdminChatSessions(), getAdminChatSession(sessionId)])
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
      if (item.is_closed) await reopenAdminChatSession(item.session_id)
      else await endAdminAssistantSession(item.session_id)
      const list = await getAdminChatSessions()
      setSessions(list)
      if (item.session_id === sessionId) {
        const history = await getAdminChatSession(sessionId)
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
      await deleteAdminChatSession(deletedId)
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

  return (
    <section aria-label="Ruang chat Daisuki AI Admin" className="flex h-[calc(100dvh-12rem)] min-h-[460px] overflow-hidden rounded-2xl border border-line bg-white shadow-xs sm:h-[calc(100dvh-11rem)]">
      {sidebarOpen ? <button type="button" aria-label="Tutup daftar sesi" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-ink-950/30 lg:hidden" /> : null}
      
      {/* Sidebar Daftar Sesi */}
      <aside className={`${sidebarOpen ? 'fixed inset-y-0 left-0 z-40 flex w-[min(84vw,320px)] flex-col' : 'hidden'} shrink-0 border-r border-line bg-paper/70 lg:relative lg:flex lg:w-72 lg:flex-col`}>
        <div className="flex items-center justify-between border-b border-line px-4 py-4">
          <div>
            <p className="dashboard-eyebrow">Daisuki Admin</p>
            <h2 className="font-display text-base font-bold text-ink-900">Riwayat Chat AI</h2>
          </div>
          <button type="button" onClick={() => setSidebarOpen(false)} aria-label="Tutup daftar sesi" className="grid size-11 place-items-center rounded-md lg:hidden"><X className="size-5" /></button>
        </div>
        <div className="p-3">
          <button type="button" onClick={() => { setSidebarOpen(false); onNewSession() }} className="flex min-h-11 w-full items-center gap-2 rounded-lg bg-ink-900 px-3 text-sm font-semibold text-white hover:bg-ink-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900">
            <Plus className="size-4" aria-hidden="true" /> Chat Baru
          </button>
        </div>
        <nav aria-label="Sesi percakapan admin" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {sessionActionError ? <p role="alert" className="px-2 py-2 text-xs text-crit-fg">{sessionActionError}</p> : null}
          {sessions.length === 0 ? <p className="px-2 py-4 text-sm text-muted">Belum ada percakapan tersimpan.</p> : null}
          {sessions.map((item) => (
            <div key={item.session_id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => { setSidebarOpen(false); onSelectSession(item.session_id) }}
                aria-current={item.session_id === sessionId ? 'page' : undefined}
                className={`flex min-h-14 min-w-0 flex-1 items-start gap-2 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 ${item.session_id === sessionId ? 'bg-ink-900 text-white' : 'text-ink-800 hover:bg-ink-100'}`}
              >
                <MessageSquare className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{item.title || 'Percakapan Analitik'}</span>
                  <span className={`mt-0.5 block text-xs ${item.session_id === sessionId ? 'text-white/75' : 'text-muted'}`}>
                    {item.message_count === 0 ? 'Ringkasan saja' : item.is_closed ? 'Selesai' : 'Aktif'} · {new Date(item.last_at).toLocaleDateString('id-ID')}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => void toggleSession(item)}
                disabled={deleting || busy || ending || Boolean(togglingSessionId) || (item.is_closed && item.message_count === 0)}
                aria-label={`${item.is_closed ? 'Buka kembali' : 'Tutup'} sesi ${item.title || 'Percakapan'}`}
                title={item.is_closed && item.message_count === 0 ? 'Sesi lama hanya memiliki ringkasan' : item.is_closed ? 'Buka kembali sesi' : 'Tutup sesi'}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 disabled:opacity-40"
              >
                {togglingSessionId === item.session_id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : item.is_closed ? 'Buka' : 'Tutup'}
              </button>
              <button
                type="button"
                onClick={() => { setDeleteError(''); setDeleteTarget(item) }}
                disabled={deleting || busy || ending || Boolean(togglingSessionId)}
                aria-label={`Hapus sesi ${item.title || 'Percakapan'}`}
                title="Hapus sesi"
                className="grid size-11 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-crit-bg hover:text-crit-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crit disabled:opacity-40"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Conversation Feed */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-line px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Buka daftar sesi" className="grid size-11 shrink-0 place-items-center rounded-md lg:hidden"><Menu className="size-5" /></button>
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-900 text-white">
              <Sparkles className="size-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-base font-bold text-ink-900">Daisuki Admin AI Assistant</h1>
              <p className="truncate text-xs text-muted">
                {closed ? 'Sesi selesai' : 'Asisten data realtime, model daisuki.pkl, & dokumen penelitian'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void closeSession()}
            disabled={busy || ending || closed || Boolean(togglingSessionId) || messages.length === 0}
            className="min-h-11 shrink-0 rounded-md px-3 text-xs font-semibold text-ink-700 hover:bg-ink-100 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
          >
            {ending ? 'Meringkas...' : closed ? 'Selesai' : 'Akhiri Chat'}
          </button>
        </header>

        <div ref={feedRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-8" aria-live="polite">
          {loading ? <p role="status" className="text-sm text-muted">Memuat percakapan...</p> : null}
          
          {!loading && messages.length === 0 && !closed ? (
            <div className="mx-auto max-w-2xl py-8 text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-ink-100 text-ink-900">
                <Sparkles className="size-8 text-amber-500" />
              </div>
              <h2 className="mt-4 font-display text-2xl font-bold text-ink-900">Asisten Cerdas Admin Pusat</h2>
              <p className="mt-2 text-sm text-muted max-w-lg mx-auto">
                Tanyakan data real-time gudang pusat, status stok seluruh cabang mitra, antrean pesanan, hasil klasifikasi model <code className="font-mono text-xs bg-ink-100 px-1.5 py-0.5 rounded text-ink-800">daisuki.pkl</code>, hingga analisis dokumen penelitian/karya ilmiah.
              </p>

              {/* Quick suggestion chips */}
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {ADMIN_QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => void send(chip)}
                    className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-xs font-medium text-ink-800 hover:border-ink-900 hover:bg-white transition-colors focus-visible:outline-2 focus-visible:outline-ink-900"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((item) => (
            <div key={item.id} className={`flex max-w-3xl gap-3 ${item.author === 'admin' ? 'ml-auto justify-end' : ''}`}>
              {item.author === 'assistant' ? (
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-900 text-white">
                  <Sparkles className="size-4 text-amber-300" />
                </div>
              ) : null}
              <div className={`max-w-[85%] break-words rounded-2xl px-4 py-3 text-sm leading-relaxed ${item.author === 'admin' ? 'whitespace-pre-wrap bg-ink-900 text-white' : 'bg-paper text-ink-900'}`}>
                {item.author === 'assistant' ? <AssistantMessageText text={item.text} /> : item.text}
              </div>
            </div>
          ))}

          {busy ? (
            <div className="flex max-w-3xl items-center gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-ink-900 text-white">
                <Sparkles className="size-4 text-amber-300" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-paper px-4 py-3 text-sm text-muted">
                <Loader2 className="size-4 animate-spin text-ink-800" />
                <span>Menganalisis data & menyusun jawaban...</span>
              </div>
            </div>
          ) : null}

          {summary ? (
            <aside aria-label="Ringkasan sesi" className="mx-auto max-w-2xl rounded-xl border border-line bg-paper/60 p-4 text-xs text-ink-700">
              <strong className="block font-semibold text-ink-900">Ringkasan Sesi:</strong>
              <p className="mt-1 leading-relaxed">{summary}</p>
            </aside>
          ) : null}

          {error ? <p role="alert" className="text-center text-xs text-crit-fg">{error}</p> : null}
        </div>

        {/* Footer Chat Input */}
        <footer className="border-t border-line p-3 sm:p-4">
          {closed ? (
            <p className="text-center text-xs text-muted">
              Sesi ini telah diakhiri. Buka kembali sesi dari sidebar atau buat chat baru untuk melanjutkan percakapan.
            </p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); void send() }} className="flex items-end gap-2">
              <label htmlFor="admin-chat-draft" className="sr-only">Tulis pertanyaan analitik untuk AI Assistant</label>
              <textarea
                id="admin-chat-draft"
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
                placeholder="Tanyakan stok pusat, cabang kritis, model ML, atau dokumen penelitian..."
                disabled={busy}
                className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-muted focus:border-ink-900 focus:bg-white focus:outline-hidden"
              />
              <button
                type="submit"
                disabled={!draft.trim() || busy}
                aria-label="Kirim pesan"
                className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink-900 text-white transition-opacity hover:bg-ink-800 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-5" />}
              </button>
            </form>
          )}
        </footer>
      </div>

      {/* Modal Konfirmasi Hapus Sesi */}
      <Dialog.Root open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-950/40 backdrop-blur-xs" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-white p-6 shadow-xl focus:outline-hidden">
            <Dialog.Title className="font-display text-lg font-bold text-ink-900">Hapus Sesi Chat?</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-ink-700">
              Percakapan <strong className="text-ink-900">"{deleteTarget?.title || 'Percakapan'}"</strong> beserta seluruh pesan dan ringkasannya akan dihapus permanen. Sesi chat lain tidak terpengaruh.
            </Dialog.Description>
            {deleteError ? <p role="alert" className="mt-3 text-xs text-crit-fg">{deleteError}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="min-h-11 rounded-lg border border-line px-4 text-xs font-semibold text-ink-800 hover:bg-ink-100 disabled:opacity-40"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="flex min-h-11 items-center gap-2 rounded-lg bg-crit px-4 text-xs font-semibold text-white hover:bg-crit-fg disabled:opacity-40"
              >
                {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                <span>{deleting ? 'Menghapus...' : 'Ya, Hapus'}</span>
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  )
}
