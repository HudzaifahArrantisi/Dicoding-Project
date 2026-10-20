import { useEffect, useRef, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

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
  const prompting = useRef(false)

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

  async function install() {
    if (prompting.current) return
    const state = window.daisukiPwa
    const deferredPrompt = state?.prompt
    if (!deferredPrompt) {
      const isIos =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      setMessage(
        !window.isSecureContext
          ? 'Buka alamat HTTPS Daisuki agar aplikasi dapat diinstal di ponsel.'
          : isIos
            ? 'Buka di Safari, pilih Bagikan, lalu Tambahkan ke Layar Utama.'
            : 'Jika dialog belum tersedia, buka menu browser (⋮), lalu pilih Instal aplikasi atau Tambahkan ke layar utama. Gunakan Chrome di luar mode samaran.',
      )
      return
    }

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
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-700 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="size-4" aria-hidden="true" />
        )}
        {pending ? 'Membuka instalasi…' : 'Instal aplikasi Daisuki'}
      </button>
      <p
        id="install-app-description"
        className="mt-2 text-center text-xs leading-5 text-muted"
      >
        {available
          ? 'Pasang di layar utama. Pilih Instal atau Batal pada dialog browser.'
          : 'Akses Daisuki langsung dari layar utama ponsel.'}
      </p>
      <p
        role="status"
        aria-live="polite"
        className="mt-2 text-sm leading-6 text-muted"
      >
        {message}
      </p>
    </div>
  )
}
