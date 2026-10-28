import { useEffect, useId, useRef, useState } from 'react'
import type { Html5Qrcode } from 'html5-qrcode'
import { Dialog } from 'radix-ui'
import { Camera, Image as ImageIcon, Keyboard, Loader2, RefreshCw, X } from 'lucide-react'

function getCameraErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const name = err.name || ''
    const msg = err.message || ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || msg.toLowerCase().includes('permission')) {
      return 'Izin kamera ditolak. Silakan klik ikon gembok/setelan di address bar browser dan ubah izin Kamera menjadi "Izinkan".'
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || msg.toLowerCase().includes('not found')) {
      return 'Perangkat kamera tidak ditemukan pada laptop/HP ini.'
    }
    if (name === 'NotReadableError' || name === 'TrackStartError' || msg.toLowerCase().includes('in use')) {
      return 'Kamera sedang digunakan aplikasi lain (Zoom, Google Meet, Teams, dll). Silakan tutup aplikasi tersebut.'
    }
    if (name === 'OverconstrainedError' || msg.toLowerCase().includes('overconstrained')) {
      return 'Format kamera belakang tidak tersedia pada perangkat ini.'
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      return 'Browser memblokir kamera karena koneksi dianggap tidak aman. Pastikan menggunakan sertifikat SSL terpercaya atau localhost.'
    }
    return `Kamera tidak dapat dimulai (${msg || name}). Coba unggah foto resi atau masukkan kode manual.`
  }
  return 'Kamera tidak tersedia. Pastikan izin kamera aktif atau unggah foto resi.'
}

