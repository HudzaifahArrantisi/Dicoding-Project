import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUp, Loader2, MessageCircle, Sparkles, ThumbsDown, ThumbsUp, Trash2, X } from 'lucide-react'
import {
  askMitraAssistant,
  clearMitraAssistantHistory,
  endMitraAssistantSession,
  getMitraAssistantHistory,
  rateMitraAssistantAnswer,
  type MitraAssistantReply,
  type MitraTour,
} from '@/lib/api/assistant'

type ChatMessage = { id: number; author: 'mitra' | 'assistant'; text: string; source?: 'llm' | 'fallback'; tour?: MitraTour; tourLabel?: string; interactionId?: string; feedback?: -1 | 1 | null }

function inlineText(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>
      : part,
  )
}

function AssistantMessageText({ text }: { text: string }) {
  const blocks: Array<{ kind: 'paragraph' | 'bullets' | 'numbered'; lines: string[] }> = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const bullet = /^[-*]\s+(.+)$/.exec(line)
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line)
    const kind = bullet ? 'bullets' : numbered ? 'numbered' : 'paragraph'
    const content = bullet?.[1] ?? numbered?.[1] ?? line
    const previous = blocks.at(-1)
    if (previous?.kind === kind) previous.lines.push(content)
    else blocks.push({ kind, lines: [content] })
  }
  return <div className="space-y-2 break-words">
    {blocks.map((block, index) => block.kind === 'paragraph'
      ? <p key={index}>{block.lines.map((line, lineIndex) => <span key={lineIndex}>{lineIndex ? <br /> : null}{inlineText(line)}</span>)}</p>
      : block.kind === 'bullets'
        ? <ul key={index} className="list-disc space-y-1 pl-5">{block.lines.map((line, lineIndex) => <li key={lineIndex}>{inlineText(line)}</li>)}</ul>
        : <ol key={index} className="list-decimal space-y-1 pl-5">{block.lines.map((line, lineIndex) => <li key={lineIndex}>{inlineText(line)}</li>)}</ol>,
    )}
  </div>
}

const initialReplies = [
  'Bagaimana cara restock barang?',
  'Bagaimana cara lapor stok harian?',
  'Bagaimana cara konfirmasi barang sampai (scan resi)?',
  'Bagaimana cara membaca status stok & log?',
  'Bagaimana cara melengkapi profil toko?',
]

const initialGreeting: ChatMessage = {
  id: 0,
  author: 'assistant',
  text: 'Halo! Saya bisa bantu soal stok, restock, penerimaan barang, riwayat, log, dan profil toko Daisuki. Pilih pertanyaan di bawah atau ketik sendiri.',
}

