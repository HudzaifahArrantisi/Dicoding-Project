import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'radix-ui'
import {
  AlertTriangle,
  ArrowUp,
  Building2,
  CheckCircle2,
  FileDown,
  History,
  Inbox,
  Loader2,
  Menu,
  MessageSquare,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import {
  askAdminAssistant,
  AssistantQuotaError,
  deleteAdminChatSession,
  endAdminAssistantSession,
  getAdminChatQuota,
  getAdminChatSession,
  getAdminChatSessions,
  reopenAdminChatSession,
  type AssistantQuotaStatus,
  type MitraChatHistoryItem,
  type MitraChatSession,
} from '@/lib/api/assistant'
import { ChatQuotaBar } from '@/components/inventory/chat-quota-bar'
import { AssistantMessageText } from '@/components/inventory/mitra-ai-assistant'

type Message = { id: string; author: 'admin' | 'assistant'; text: string; time?: string }

const ADMIN_SUGGESTION_CARDS = [
  {
    icon: Building2,
    title: 'Ready Stock Gudang Pusat',
    desc: 'Pantau ketersediaan fisik 4 produk resmi di gudang pusat Daisuki',
    prompt: 'Berapa jumlah ready stock 4 produk di gudang pusat saat ini?',
  },
  {
    icon: AlertTriangle,
    title: 'Cabang Kritis & Belum Lapor',
    desc: 'Daftar cabang mitra dengan stok ≤ 20% atau belum update > 24 jam',
    prompt: 'Tolong tampilkan daftar cabang mitra yang stoknya kritis atau belum lapor/update stok fisik hari ini.',
  },
  {
    icon: PackageCheck,
    title: 'Pesanan Menunggu Approval',
    desc: 'Cek antrean pesanan restock yang butuh persetujuan admin pusat',
    prompt: 'Berapa pesanan restock yang sedang berstatus menunggu persetujuan admin?',
  },
  {
    icon: FileDown,
    title: 'Rekap Jaringan & Ekspor PDF',
    desc: 'Kompilasi kondisi inventaris semua cabang ke dokumen PDF resmi',
    prompt: 'Buatkan rangkuman status kesehatan inventaris seluruh jaringan cabang dan jadikan file PDF.',
  },
]

export function AdminChatRoom({
  sessionId,
  onSelectSession,
  onNewSession,
}: {
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
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<MitraChatSession | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [togglingSessionId, setTogglingSessionId] = useState<string | null>(null)
  const [sessionActionError, setSessionActionError] = useState('')
  const [quota, setQuota] = useState<AssistantQuotaStatus | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const active = sessions.find((item) => item.session_id === sessionId)
  const closed = active?.is_closed ?? false
  const quotaExhausted = Boolean(
    quota &&
      quota.remaining <= 0 &&
      quota.reset_at &&
      new Date(quota.reset_at).getTime() > Date.now(),
  )

  async function refreshQuota() {
    try {
      const latest = await getAdminChatQuota()
      setQuota(latest)
    } catch {
      // Abaikan jika gagal memuat ulang kuota sementara.
    }
  }

  useEffect(() => {
    if (!sidebarOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [sidebarOpen])

  useEffect(() => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 144)}px`
  }, [draft])

  async function refreshSessions() {
    try {
      const list = await getAdminChatSessions()
      setSessions(list)
    } catch {
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessages([])
    setSummary(null)
    setError('')
    feedRef.current?.scrollTo({ top: 0 })

    void Promise.all([getAdminChatSessions(), getAdminChatSession(sessionId)])
      .then(([list, history]) => {
        if (cancelled) return
        setSessions(list)
        setMessages(
          history.data.flatMap((item: MitraChatHistoryItem) => [
            {
              id: `${item.id}-user`,
              author: 'admin' as const,
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
              time: new Date(item.created_at).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              }),
            },
          ]),
        )
        setSummary(history.summary)
        if (history.quota) {
          setQuota(history.quota)
        } else {
          void refreshQuota()
        }
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
    if (!message || busy || closed || togglingSessionId || quotaExhausted) return
    setDraft('')
    setError('')

    const optimisticId = crypto.randomUUID()
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

    setMessages((current) => [
      ...current,
      { id: optimisticId, author: 'admin', text: message, time: nowTime },
    ])
    setBusy(true)

    try {
      const result = await askAdminAssistant(message, sessionId)
      if (result.quota) {
        setQuota(result.quota)
      }
      setMessages((current) => [
        ...current,
        {
          id: result.interactionId,
          author: 'assistant',
          text: result.reply,
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        },
      ])
      await refreshSessions()
    } catch (reason) {
      setMessages((current) => current.filter((item) => item.id !== optimisticId))
      if (reason instanceof AssistantQuotaError && reason.quota) {
        setQuota(reason.quota)
      }
      setError(reason instanceof Error ? reason.message : 'Pesan belum terkirim. Coba lagi.')
    } finally {
      setBusy(false)
      textareaRef.current?.focus()
    }
  }

  async function closeSession() {
    if (busy || ending || closed || togglingSessionId) return
    setEnding(true)
    setError('')
    try {
      await endAdminAssistantSession(sessionId)
      const [list, history] = await Promise.all([
        getAdminChatSessions(),
        getAdminChatSession(sessionId),
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
      busy ||
      ending ||
      deleting ||
      togglingSessionId ||
      (item.is_closed && item.message_count === 0)
    )
      return
    setTogglingSessionId(item.session_id)
    setSessionActionError('')
    try {
      if (item.is_closed) {
        await reopenAdminChatSession(item.session_id)
      } else {
        await endAdminAssistantSession(item.session_id)
      }
      const list = await getAdminChatSessions()
      setSessions(list)
      if (item.session_id === sessionId) {
        const history = await getAdminChatSession(sessionId)
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

  function renderSessionList(isMobile = false) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <div className="flex items-center gap-2">
            <History className="size-4 text-ink-700" />
            <h2 className="font-display text-sm font-bold text-ink-950">Riwayat Chat Admin</h2>
          </div>
          <div className="flex items-center gap-1">
            {isMobile ? (
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Tutup sidebar"
                className="grid size-11 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-ink-900"
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
            <span>Chat Analitik Baru</span>
          </button>
        </div>

        {/* Daftar Sesi */}
        <nav
          aria-label="Daftar sesi chat admin"
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
                  isCurrent ? 'bg-surface shadow-xs ring-1 ring-line' : 'hover:bg-ink-100/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isMobile) setSidebarOpen(false)
                    onSelectSession(item.session_id)
                  }}
                  aria-current={isCurrent ? 'page' : undefined}
                  className="flex min-h-[48px] min-w-0 flex-1 items-start gap-2.5 rounded-lg px-2.5 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
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
                      {item.title || 'Percakapan Analitik'}
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
                      busy ||
                      ending ||
                      Boolean(togglingSessionId) ||
                      (item.is_closed && item.message_count === 0)
                    }
                    title={
                      item.is_closed && item.message_count === 0
                        ? 'Sesi lama tanpa riwayat'
                        : item.is_closed
                          ? 'Buka kembali sesi'
                          : 'Tutup sesi'
                    }
                    className="grid min-h-11 min-w-11 place-items-center rounded-lg text-[11px] font-semibold text-ink-600 hover:bg-ink-200/70 hover:text-ink-950 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-ink-900"
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
                    disabled={deleting || busy || ending || Boolean(togglingSessionId)}
                    title="Hapus sesi ini"
                    className="grid min-h-11 min-w-11 place-items-center rounded-lg text-ink-400 hover:bg-red-50 hover:text-crit-fg disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-ink-900"
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
      aria-label="Ruang Chat AI Admin Daisuki Pusat"
      className="flex min-h-0 w-full flex-1 overflow-hidden rounded-lg border border-line bg-surface shadow-xs"
    >
      {/* Mobile Drawer Backdrop with Smooth Fade */}
      <div
        aria-hidden="true"
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-0 z-40 bg-ink-950/40 backdrop-blur-xs transition-opacity duration-300 lg:hidden ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Mobile Drawer with Smooth Slide */}
      <aside
        id="admin-chat-history-drawer-mobile"
        aria-label="Riwayat Chat Admin Mobile"
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(86vw,320px)] flex-col border-r border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderSessionList(true)}
      </aside>

      {/* Desktop Sidebar with Smooth Width/Opacity Transition */}
      <aside
        id="admin-chat-history-sidebar-desktop"
        aria-label="Riwayat Chat Admin Desktop"
        aria-hidden={!desktopSidebarOpen}
        inert={!desktopSidebarOpen}
        className={`hidden lg:flex flex-col shrink-0 border-r border-line bg-paper transition-[width,opacity] duration-300 ease-in-out overflow-hidden ${
          desktopSidebarOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 border-r-0 pointer-events-none'
        }`}
      >
        <div className="w-72 flex flex-col h-full shrink-0">
          {renderSessionList(false)}
        </div>
      </aside>

      {/* Main Admin Conversation Feed */}
      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        {/* Header Ruang Chat */}
        <header className="flex flex-col gap-2 border-b border-line px-3 py-3 sm:min-h-16 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-0">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Buka riwayat chat"
              className="grid size-11 shrink-0 place-items-center rounded-lg border border-line text-ink-700 hover:bg-paper focus-visible:outline-2 focus-visible:outline-ink-900 lg:hidden"
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
                  Pusat Analisis Admin
                </h1>
              </div>
              <p className="truncate text-[11px] text-muted">
                {closed ? 'Sesi percakapan diarsipkan' : 'Aktif • Gudang pusat & seluruh jaringan cabang'}
              </p>
            </div>
          </div>

          {/* Action Header */}
          <div className="flex items-center justify-end gap-2">
            {closed ? (
              <button
                type="button"
                onClick={() => active && void toggleSession(active)}
                disabled={busy || Boolean(togglingSessionId)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-paper px-3 text-xs font-semibold text-ink-800 hover:bg-surface active:scale-95 transition-colors focus-visible:outline-2 focus-visible:outline-ink-900"
              >
                <RefreshCw className="size-3.5" />
                <span>Buka Kembali</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void closeSession()}
                disabled={busy || ending || closed || messages.length === 0}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-ink-700 hover:bg-paper hover:text-ink-950 disabled:opacity-40 transition-colors focus-visible:outline-2 focus-visible:outline-ink-900"
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

        {/* Status Kuota Chat Akun & Cooldown 5 Jam (Di Bawah Tombol Selesaikan Sesi) */}
        <ChatQuotaBar
          quota={quota}
          accountLabel="Akun Admin"
          onCooldownExpired={() => void refreshQuota()}
        />

        {/* Feed Percakapan */}
        <div
          ref={feedRef}
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
          aria-live="polite"
        >
          <div className="mx-auto min-h-full w-full max-w-4xl space-y-5 px-3 py-5 sm:px-6 sm:py-7">
          {loading ? (
            <div className="flex h-full items-center justify-center py-16 text-center text-xs text-muted">
              <Loader2 className="mr-2 size-4 animate-spin text-ink-700" />
              <span>Tunggu Sebentar...</span>
            </div>
          ) : null}

          {/* State Sesi Kosong / Onboarding Admin */}
          {!loading && messages.length === 0 && !closed ? (
            <div className="mx-auto max-w-xl py-4 sm:py-10">
              <div className="text-center">
                <div className="mx-auto mb-3 size-12 overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
                  <img src="/icons/logo.jpg" alt="Daisuki" className="size-full object-cover" />
                </div>
                <h3 className="font-display text-lg font-bold text-ink-950 sm:text-xl">
                  Pusat Analisis Inventaris Admin
                </h3>
                <p className="mx-auto mt-1 max-w-md text-xs text-muted sm:text-sm">
                  Pilih analisis operasional di bawah atau ajukan pertanyaan langsung mengenai kondisi jaringan cabang dan gudang pusat.
                </p>
              </div>

              {/* 4 Kartu Rekomendasi Prompt Admin */}
              <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {ADMIN_SUGGESTION_CARDS.map((card, idx) => {
                  const Icon = card.icon
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => void send(card.prompt)}
                      className="group flex min-h-24 flex-col items-start rounded-lg border border-line bg-surface shadow-xs p-4 text-left transition-colors hover:border-ink-700 hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
                    >
                      <div className="mb-2 flex size-7 items-center justify-center rounded-lg border border-line bg-surface shadow-xs text-ink-700 transition-colors group-hover:border-ink-300 group-hover:text-ink-950">
                        <Icon className="size-3.5" />
                      </div>
                      <span className="font-display text-sm font-semibold text-ink-950">
                        {card.title}
                      </span>
                      <span className="mt-1 text-xs leading-relaxed text-ink-700">
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
            const isUser = item.author === 'admin'
            return (
              <div
                key={item.id}
                className={`flex w-full min-w-0 max-w-3xl gap-2 ${
                  isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'
                }`}
              >
                {!isUser ? (
                  <div className="mt-0.5 size-7 shrink-0 overflow-hidden rounded-full border border-line">
                    <img src="/icons/logo.jpg" alt="" className="size-full object-cover" />
                  </div>
                ) : null}

                <div
                  className={`relative min-w-0 max-w-[calc(100%-2.5rem)] break-words rounded-2xl px-3 py-2.5 text-sm leading-relaxed transition-all sm:max-w-[88%] sm:px-4 sm:py-3 ${
                    isUser
                      ? 'rounded-tr-xs bg-ink-900 text-white shadow-xs'
                      : 'rounded-tl-xs border border-line bg-surface text-ink-900'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap break-words">{item.text}</p>
                  ) : (
                    <AssistantMessageText text={item.text} />
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
                <span>Menganalisis data jaringan & menyusun jawaban...</span>
              </div>
            </div>
          ) : null}

          {/* Summary Box Jika Sesi Selesai */}
          {closed && summary ? (
            <div className="mx-auto my-4 max-w-2xl overflow-hidden rounded-xl border border-line bg-surface/80 p-4 shadow-xs">
              <div className="flex items-center gap-2 border-b border-line pb-2">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <h4 className="font-display text-xs font-bold text-ink-950">
                  Ringkasan Kesimpulan Sesi Admin
                </h4>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-700 whitespace-pre-wrap">
                {summary}
              </p>
            </div>
          ) : null}
          </div>
        </div>

        {/* Footer Input Area */}
        <footer className="border-t border-line bg-paper p-2.5 sm:p-4">
          {error ? (
            <p role="alert" className="mb-2 text-center text-xs font-medium text-crit-fg">
              {error}
            </p>
          ) : null}

          {closed ? (
            <div className="mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl border border-line/70 bg-surface/75 p-3 text-xs text-muted shadow-xs backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <span className="text-ink-700">Sesi ini telah diakhiri. Buka kembali sesi atau buat chat baru.</span>
              <button
                type="button"
                onClick={() => active && void toggleSession(active)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface/90 px-3.5 py-1.5 font-bold text-ink-900 shadow-2xs transition-all hover:bg-ink-50 active:scale-95 sm:self-auto"
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
              className="mx-auto flex max-w-3xl min-w-0 flex-col rounded-lg border border-line bg-surface shadow-xs p-2 transition-colors focus-within:border-ink-900 focus-within:ring-2 focus-within:ring-ink-900/10 sm:p-2.5"
            >
              <div className="flex min-w-0 items-end gap-2">
                <label htmlFor="admin-chat-draft" className="sr-only">
                  Tulis pertanyaan analitik untuk Asisten Admin
                </label>
                <textarea
                  id="admin-chat-draft"
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
                  placeholder={
                    quotaExhausted
                      ? 'Kuota chat 5 jam akun ini penuh. Tunggu waktu cooldown selesai...'
                      : 'Tulis pertanyaan analitik atau pantauan stok...'
                  }
                  disabled={busy || Boolean(togglingSessionId) || quotaExhausted}
                  className="max-h-36 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2.5 py-2 text-base leading-relaxed text-ink-950 placeholder:text-ink-400 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-60 sm:px-3 sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={busy || Boolean(togglingSessionId) || quotaExhausted || !draft.trim()}
                  aria-label="Kirim pesan"
                  className="grid size-11 shrink-0 place-items-center rounded-md bg-ink-900 text-white transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-5" />}
                </button>
              </div>

              <div className="flex items-center justify-between px-2.5 pt-1 text-[11px] text-ink-400 select-none">
                <span className="hidden sm:inline">
                  Tekan <kbd className="rounded border border-line bg-surface/80 px-1 py-0.5 font-mono text-[10px] text-ink-600 shadow-2xs">Enter ↵</kbd> untuk kirim, <kbd className="rounded border border-line bg-surface/80 px-1 py-0.5 font-mono text-[10px] text-ink-600 shadow-2xs">Shift+Enter</kbd> baris baru
                </span>
                <span className="sm:hidden text-ink-400">
                  {busy ? 'Sedang menganalisis...' : 'Asisten Admin Daisuki'}
                </span>
                <span className={`tabular-nums transition-colors duration-150 ${draft.length > 500 ? 'font-medium text-warn-fg' : 'text-ink-400'}`}>
                  {draft.length > 0 ? `${draft.length}/600` : ''}
                </span>
              </div>
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
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface shadow-xs p-5 shadow-2xl focus:outline-hidden">
            <Dialog.Title className="font-display text-base font-bold text-ink-950">
              Hapus Sesi Chat Admin?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-xs leading-relaxed text-ink-600">
              Percakapan <strong className="text-ink-900">"{deleteTarget?.title || 'Percakapan Analitik'}"</strong> beserta ringkasannya akan dihapus secara permanen dari riwayat Anda.
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
