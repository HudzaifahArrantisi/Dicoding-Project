import { useEffect, useId, useRef, useState } from 'react'
import type { Html5Qrcode } from 'html5-qrcode'
import { Dialog } from 'radix-ui'
import { Camera, Keyboard, Loader2, X } from 'lucide-react'

export function DeliveryScannerModal({ open, onOpenChange, onVerify, pending }: { open: boolean; onOpenChange: (open: boolean) => void; onVerify: (code: string) => Promise<unknown>; pending: boolean }) {
  const id = useId().replace(/:/g, '')
  const [code, setCode] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const scanLock = useRef(false)
  const lastScanned = useRef('')
  const verifyRef = useRef(onVerify)
  const closeRef = useRef(onOpenChange)
  verifyRef.current = onVerify
  closeRef.current = onOpenChange
  useEffect(() => {
    if (!open) return
    scanLock.current = false
    lastScanned.current = ''
    setCameraError('')
    let disposed = false
    let scanner: Html5Qrcode | null = null
    async function start() {
      try {
        const { Html5Qrcode: QrScanner, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        if (disposed) return
        scanner = new QrScanner(id, { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128] })
        await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 160 } }, (decoded) => {
          if (disposed || scanLock.current || decoded === lastScanned.current) return
          scanLock.current = true
          lastScanned.current = decoded
          setCode(decoded)
          void verifyRef.current(decoded).then(() => { closeRef.current(false); setCode('') }).catch(() => { scanLock.current = false })
        }, () => undefined)
      } catch {
        if (!disposed) setCameraError('Kamera tidak tersedia. Masukkan kode resi secara manual.')
      }
    }
    void start()
    return () => { disposed = true; if (scanner) void scanner.stop().catch(() => undefined) }
  }, [open, id])

  async function submit() {
    if (!code.trim() || submitting) return
    setSubmitting(true)
    try { await onVerify(code.trim()); onOpenChange(false); setCode('') } catch { /* Error shown by the caller. */ } finally { setSubmitting(false) }
  }

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[70] bg-ink-900/45" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-[71] max-h-[92vh] w-[calc(100%-1rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-white p-5 shadow-xl focus-visible:outline-2 focus-visible:outline-ume">
        <div className="flex items-start justify-between gap-3"><div><Dialog.Title className="font-display text-xl font-semibold text-ink-900">Pindai resi paket</Dialog.Title><Dialog.Description className="mt-1 text-sm text-muted">Arahkan kamera ke QR Code atau barcode pada lembar di dalam paket.</Dialog.Description></div><Dialog.Close asChild><button type="button" aria-label="Tutup pemindai" className="grid size-11 shrink-0 place-items-center rounded-md border border-line bg-white text-ink-900 focus-visible:outline-2 focus-visible:outline-ume"><X className="size-5" /></button></Dialog.Close></div>
        <div className="mt-4 overflow-hidden rounded-md border border-line bg-paper"><div id={id} className="min-h-48 w-full" /></div>
        {cameraError ? <p role="status" className="mt-2 flex items-start gap-2 text-sm text-warn-fg"><Camera className="mt-0.5 size-4 shrink-0" />{cameraError}</p> : null}
        <label htmlFor={`${id}-code`} className="mt-4 flex items-center gap-2 text-sm font-semibold text-ink-900"><Keyboard className="size-4" />Kode resi hasil pindai atau input manual</label>
        <input id={`${id}-code`} value={code} onChange={event => setCode(event.target.value)} autoComplete="off" placeholder="DSK-..." className="mt-2 h-12 w-full rounded-md border border-line bg-white px-3 font-mono text-base text-ink-900 focus-visible:outline-2 focus-visible:outline-ume" />
        <button type="button" disabled={!code.trim() || pending || submitting} onClick={() => void submit()} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ume px-4 font-semibold text-white disabled:opacity-50">{pending || submitting ? <Loader2 className="size-4 animate-spin" /> : null} Verifikasi penerimaan</button>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