export function DeliveryScannerModal({
  open,
  onOpenChange,
  onVerify,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onVerify: (code: string) => Promise<unknown>
  pending: boolean
}) {
  const id = useId().replace(/:/g, '')
  const containerId = `scanner-${id}`
  const fileReaderId = `file-reader-${id}`

  const [code, setCode] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [fileScanning, setFileScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [restartCount, setRestartCount] = useState(0)

  const scanLock = useRef(false)
  const lastScanned = useRef('')
  const verifyRef = useRef(onVerify)
  const closeRef = useRef(onOpenChange)
  const fileInputRef = useRef<HTMLInputElement>(null)

  verifyRef.current = onVerify
  closeRef.current = onOpenChange

  useEffect(() => {
    if (!open) return

    scanLock.current = false
    lastScanned.current = ''
    setCameraError('')
    setIsStarting(true)

    let isDisposed = false
    const checkDisposed = (): boolean => isDisposed
    let scannerInstance: Html5Qrcode | null = null

    async function startScanner() {
      try {
        // Beri jeda 1 frame agar container DOM Radix Dialog Portal sudah mounted
        await new Promise((resolve) => requestAnimationFrame(resolve))
        if (checkDisposed()) return

        let el = document.getElementById(containerId)
        if (!el) {
          // Tunggu sedikit jika DOM modal masih proses mount
          await new Promise((resolve) => setTimeout(resolve, 80))
          if (checkDisposed()) return
          el = document.getElementById(containerId)
        }

        if (!el) {
          throw new Error('Container kamera belum terpasang di DOM')
        }

        const { Html5Qrcode: QrScanner, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        if (checkDisposed()) return

        scannerInstance = new QrScanner(containerId, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
          ],
        })

        // Deteksi daftar kamera yang ada
        let cameraTarget: string | { facingMode: string } = { facingMode: 'environment' }
        try {
          const devices = await QrScanner.getCameras()
          if (devices.length > 0) {
            // Prioritaskan kamera belakang jika di smartphone
            const backCamera = devices.find((d) =>
              /back|rear|environment|belakang/i.test(d.label),
            )
            cameraTarget = backCamera ? backCamera.id : devices[0].id
          }
        } catch (camErr) {
          console.warn('[Scanner] getCameras tidak berhasil, mencoba facingMode...', camErr)
          cameraTarget = { facingMode: 'environment' }
        }

        const onScanSuccess = (decoded: string) => {
          if (checkDisposed() || scanLock.current || decoded === lastScanned.current) return
          scanLock.current = true
          lastScanned.current = decoded
          setCode(decoded)

          void verifyRef
            .current(decoded)
            .then(() => {
              closeRef.current(false)
              setCode('')
            })
            .catch(() => {
              scanLock.current = false
            })
        }

        const scanConfig = {
          fps: 10,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
            const boxSize = Math.max(140, Math.floor(minEdge * 0.72))
            return { width: boxSize, height: boxSize }
          },
        }

        // Jalankan scanner dengan kamera target
        try {
          await scannerInstance.start(cameraTarget, scanConfig, onScanSuccess, () => undefined)
        } catch (firstErr) {
          console.warn('[Scanner] Start pertama gagal, mencoba fallback kamera user...', firstErr)
          if (checkDisposed()) return
          // Jika gagal (misal Overconstrained di PC yang tidak punya kamera belakang), coba kamera default
          await scannerInstance.start({ facingMode: 'user' }, scanConfig, onScanSuccess, () => undefined)
        }

        if (!checkDisposed()) {
          setIsStarting(false)
        }
      } catch (err) {
        console.error('[Scanner] Gagal membuka kamera:', err)
        if (!checkDisposed()) {
          setIsStarting(false)
          setCameraError(getCameraErrorMessage(err))
        }
      }
    }

    void startScanner()

    return () => {
      isDisposed = true
      if (scannerInstance && scannerInstance.isScanning) {
        scannerInstance.stop().catch(() => undefined)
      }
    }
  }, [open, containerId, restartCount])

  // Fitur Unggah Foto / Jepret Langsung sebagai Fallback
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileScanning(true)
    setCameraError('')

    try {
      const { Html5Qrcode: QrScanner, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
      const fileScanner = new QrScanner(fileReaderId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
        ],
      })

      const decoded = await fileScanner.scanFile(file, true)
      fileScanner.clear()

      if (decoded) {
        setCode(decoded)
        await onVerify(decoded)
        onOpenChange(false)
        setCode('')
      }
    } catch (err) {
      console.warn('[Scanner] scanFile gagal:', err)
      setCameraError('Barcode tidak terbaca dari foto. Pastikan gambar jelas & tidak buram, atau ketik kode resi.')
    } finally {
      setFileScanning(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function submit() {
    if (!code.trim() || submitting) return
    setSubmitting(true)
    try {
      await onVerify(code.trim())
      onOpenChange(false)
      setCode('')
    } catch {
      // Error ditampilkan oleh caller
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-ink-900/45 backdrop-blur-xs" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[71] max-h-[92vh] w-[calc(100%-1rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-white p-5 shadow-xl focus-visible:outline-2 focus-visible:outline-ume">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-xl font-semibold text-ink-900">
                Pindai resi paket
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                Arahkan kamera ke QR Code atau barcode pada lembar resi paket Daisuki.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Tutup pemindai"
                className="grid size-11 shrink-0 place-items-center rounded-md border border-line bg-white text-ink-900 focus-visible:outline-2 focus-visible:outline-ume"
              >
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Area Kamera Live */}
          <div className="relative mt-4 overflow-hidden rounded-md border border-line bg-paper">
            <div id={containerId} className="min-h-52 w-full" />
            <div id={fileReaderId} className="hidden" />

            {isStarting ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-paper/90 p-4 text-center">
                <Loader2 className="size-6 animate-spin text-ume" />
                <p className="text-xs font-medium text-ink-700">Mempersiapkan kamera...</p>
              </div>
            ) : null}
          </div>

          {/* Pesan Error & Opsi Coba Lagi */}
          {cameraError ? (
            <div className="mt-3 rounded-lg border border-warn/30 bg-warn-bg/20 p-3 text-xs text-warn-fg">
              <div className="flex items-start gap-2">
                <Camera className="mt-0.5 size-4 shrink-0 text-warn" />
                <div className="space-y-1">
                  <p className="font-semibold">{cameraError}</p>
                  <p className="text-[11px] text-muted">
                    Jika kamera tidak bisa terbuka, Anda bisa foto resi langsung atau gunakan input manual di bawah.
                  </p>
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRestartCount((c) => c + 1)}
                  className="inline-flex items-center gap-1.5 rounded border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink-900 hover:bg-ink-50"
                >
                  <RefreshCw className="size-3" />
                  Coba buka kamera lagi
                </button>
              </div>
            </div>
          ) : null}

          {/* Fallback Foto / Upload File */}
          <div className="mt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileScan}
              className="hidden"
              id={`${id}-file-input`}
            />
            <button
              type="button"
              disabled={fileScanning || isStarting}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-line bg-paper/80 px-3 text-xs font-semibold text-ink-900 transition hover:bg-ink-100 disabled:opacity-50"
            >
              {fileScanning ? (
                <Loader2 className="size-4 animate-spin text-ume" />
              ) : (
                <ImageIcon className="size-4 text-muted" />
              )}
              {fileScanning ? 'Membaca barcode dari foto...' : 'Unggah atau Ambil Foto Barcode Resi'}
            </button>
          </div>

          {/* Manual Input Kode */}
          <div className="mt-4 border-t border-line/70 pt-4">
            <label
              htmlFor={`${id}-code`}
              className="flex items-center gap-2 text-sm font-semibold text-ink-900"
            >
              <Keyboard className="size-4 text-muted" />
              Kode resi hasil pindai atau input manual
            </label>
            <input
              id={`${id}-code`}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              placeholder="DSK-..."
              className="mt-2 h-12 w-full rounded-md border border-line bg-white px-3 font-mono text-base text-ink-900 focus-visible:outline-2 focus-visible:outline-ume"
            />
            <button
              type="button"
              disabled={!code.trim() || pending || submitting || fileScanning}
              onClick={() => void submit()}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ume px-4 font-semibold text-white shadow-2xs transition hover:opacity-95 disabled:opacity-50"
            >
              {pending || submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Verifikasi penerimaan
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