export function MitraAiAssistant({ onStartTour }: { onStartTour: (tour: MitraTour) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([initialGreeting])
  const [replies, setReplies] = useState(initialReplies)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showConfirmClear, setShowConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [ending, setEnding] = useState(false)
  const nextId = useRef(1)
  const feedRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const sessionId = useRef(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

  const hasMessages = messages.length > 1

  async function handleClearChat() {
    setClearing(true)
    setError('')
    try {
      await clearMitraAssistantHistory()
      nextId.current = 1
      setMessages([initialGreeting])
      setReplies(initialReplies)
      setShowConfirmClear(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus percakapan. Coba lagi.')
    } finally {
      setClearing(false)
    }
  }

  async function handleEndChat() {
    if (busy || ending || clearing) return
    if (!hasMessages) {
      setOpen(false)
      return
    }
    setEnding(true)
    setError('')
    try {
      await endMitraAssistantSession(sessionId.current)
      sessionId.current = crypto.randomUUID()
      nextId.current = 1
      setMessages([initialGreeting])
      setReplies(initialReplies)
      setShowConfirmClear(false)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sesi belum bisa diakhiri. Coba lagi.')
    } finally {
      setEnding(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    void getMitraAssistantHistory(sessionId.current).then((history) => {
      if (cancelled) return
      const restored = history.flatMap((item) => [
        { id: nextId.current++, author: 'mitra' as const, text: item.message },
        { id: nextId.current++, author: 'assistant' as const, text: item.reply, source: item.source, tour: item.intent ?? undefined, interactionId: item.id, feedback: item.feedback },
      ])
      setMessages((current) => current.length === 1 ? [...current, ...restored] : current)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
    else triggerRef.current?.focus()
  }, [open])

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  async function send(raw: string) {
    const text = raw.trim()
    if (!text || busy) return
    setDraft('')
    setError('')
    setMessages((current) => [...current, { id: nextId.current++, author: 'mitra', text }])
    setBusy(true)
    try {
      const result: MitraAssistantReply = await askMitraAssistant(text, sessionId.current)
      setMessages((current) => [...current, {
        id: nextId.current++, author: 'assistant', text: result.reply, source: result.source,
        tour: result.suggestedTour, tourLabel: result.tourLabel,
        interactionId: result.interactionId,
      }])
      setReplies(result.quickReplies)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Jawaban belum bisa dimuat. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  async function rate(message: ChatMessage, rating: -1 | 1) {
    if (!message.interactionId) return
    const previous = message.feedback
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, feedback: rating } : item))
    try {
      await rateMitraAssistantAnswer(message.interactionId, rating, sessionId.current)
    } catch {
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, feedback: previous } : item))
      setError('Penilaian belum tersimpan. Coba lagi.')
    }
  }

  return (
    <div className="font-sans">
      {/* Tombol Pemicu Floating (Saat Chat Tertutup) */}
      {!open ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buka asisten Daisuki"
          aria-expanded={false}
          aria-controls="mitra-ai-chat"
          className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2.5 rounded-full border border-ink-700/80 bg-ink-950 px-4 py-3 text-white shadow-float transition-all hover:scale-105 hover:bg-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700 md:bottom-6 md:right-6"
        >
          <span className="relative flex size-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
          </span>
          <MessageCircle className="size-5" aria-hidden="true" />
          <span className="font-display text-sm font-semibold tracking-wide">Tanya AI</span>
        </button>
      ) : null}

      {/* Backdrop Fokus Transparan (Menyorot Chatbot & Mengurangi Distraksi Halaman) */}
      {open ? (
        <div
          role="presentation"
          onClick={() => void handleEndChat()}
          className="fixed inset-0 z-40 bg-ink-950/20 backdrop-blur-[2px] transition-opacity animate-in fade-in-0 duration-200"
        />
      ) : null}

      {/* Jendela Chat Utama yang Bersih & Fokus */}
      {open ? (
        <section
          id="mitra-ai-chat"
          aria-label="Percakapan dengan asisten Daisuki"
          className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] top-16 z-50 flex flex-col overflow-hidden rounded-2xl border border-line/80 bg-white shadow-2xl transition-all sm:inset-x-auto sm:top-auto sm:bottom-6 sm:right-6 sm:h-[min(82dvh,680px)] sm:w-[440px] md:bottom-6 md:right-6 animate-in zoom-in-95 duration-200"
        >
          {/* Header Chatbot Bersih */}
          <header className="flex items-center justify-between border-b border-line/70 bg-white/95 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-ink-950 text-white shadow-2xs">
                <Sparkles className="size-5 text-amber-300" aria-hidden="true" />
                <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-emerald-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="truncate font-display text-base font-bold text-ink-900">
                    Daisuki AI Assistant
                  </h2>
                  <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 sm:inline border border-emerald-200/60">
                    Online
                  </span>
                </div>
                <p className="truncate text-xs text-muted">Asisten cerdas stok & pemesanan</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {hasMessages ? (
                <button
                  type="button"
                  onClick={() => setShowConfirmClear(true)}
                  disabled={busy || clearing || ending}
                  aria-label="Hapus percakapan"
                  title="Hapus riwayat chat"
                  className="grid size-11 place-items-center rounded-lg text-muted hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-rose-500"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void handleEndChat()}
                disabled={busy || ending || clearing}
                aria-label="Akhiri chat dan simpan konteks"
                title="Akhiri chat dan simpan konteks"
                className="grid size-11 place-items-center rounded-lg text-ink-600 hover:bg-ink-100 hover:text-ink-900 transition-colors disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ink-700"
              >
                {ending ? <Loader2 className="size-5 animate-spin" /> : <X className="size-5" />}
              </button>
            </div>
          </header>

          {/* Konfirmasi Hapus Riwayat */}
          {showConfirmClear ? (
            <div className="border-b border-rose-100 bg-rose-50/95 p-3.5 backdrop-blur-xs animate-in fade-in-50 duration-150">
              <div className="flex items-start gap-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-700">
                  <Trash2 className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-rose-950">
                    Hapus riwayat percakapan?
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-rose-700">
                    Semua pesan dan konteks yang disimpan akan dihapus.
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={clearing}
                      onClick={() => setShowConfirmClear(false)}
                      className="inline-flex min-h-8 items-center rounded-md border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-900 hover:bg-rose-100/60 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={clearing}
                      onClick={() => void handleClearChat()}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-rose-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:opacity-60 transition-colors"
                    >
                      {clearing ? <Loader2 className="size-3 animate-spin" /> : null}
                      {clearing ? 'Menghapus...' : 'Ya, Hapus'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Feed Pesan (Area Percakapan yang Lega & Kontras) */}
          <div
            ref={feedRef}
            className="min-h-0 flex-1 space-y-3.5 overflow-y-auto bg-slate-50/60 px-4 py-4"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {messages.map((message) => {
              const isMitra = message.author === 'mitra'

              return (
                <div
                  key={message.id}
                  className={`flex ${isMitra ? 'justify-end' : 'justify-start items-start gap-2.5'}`}
                >
                  {!isMitra ? (
                    <div className="grid size-7 shrink-0 place-items-center rounded-full bg-ink-900 text-amber-300 shadow-2xs mt-0.5">
                      <Sparkles className="size-3.5" aria-hidden="true" />
                    </div>
                  ) : null}

                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-2xs ${
                      isMitra
                        ? 'bg-ink-900 text-white rounded-tr-xs'
                        : 'border border-line/80 bg-white text-ink-900 rounded-tl-xs'
                    }`}
                  >
                    {isMitra ? (
                      <p className="whitespace-pre-wrap break-words">{message.text}</p>
                    ) : (
                      <AssistantMessageText text={message.text} />
                    )}

                    {/* Badge Sumber AI */}
                    {message.source === 'llm' ? (
                      <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-indigo-600">
                        <Sparkles className="size-3" />
                        <span>AI · 9Router</span>
                      </div>
                    ) : null}

                    {/* Tombol Panduan Cepat (Tour) */}
                    {message.tour ? (
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false)
                          onStartTour(message.tour!)
                        }}
                        className="mt-3 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-ink-900 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-ink-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700 cursor-pointer"
                      >
                        <span>{message.tourLabel ?? 'Buka Fitur Ini Sekarang'}</span>
                        <ArrowUp className="size-3.5 rotate-45" />
                      </button>
                    ) : null}

                    {/* Feedback Jempol (Sangat Ringkas & Unobtrusive) */}
                    {!isMitra && message.interactionId ? (
                      <div
                        className="mt-2.5 flex items-center justify-between border-t border-line/50 pt-2 text-xs text-muted"
                        aria-label="Nilai jawaban"
                      >
                        <span className="text-[11px]">Jawaban membantu?</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void rate(message, 1)}
                            aria-label="Jawaban membantu"
                            aria-pressed={message.feedback === 1}
                            className={`grid size-7 place-items-center rounded-md transition-colors ${
                              message.feedback === 1
                                ? 'bg-ok-bg text-ok-fg'
                                : 'hover:bg-slate-100 text-muted hover:text-ink-900'
                            }`}
                          >
                            <ThumbsUp className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void rate(message, -1)}
                            aria-label="Jawaban tidak membantu"
                            aria-pressed={message.feedback === -1}
                            className={`grid size-7 place-items-center rounded-md transition-colors ${
                              message.feedback === -1
                                ? 'bg-crit-bg text-crit-fg'
                                : 'hover:bg-slate-100 text-muted hover:text-ink-900'
                            }`}
                          >
                            <ThumbsDown className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}

            {/* Indikator Mengetik AI */}
            {busy ? (
              <div className="flex items-center gap-2 text-xs text-muted pl-9" role="status">
                <Loader2 className="size-3.5 animate-spin text-ink-700" aria-hidden="true" />
                <span>Menyiapkan jawaban cerdas...</span>
              </div>
            ) : null}
          </div>

          {/* Footer Input & Quick Suggestions */}
          <div className="border-t border-line/70 bg-white p-3 sm:p-3.5">
            {/* Quick Reply Pills */}
            <div
              className="mb-2.5 flex flex-wrap gap-1.5"
              aria-label="Pertanyaan cepat"
            >
              {replies.map((reply) => (
                <button
                  key={reply}
                  type="button"
                  onClick={() => void send(reply)}
                  disabled={busy}
                  className="rounded-full border border-line bg-slate-50/80 px-2.5 py-1 text-left text-xs font-medium text-ink-800 shadow-2xs transition-all hover:border-ink-400 hover:bg-white disabled:opacity-50 cursor-pointer"
                >
                  {reply}
                </button>
              ))}
            </div>

            {error ? (
              <p className="mb-2 text-xs font-medium text-crit-fg" role="alert">
                {error}
              </p>
            ) : null}

            {/* Form Input Pesan Modern */}
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void send(draft)
              }}
              className="relative flex items-center"
            >
              <label htmlFor="mitra-ai-input" className="sr-only">
                Tulis pertanyaan tentang inventaris Daisuki
              </label>
              <input
                ref={inputRef}
                id="mitra-ai-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={500}
                placeholder="Tanya stok, restock, resi..."
                className="w-full rounded-full border border-line bg-slate-50/70 py-2.5 pl-4 pr-12 text-sm text-ink-900 placeholder:text-muted transition-all focus:bg-white focus:border-ink-700 focus:outline-none focus:ring-2 focus:ring-ink-700/20"
              />
              <button
                type="submit"
                disabled={busy || !draft.trim()}
                aria-label="Kirim pertanyaan"
                className="absolute right-1.5 grid size-8 place-items-center rounded-full bg-ink-900 text-white shadow-xs transition-all hover:bg-ink-800 disabled:opacity-30 disabled:hover:bg-ink-900 cursor-pointer"
              >
                <ArrowUp className="size-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  )
}
