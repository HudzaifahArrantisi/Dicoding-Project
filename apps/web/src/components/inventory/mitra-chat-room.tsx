import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'radix-ui'
import {
  ArrowUp,
  BarChart2,
  CheckCircle2,
  FileDown,
  History,
  Inbox,
  Loader2,
  Menu,
  MessageSquare,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  PlayCircle,
  Plus,
  RefreshCw,
  Trash2,
  Truck,
  X,
} from 'lucide-react'
import {
  askMitraAssistant,
  deleteMitraChatSession,
  endMitraAssistantSession,
  getMitraChatSession,
  getMitraChatSessions,
  reopenMitraChatSession,
  type MitraChatHistoryItem,
  type MitraChatSession,
  type MitraStockVisualization,
  type MitraTour,
} from '@/lib/api/assistant'
import { AssistantMessageText } from '@/components/inventory/mitra-ai-assistant'
import { ChatToolChart } from '@/components/inventory/chat-tools'

type Message = { id: string; author: 'mitra' | 'assistant'; text: string; time?: string; tour?: MitraTour; tourLabel?: string; visualization?: MitraStockVisualization | null }

const TOUR_OPTIONS: { id: MitraTour; label: string }[] = [
  { id: 'stock_report', label: 'Laporan stok' },
  { id: 'restock', label: 'Ajukan restock' },
  { id: 'delivery', label: 'Terima barang' },
  { id: 'logs', label: 'Riwayat dan log' },
  { id: 'profile', label: 'Profil toko' },
]

const MITRA_SUGGESTION_CARDS = [
  {
    icon: Package,
    title: 'Cek Stok Toko Saya',
    desc: 'Periksa sisa stok 4 produk dan buffer pengaman di cabang Anda',
    prompt: 'Berapa sisa stok fisik 4 produk di toko saya saat ini?',
  },
  {
    icon: FileDown,
    title: 'Rekap Penjualan & PDF',
    desc: 'Hitung omset 7 hari terakhir dan unduh dokumen laporan resmi',
    prompt: 'Tolong buatkan rangkuman penjualan dan omset toko saya 7 hari terakhir, dan jadikan file PDF siap unduh.',
  },
  {
    icon: BarChart2,
    title: 'Grafik Komposisi Stok',
    desc: 'Visualisasikan proporsi stok produk toko dalam diagram',
    prompt: 'Tampilkan grafik visual perbandingan sisa stok produk di toko saya saat ini.',
  },
  {
    icon: Truck,
    title: 'Status Pesanan & Kiriman',
    desc: 'Lacak pesanan yang sedang diproses atau dalam pengiriman',
    prompt: 'Bagaimana status pesanan restock dan pengiriman barang untuk toko saya?',
  },
]

