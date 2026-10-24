import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, Share } from 'lucide-react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    daisukiPwa?: {
      prompt: InstallPromptEvent | null
      installed: boolean
    }
  }
}

export function InstallApp() {
  const [installed, setInstalled] = useState(false)
  const [available, setAvailable] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [showIosGuide, setShowIosGuide] = useState(false)
  const prompting = useRef(false)
  const guideRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sync = () => {
      setInstalled(window.daisukiPwa?.installed ?? false)
      setAvailable(Boolean(window.daisukiPwa?.prompt))
      if (window.daisukiPwa?.prompt) setMessage('')
    }
    window.addEventListener('daisuki:pwa-change', sync)
    sync()
    return () => window.removeEventListener('daisuki:pwa-change', sync)
  }, [])

  useEffect(() => {
    if (showIosGuide) guideRef.current?.scrollIntoView({ block: 'nearest' })
  }, [showIosGuide])

  async function install() {
    if (prompting.current) return
    const state = window.daisukiPwa
    const deferredPrompt = state?.prompt
    if (!deferredPrompt) {
      const isIos =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      if (isIos) {
        setShowIosGuide(true)
        setMessage('')
        return
      }
      setShowIosGuide(false)
      setMessage(
        !window.isSecureContext
          ? 'Buka alamat HTTPS Daisuki agar aplikasi dapat diinstal di ponsel.'
          : 'Di Android, buka menu Chrome lalu pilih Instal aplikasi atau Tambahkan ke layar utama. Dialog instalasi akan muncul di sini saat Chrome menyediakannya.',
      )
      return
    }

    setShowIosGuide(false)
    prompting.current = true
    setPending(true)
    setMessage('')
    state.prompt = null
    window.dispatchEvent(new Event('daisuki:pwa-change'))

    try {
      // Keep prompt() in the click handler so the browser receives the user gesture.
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      setMessage(
        outcome === 'accepted'
          ? 'Permintaan instalasi diterima. Ikuti proses instalasi dari browser.'
          : 'Instalasi dibatalkan. Anda tetap dapat menggunakan Daisuki di browser.',
      )
    } catch {
      setMessage(
        'Dialog instalasi belum bisa dibuka. Coba melalui menu Instal aplikasi di browser.',
      )
    } finally {
      prompting.current = false
      setPending(false)
    }
  }

  if (installed) return null

  return (
    <div className="mt-6 border-t border-line pt-5">
      <button
        type="button"
        onClick={() => void install()}
        disabled={pending}
        aria-describedby="install-app-description"
        aria-expanded={showIosGuide ? true : undefined}
        aria-controls={showIosGuide ? 'install-ios-guide' : undefined}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-700 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="size-4" aria-hidden="true" />
        )}
        {pending
          ? 'Membuka instalasi…'
          : available
            ? 'Instal aplikasi Daisuki'
            : 'Cara pasang aplikasi Daisuki'}
      </button>
      <p
        id="install-app-description"
        className="mt-2 text-center text-xs leading-5 text-muted"
      >
        {available
          ? 'Ketuk untuk membuka dialog instalasi. Pilih Instal agar Daisuki terpasang di ponsel.'
          : 'Saat dialog instalasi tersedia, tombol ini akan berubah menjadi Instal aplikasi.'}
      </p>
      <p
        role="status"
        aria-live="polite"
        className="mt-2 text-sm leading-6 text-muted"
      >
        {message}
      </p>
      {showIosGuide ? (
        <div
          id="install-ios-guide"
          ref={guideRef}
          className="mt-4 rounded-lg border border-line bg-ink-50 p-4 text-sm leading-6 text-ink-900"
        >
          <p className="font-semibold">Pasang di layar utama iPhone</p>
          <p className="mt-1 text-muted">
            Buka halaman ini di Safari dengan alamat HTTPS, lalu:
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 marker:font-semibold">
            <li>
              Di Safari, ketuk Bagikan{' '}
              <Share className="inline size-4 align-[-2px]" aria-hidden="true" />.
            </li>
            <li>Pilih Tambahkan ke Layar Utama.</li>
            <li>Aktifkan Buka sebagai App Web, lalu ketuk Tambah.</li>
          </ol>
          <p className="mt-3 text-muted">
            Setelah ikon Daisuki muncul, ketuk ikonnya untuk membuka aplikasi.
          </p>
        </div>
      ) : null}
    </div>
  )
}
