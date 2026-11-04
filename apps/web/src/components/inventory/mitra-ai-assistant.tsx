import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Loader2, MessageCircle, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { askMitraAssistant, getMitraAssistantHistory, rateMitraAssistantAnswer, type MitraAssistantReply, type MitraTour } from '@/lib/api/assistant'

type ChatMessage = { id: number; author: 'mitra' | 'assistant'; text: string; tour?: MitraTour; tourLabel?: string; interactionId?: string; feedback?: -1 | 1 | null }

const initialReplies = [
  'Bagaimana cara restock barang?',
  'Bagaimana cara lapor stok harian?',
  'Bagaimana cara konfirmasi barang sampai (scan resi)?',
  'Bagaimana cara membaca status stok & log?',
  'Bagaimana cara melengkapi profil toko?',
]

export function MitraAiAssistant({ onStartTour }: { onStartTour: (tour: MitraTour) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, author: 'assistant', text: 'Halo! Saya bisa bantu soal stok, restock, penerimaan barang, riwayat, log, dan profil toko Daisuki. Pilih pertanyaan di bawah atau ketik sendiri.' },
  ])
  const [replies, setReplies] = useState(initialReplies)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const nextId = useRef(1)
  const feedRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    void getMitraAssistantHistory().then((history) => {
      if (cancelled) return
      const restored = history.flatMap((item) => [
        { id: nextId.current++, author: 'mitra' as const, text: item.message },
        { id: nextId.current++, author: 'assistant' as const, text: item.reply, tour: item.intent ?? undefined, interactionId: item.id, feedback: item.feedback },
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
      const result: MitraAssistantReply = await askMitraAssistant(text)
      setMessages((current) => [...current, {
        id: nextId.current++, author: 'assistant', text: result.reply,
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
      await rateMitraAssistantAnswer(message.interactionId, rating)
    } catch {
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, feedback: previous } : item))
      setError('Penilaian belum tersimpan. Coba lagi.')
    }
  }

  return (
    <div className="font-sans">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Tutup asisten Daisuki' : 'Buka asisten Daisuki'}
        aria-expanded={open}
        aria-controls="mitra-ai-chat"
        className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-40 grid size-14 place-items-center rounded-full border border-ink-700 bg-ink-900 text-white shadow-float transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700 md:bottom-6 md:right-6"
      >
        {open ? <X className="size-6" aria-hidden="true" /> : <MessageCircle className="size-6" aria-hidden="true" />}
      </button>

      {open ? (
        <section
          id="mitra-ai-chat"
          aria-label="Percakapan dengan asisten Daisuki"
          className="fixed inset-x-3 bottom-[calc(11rem+env(safe-area-inset-bottom))] z-40 flex max-h-[min(66dvh,590px)] flex-col overflow-hidden rounded-xl border border-line bg-white shadow-float sm:left-auto sm:right-4 sm:w-[390px] md:bottom-24 md:right-6 md:max-h-[min(75dvh,650px)]"
        >
          <header className="flex items-center gap-3 border-b border-line bg-paper px-4 py-3">
            <span className="grid size-10 place-items-center rounded-lg bg-ume/10 text-ume" aria-hidden="true"><Sparkles className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-semibold text-ink-900">Daisuki AI Assistant</h2>
              <p className="text-xs text-muted">Asisten operasional mitra</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Tutup percakapan" className="grid size-11 place-items-center rounded-md text-ink-700 hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-ink-700"><X className="size-5" /></button>
          </header>

          <div ref={feedRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite" aria-relevant="additions text">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.author === 'mitra' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-lg px-3 py-2.5 text-sm leading-relaxed ${message.author === 'mitra' ? 'bg-ink-700 text-white' : 'border border-line bg-paper text-text'}`}>
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  {message.tour ? (
                    <button
                      type="button"
                      onClick={() => { setOpen(false); onStartTour(message.tour!) }}
                      className="mt-3 min-h-11 w-full rounded-md bg-ink-700 px-3 py-2 text-sm font-semibold text-white hover:bg-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
                    >
                      {message.tourLabel ?? 'Mulai panduan langsung'}
                    </button>
                  ) : null}
                  {message.author === 'assistant' && message.interactionId ? (
                    <div className="mt-2 flex items-center gap-1 border-t border-line pt-2" aria-label="Nilai jawaban">
                      <span className="mr-auto text-xs text-muted">Membantu?</span>
                      <button type="button" onClick={() => void rate(message, 1)} aria-label="Jawaban membantu" aria-pressed={message.feedback === 1} className={`grid size-11 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-ink-700 ${message.feedback === 1 ? 'bg-ok-bg text-ok-fg' : 'text-muted hover:bg-ink-100'}`}><ThumbsUp className="size-4" /></button>
                      <button type="button" onClick={() => void rate(message, -1)} aria-label="Jawaban tidak membantu" aria-pressed={message.feedback === -1} className={`grid size-11 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-ink-700 ${message.feedback === -1 ? 'bg-crit-bg text-crit-fg' : 'text-muted hover:bg-ink-100'}`}><ThumbsDown className="size-4" /></button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {busy ? <div className="flex items-center gap-2 text-xs text-muted" role="status"><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Menyiapkan jawaban...</div> : null}
          </div>

          <div className="border-t border-line px-4 py-3">
            <p className="mb-2 text-xs text-muted">Percakapan dan penilaian disimpan untuk membantu memperbaiki jawaban Daisuki.</p>
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1" aria-label="Pertanyaan cepat">
              {replies.map((reply) => (
                <button key={reply} type="button" onClick={() => void send(reply)} disabled={busy} className="min-h-11 shrink-0 rounded-full border border-line bg-white px-3 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ink-700">{reply}</button>
              ))}
            </div>
            {error ? <p className="mb-2 text-sm text-crit-fg" role="alert">{error}</p> : null}
            <form onSubmit={(event) => { event.preventDefault(); void send(draft) }} className="flex gap-2">
              <label htmlFor="mitra-ai-input" className="sr-only">Tulis pertanyaan tentang inventaris Daisuki</label>
              <input ref={inputRef} id="mitra-ai-input" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} placeholder="Tanya soal inventaris..." className="min-w-0 min-h-11 flex-1 rounded-md border border-line bg-white px-3 text-base text-text focus-visible:outline-2 focus-visible:outline-ink-700" />
              <button type="submit" disabled={busy || !draft.trim()} aria-label="Kirim pertanyaan" className="grid size-11 shrink-0 place-items-center rounded-md bg-ink-700 text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"><ArrowUp className="size-5" aria-hidden="true" /></button>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  )
}