export function MitraChatRoom({
  sessionId,
  suggestedDraft,
  onDraftConsumed,
  onSelectSession,
  onNewSession,
  onStartTour,
}: {
  sessionId: string
  suggestedDraft?: string
  onDraftConsumed?: () => void
  onSelectSession: (id: string) => void
  onNewSession: () => void
  onStartTour: (tour: MitraTour) => void
}) {
  const [sessions, setSessions] = useState<MitraChatSession[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  useEffect(() => {
    if (!suggestedDraft) return
    setDraft(suggestedDraft)
    onDraftConsumed?.()
  }, [suggestedDraft, onDraftConsumed])
  const [pendingSessionIds, setPendingSessionIds] = useState<Set<string>>(() => new Set())
  const [ending, setEnding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const [tourMenuOpen, setTourMenuOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MitraChatSession | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [togglingSessionId, setTogglingSessionId] = useState<string | null>(null)
  const [sessionActionError, setSessionActionError] = useState('')
  const feedRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const activeSessionIdRef = useRef(sessionId)
  activeSessionIdRef.current = sessionId

  const active = sessions.find((item) => item.session_id === sessionId)
  const closed = active?.is_closed ?? false
  const busy = pendingSessionIds.has(sessionId)

  async function refreshSessions() {
    try {
      const list = await getMitraChatSessions()
      setSessions(list)
    } catch {
      // Ignored silently for background refreshes
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessages([])
    setSummary(null)
    setError('')
    setTourMenuOpen(false)
    feedRef.current?.scrollTo({ top: 0 })

    void Promise.all([getMitraChatSessions(), getMitraChatSession(sessionId)])
      .then(([list, history]) => {
        if (cancelled) return
        setSessions(list)
        setMessages(
          history.data.flatMap((item: MitraChatHistoryItem) => [
            {
              id: `${item.id}-user`,
              author: 'mitra' as const,
              text: item.message,
              time: new Date(item.created_at).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              }),
            },
            {
              id: item.id,
              author: 'assistant' as const,
              text: item.reply,
              tour: item.intent ?? undefined,
              visualization: item.visualization,
              time: new Date(item.created_at).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              }),
            },
          ]),
        )
        setSummary(history.summary)
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Riwayat chat belum dapat dimuat.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sessionId])

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [busy, ending, messages.length])

  async function send(textToSend?: string) {
    const message = (textToSend ?? draft).trim()
    if (!message || busy || closed || togglingSessionId) return
    const requestSessionId = sessionId
    setDraft('')
    setError('')

    const optimisticId = crypto.randomUUID()
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

    setMessages((current) => [
      ...current,
      { id: optimisticId, author: 'mitra', text: message, time: nowTime },
    ])
    setPendingSessionIds((current) => new Set(current).add(requestSessionId))

    try {
      const result = await askMitraAssistant(message, requestSessionId)
      if (activeSessionIdRef.current === requestSessionId) {
        setMessages((current) => current.some((item) => item.id === result.interactionId)
          ? current
          : [
              ...current,
              {
                id: result.interactionId,
                author: 'assistant',
                text: result.reply,
                tour: result.suggestedTour,
                tourLabel: result.tourLabel,
                visualization: result.visualization,
                time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
              },
            ])
      }
      await refreshSessions()
    } catch (reason) {
      if (activeSessionIdRef.current === requestSessionId) {
        setMessages((current) => current.filter((item) => item.id !== optimisticId))
        setError(reason instanceof Error ? reason.message : 'Pesan belum terkirim. Coba lagi.')
      }
    } finally {
      setPendingSessionIds((current) => {
        const next = new Set(current)
        next.delete(requestSessionId)
        return next
      })
      if (activeSessionIdRef.current === requestSessionId) textareaRef.current?.focus()
    }
  }

  async function closeSession() {
    if (busy || ending || closed || togglingSessionId) return
    setEnding(true)
    setError('')
    try {
      await endMitraAssistantSession(sessionId)
      const [list, history] = await Promise.all([
        getMitraChatSessions(),
        getMitraChatSession(sessionId),
      ])
      setSessions(list)
      setSummary(history.summary)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sesi belum dapat diakhiri.')
    } finally {
      setEnding(false)
    }
  }

  async function toggleSession(item: MitraChatSession) {
    if (
      ending ||
      deleting ||
      togglingSessionId ||
      pendingSessionIds.has(item.session_id) ||
      (item.is_closed && item.message_count === 0)
    )
      return
    setTogglingSessionId(item.session_id)
    setSessionActionError('')
    try {
      if (item.is_closed) {
        await reopenMitraChatSession(item.session_id)
      } else {
        await endMitraAssistantSession(item.session_id)
      }
      const list = await getMitraChatSessions()
      setSessions(list)
      if (item.session_id === sessionId) {
        const history = await getMitraChatSession(sessionId)
        setSummary(history.summary)
      }
    } catch (reason) {
      setSessionActionError(
        reason instanceof Error ? reason.message : 'Status sesi belum dapat diubah.',
      )
    } finally {
      setTogglingSessionId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting || ending || togglingSessionId || pendingSessionIds.has(deleteTarget.session_id)) return
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

  function renderSessionList(isMobile = false) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <div className="flex items-center gap-2">
            <History className="size-4 text-ink-700" />
            <h2 className="font-display text-sm font-bold text-ink-950">Riwayat Percakapan</h2>
          </div>
          <div className="flex items-center gap-1">
            {isMobile ? (
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Tutup sidebar"
                className="grid size-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900"
              >
                <X className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setDesktopSidebarOpen(false)}
                aria-label="Sembunyikan sidebar riwayat chat"
                className="grid size-9 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900"
              >
                <PanelLeftClose className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tombol Buat Chat Baru */}
        <div className="p-3">
          <button
            type="button"
            onClick={() => {
              if (isMobile) setSidebarOpen(false)
              onNewSession()
            }}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-ink-900 px-3 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-ink-800 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
          >
            <Plus className="size-4" />
            <span>Percakapan Baru</span>
          </button>
        </div>

        {/* Daftar Sesi */}
        <nav
          aria-label="Daftar sesi chat"
          className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2.5 pb-4"
        >
          {sessionActionError ? (
            <div className="mb-2 rounded-lg bg-red-50 p-2 text-xs font-medium text-crit-fg">
              {sessionActionError}
            </div>
          ) : null}

          {sessions.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted">
              <Inbox className="mx-auto mb-2 size-8 text-ink-300" />
              <p>Belum ada sesi percakapan.</p>
            </div>
          ) : null}

          {sessions.map((item) => {
            const isCurrent = item.session_id === sessionId
            return (
              <div
                key={item.session_id}
                className={`group relative flex items-center gap-1 rounded-xl p-1 transition-colors ${
                  isCurrent ? 'bg-white shadow-xs ring-1 ring-line' : 'hover:bg-ink-100/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isMobile) setSidebarOpen(false)
                    onSelectSession(item.session_id)
                  }}
                  className="flex min-h-[48px] min-w-0 flex-1 items-start gap-2.5 rounded-lg px-2.5 py-2 text-left focus-visible:outline-hidden"
                >
                  <div
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ${
                      isCurrent
                        ? 'bg-ink-900 text-white'
                        : 'bg-ink-100 text-ink-500'
                    }`}
                  >
                    <MessageSquare className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-xs font-semibold ${
                        isCurrent ? 'text-ink-950 font-bold' : 'text-ink-800'
                      }`}
                    >
                      {item.title || 'Percakapan'}
                    </span>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted">
                      <span
                        className={`size-1.5 rounded-full ${
                          item.is_closed ? 'bg-zinc-400' : 'bg-emerald-500'
                        }`}
                      />
                      <span>{item.is_closed ? 'Selesai' : 'Aktif'}</span>
                      <span>•</span>
                      <span className="tabular-nums">
                        {new Date(item.last_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Sesi Toggle & Hapus Actions */}
                <div className="flex shrink-0 items-center opacity-70 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => void toggleSession(item)}
                    disabled={
                      deleting ||
                      ending ||
                      Boolean(togglingSessionId) ||
                      pendingSessionIds.has(item.session_id) ||
                      (item.is_closed && item.message_count === 0)
                    }
                    title={
                      item.is_closed && item.message_count === 0
                        ? 'Sesi lama tanpa riwayat'
                        : item.is_closed
                          ? 'Buka kembali sesi'
                          : 'Tutup sesi'
                    }
                    className="grid min-h-[38px] min-w-[38px] place-items-center rounded-lg text-[11px] font-semibold text-ink-600 hover:bg-ink-200/70 hover:text-ink-950 disabled:opacity-30"
                  >
                    {togglingSessionId === item.session_id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : item.is_closed ? (
                      'Buka'
                    ) : (
                      'Tutup'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError('')
                      setDeleteTarget(item)
                    }}
                    disabled={deleting || ending || Boolean(togglingSessionId) || pendingSessionIds.has(item.session_id)}
                    title="Hapus sesi ini"
                    className="grid min-h-[38px] min-w-[38px] place-items-center rounded-lg text-ink-400 hover:bg-red-50 hover:text-crit-fg disabled:opacity-30"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </nav>
      </div>
    )
  }

  return (
    <section
      aria-label="Ruang Chat AI Mitra Daisuki"
      className="flex h-[calc(100dvh-11.5rem)] min-h-[500px] overflow-hidden rounded-2xl border border-line bg-surface shadow-xs transition-all sm:h-[calc(100dvh-10.5rem)]"
    >
      {/* Mobile Backdrop with Smooth Fade */}
      <div
        aria-hidden="true"
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-0 z-40 bg-ink-950/40 backdrop-blur-xs transition-opacity duration-300 lg:hidden ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Mobile Drawer with Smooth Slide */}
      <aside
        id="mitra-chat-history-drawer-mobile"
        aria-label="Riwayat Percakapan Mobile"
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(86vw,320px)] flex-col border-r border-line bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderSessionList(true)}
      </aside>

      {/* Desktop Sidebar with Smooth Width/Opacity Transition */}
      <aside
        id="mitra-chat-history-sidebar-desktop"
        aria-label="Riwayat Percakapan Desktop"
        className={`hidden lg:flex flex-col shrink-0 border-r border-line bg-surface/40 transition-[width,opacity] duration-300 ease-in-out overflow-hidden ${
          desktopSidebarOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 border-r-0 pointer-events-none'
        }`}
      >
        <div className="w-72 flex flex-col h-full shrink-0">
          {renderSessionList(false)}
        </div>
      </aside>

      {/* Main Chat Conversation Space */}
      <div className="flex min-w-0 flex-1 flex-col bg-white">
        {/* Header Ruang Chat */}
        <header className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:min-h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-0 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Buka riwayat chat"
              className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-ink-700 hover:bg-paper lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            {!desktopSidebarOpen ? (
              <button
                type="button"
                onClick={() => setDesktopSidebarOpen(true)}
                aria-label="Buka riwayat chat"
                className="hidden size-10 shrink-0 place-items-center rounded-lg border border-line text-ink-700 hover:bg-paper lg:grid"
              >
                <PanelLeftOpen className="size-4" />
              </button>
            ) : null}

            <div className="relative size-10 shrink-0">
              <img
                src="/icons/logo.jpg"
                alt="Logo Daisuki"
                className="size-10 rounded-full border border-line object-cover"
              />
              <span
                className={`absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-white ${
                  closed ? 'bg-zinc-400' : 'bg-emerald-500'
                }`}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-display text-sm font-bold text-ink-950 sm:text-base">
                  Asisten Inventaris Toko
                </h1>
                <span className="rounded-md border border-line bg-paper px-2 py-0.5 text-[10px] font-medium text-ink-700">
                  Mitra Cabang
                </span>
              </div>
              <p className="truncate text-[11px] text-muted">
                {closed ? 'Sesi percakapan diarsipkan' : 'Aktif • Terhubung ke data cabang Anda'}
              </p>
            </div>
          </div>

          {/* Action Header */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setTourMenuOpen((open) => !open)}
              aria-expanded={tourMenuOpen}
              aria-controls="mitra-chat-tour-menu"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-paper px-3 text-xs font-semibold text-ink-800 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
            >
              <PlayCircle className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Panduan fitur</span>
              <span className="sm:hidden">Panduan</span>
            </button>
            {closed ? (
              <button
                type="button"
                onClick={() => active && void toggleSession(active)}
                disabled={busy || Boolean(togglingSessionId)}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-line bg-paper px-3 text-xs font-semibold text-ink-800 hover:bg-white active:scale-95 transition-colors"
              >
                <RefreshCw className="size-3.5" />
                <span>Buka Kembali</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void closeSession()}
                disabled={busy || ending || closed || messages.length === 0}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-ink-700 hover:bg-paper hover:text-ink-950 disabled:opacity-40 transition-colors"
              >
                {ending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Meringkas...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5 text-zinc-500" />
                    <span>Selesaikan Sesi</span>
                  </>
                )}
              </button>
            )}
          </div>
        </header>

        {tourMenuOpen ? (
          <div id="mitra-chat-tour-menu" className="border-b border-line bg-paper px-4 py-3 sm:px-6">
            <p className="mb-2 text-xs font-semibold text-ink-800">Pilih fitur yang ingin dipelajari</p>
            <div className="flex flex-wrap gap-2">
              {TOUR_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => { setTourMenuOpen(false); onStartTour(option.id) }}
                  className="min-h-11 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-ink-800 hover:border-ink-400 hover:text-ink-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Feed Percakapan */}
        <div
          ref={feedRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
          aria-live="polite"
        >
          {loading ? (
            <div className="flex h-full items-center justify-center py-16 text-center text-xs text-muted">
              <Loader2 className="mr-2 size-4 animate-spin text-ink-700" />
              <span>Memuat percakapan...</span>
            </div>
          ) : null}

          {/* State Sesi Kosong / Onboarding */}
          {!loading && messages.length === 0 && !closed ? (
            <div className="mx-auto max-w-xl py-8 sm:py-12">
              <div className="text-center">
                <div className="mx-auto mb-3 size-12 overflow-hidden rounded-xl border border-line bg-surface">
                  <img src="/icons/logo.jpg" alt="Daisuki" className="size-full object-cover" />
                </div>
                <h3 className="font-display text-lg font-bold text-ink-950 sm:text-xl">
                  Asisten Inventaris Toko
                </h3>
                <p className="mx-auto mt-1 max-w-md text-xs text-muted sm:text-sm">
                  Pilih instruksi cepat di bawah atau ajukan pertanyaan seputar ketersediaan stok fisik dan pesanan cabang.
                </p>
              </div>

              {/* 4 Kartu Saran Interaktif */}
              <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {MITRA_SUGGESTION_CARDS.map((card, idx) => {
                  const Icon = card.icon
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => void send(card.prompt)}
                      className="group flex flex-col items-start rounded-xl border border-line bg-surface/50 p-3.5 text-left transition-colors hover:border-ink-400 hover:bg-white active:bg-paper"
                    >
                      <div className="mb-2 flex size-7 items-center justify-center rounded-lg border border-line bg-white text-ink-700 transition-colors group-hover:border-ink-300 group-hover:text-ink-950">
                        <Icon className="size-3.5" />
                      </div>
                      <span className="font-display text-xs font-bold text-ink-950">
                        {card.title}
                      </span>
                      <span className="mt-0.5 text-[11px] leading-relaxed text-muted">
                        {card.desc}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {/* Bubble Percakapan */}
          {messages.map((item) => {
            const isUser = item.author === 'mitra'
            return (
              <div
                key={item.id}
                className={`flex max-w-3xl gap-2.5 ${
                  isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'
                }`}
              >
                {!isUser ? (
                  <div className="mt-0.5 size-7 shrink-0 overflow-hidden rounded-full border border-line">
                    <img src="/icons/logo.jpg" alt="" className="size-full object-cover" />
                  </div>
                ) : null}

                <div
                  className={`relative max-w-[88%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed transition-all ${!isUser && item.visualization ? 'w-full' : ''} ${
                    isUser
                      ? 'rounded-tr-xs bg-ink-900 text-white shadow-xs'
                      : 'rounded-tl-xs border border-line bg-surface/60 text-ink-900 shadow-xs'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{item.text}</p>
                  ) : (
                    <>
                      <AssistantMessageText text={item.text} />
                      {item.visualization ? (
                        <ChatToolChart
                          data={{
                            type: 'bar',
                            title: item.visualization.title,
                            unit_label: item.visualization.unit,
                            data: item.visualization.items.map((entry) => ({
                              label: entry.label,
                              value: entry.value,
                            })),
                          }}
                        />
                      ) : null}
                      {item.tour ? (
                        <button
                          type="button"
                          onClick={() => onStartTour(item.tour!)}
                          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink-900 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-ink-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
                        >
                          <PlayCircle className="size-4" aria-hidden="true" />
                          {item.tourLabel ?? `Mulai panduan ${TOUR_OPTIONS.find((option) => option.id === item.tour)?.label.toLowerCase() ?? 'fitur'}`}
                        </button>
                      ) : null}
                    </>
                  )}

                  {item.time ? (
                    <div
                      className={`mt-1.5 text-right text-[11px] tabular-nums ${
                        isUser ? 'text-white/60' : 'text-muted'
                      }`}
                    >
                      {item.time}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}

          {/* Loading Indicator Asisten */}
          {busy ? (
            <div className="flex max-w-3xl items-center gap-2.5">
              <div className="size-7 shrink-0 overflow-hidden rounded-full border border-line">
                <img src="/icons/logo.jpg" alt="" className="size-full object-cover" />
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-line bg-surface/60 px-3.5 py-2 text-xs text-muted">
                <Loader2 className="size-3.5 animate-spin text-ink-700" />
                <span>Menyiapkan jawaban...</span>
              </div>
            </div>
          ) : null}

          {/* Summary Box Jika Sesi Selesai */}
          {closed && summary ? (
            <div className="mx-auto my-4 max-w-2xl overflow-hidden rounded-xl border border-line bg-surface/80 p-4 shadow-xs">
              <div className="flex items-center gap-2 border-b border-line pb-2">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <h4 className="font-display text-xs font-bold text-ink-950">
                  Ringkasan Kesimpulan Sesi
                </h4>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-700 whitespace-pre-wrap">
                {summary}
              </p>
            </div>
          ) : null}
        </div>

        {/* Footer Input Area */}
        <footer className="border-t border-line bg-surface/30 p-3 sm:p-4">
          {error ? (
            <p role="alert" className="mb-2 text-center text-xs font-medium text-crit-fg">
              {error}
            </p>
          ) : null}

          {closed ? (
            <div className="flex items-center justify-between rounded-xl border border-line bg-surface/60 px-4 py-3 text-xs text-muted">
              <span>Sesi ini telah diakhiri. Buka kembali sesi atau buat chat baru.</span>
              <button
                type="button"
                onClick={() => active && void toggleSession(active)}
                className="font-bold text-ink-900 hover:underline"
              >
                Buka Kembali Sesi Ini
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void send()
              }}
              className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-line bg-white p-2 shadow-xs focus-within:border-ink-900 focus-within:ring-1 focus-within:ring-ink-900"
            >
              <label htmlFor="mitra-chat-draft" className="sr-only">
                Tulis pesan untuk Asisten Inventaris
              </label>
              <textarea
                id="mitra-chat-draft"
                ref={textareaRef}
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
                maxLength={600}
                placeholder="Tulis pertanyaan seputar stok, omset, pesanan, atau minta file PDF..."
                disabled={busy || Boolean(togglingSessionId)}
                className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2 text-xs sm:text-sm text-ink-950 placeholder:text-ink-400 focus:outline-hidden"
              />
              <button
                type="submit"
                disabled={busy || Boolean(togglingSessionId) || !draft.trim()}
                aria-label="Kirim pesan"
                className="grid size-11 shrink-0 place-items-center rounded-lg bg-ink-900 text-white shadow-xs transition-colors hover:bg-ink-800 disabled:opacity-30 active:scale-95 focus-visible:outline-2 focus-visible:outline-ink-900"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-5" />}
              </button>
            </form>
          )}
        </footer>
      </div>

      {/* Modal Hapus Sesi */}
      <Dialog.Root
        open={deleteTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !deleting) {
            setDeleteTarget(null)
            setDeleteError('')
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-950/40 backdrop-blur-xs" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-white p-5 shadow-2xl focus:outline-hidden">
            <Dialog.Title className="font-display text-base font-bold text-ink-950">
              Hapus Sesi Chat?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-xs leading-relaxed text-ink-600">
              Percakapan <strong className="text-ink-900">"{deleteTarget?.title || 'Percakapan'}"</strong> beserta ringkasannya akan dihapus secara permanen dari riwayat Anda.
            </Dialog.Description>
            {deleteError ? <p className="mt-2 text-xs text-crit-fg">{deleteError}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="min-h-[40px] rounded-lg border border-line px-3 text-xs font-semibold text-ink-700 hover:bg-paper"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-red-600 px-3.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                <span>{deleting ? 'Menghapus...' : 'Ya, Hapus'}</span>
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  )
}
