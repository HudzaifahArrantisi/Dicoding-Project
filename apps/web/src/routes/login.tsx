import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { InstallApp } from '@/components/install-app'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const { user, login, isLoading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pendingAction, setPendingAction] = useState<'form' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && user) {
      void navigate({ to: user.role === 'admin' ? '/admin' : '/mitra' })
    }
  }, [isLoading, navigate, user])

  async function finishLogin(result: Awaited<ReturnType<typeof login>>) {
    if (!result.success || !result.role) {
      const msg = result.error?.trim()
      const displayMessage =
        msg && msg !== '[object Object]'
          ? msg
          : 'Email atau password salah'
      setError(displayMessage)
      return
    }

    await navigate({ to: result.role === 'admin' ? '/admin' : '/mitra' })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPendingAction('form')
    await finishLogin(await login(email.trim(), password))
    setPendingAction(null)
  }

  if (isLoading) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6">
        <div
          className="flex items-center gap-3 text-sm text-muted"
          role="status"
        >
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          Memeriksa sesi login...
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-paper sm:grid sm:place-items-center sm:px-6 sm:py-10">
      <section className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col bg-paper sm:block sm:min-h-0 sm:overflow-hidden sm:rounded-2xl sm:border sm:border-line sm:bg-white sm:shadow-[0_20px_55px_-45px_rgba(20,27,61,0.35)] lg:grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative isolate flex flex-col overflow-hidden bg-[#a9000c] px-6 pb-7 pt-8 text-white sm:px-10 sm:pb-9 sm:pt-10 lg:justify-between lg:px-12 lg:py-12">
          <img
            src="/icons/logo.jpg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 bottom-0 -z-20 size-64 object-contain opacity-90 lg:-right-10 lg:bottom-16 lg:size-72"
            style={{ maskImage: 'radial-gradient(ellipse at center, black 38%, transparent 76%)' }}
          />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(105deg,rgba(42,0,8,0.92)_0%,rgba(62,0,11,0.85)_52%,rgba(68,0,12,0.48)_100%)]" aria-hidden="true" />
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl font-semibold tracking-tight text-white">
              Daisuki
            </span>
            <span className="text-sm text-white/85">Inventory</span>
          </div>

          <div className="mt-10 max-w-sm lg:mb-2 lg:mt-24">
            <div
              className="mb-5 h-1 w-10 rounded-full bg-white/80"
              aria-hidden="true"
            />
            <h1 className="font-display text-[clamp(1.8rem,3.3vw,2.55rem)] font-semibold leading-[1.15] text-white">
              Stok cabang dan restock, lebih mudah diikuti.
            </h1>
            <p className="mt-4 max-w-xs text-sm leading-6 text-white/90 sm:text-base sm:leading-7">
              Satu tempat untuk laporan stok mitra dan tindak lanjut pesanan
              oleh admin pusat.
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 sm:block sm:bg-white sm:px-10 sm:pb-10 sm:pt-10 lg:px-12 lg:py-12">
          <div className="mx-auto max-w-sm">
            <h2 className="font-display text-2xl font-semibold text-ink-900">
              Masuk ke akun
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Gunakan email atau username dan kata sandi akun Daisuki Anda.
            </p>

            <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-ink-900"
                >
                  Email atau username
                </label>
                <input
                  id="email"
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email atau username"
                  className="min-h-12 w-full rounded-lg border border-[#858e9d] bg-white px-4 text-base text-text placeholder:text-[#687080] focus-visible:border-ink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
                  required
                  aria-describedby={error ? 'login-error' : undefined}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-ink-900"
                >
                  Kata sandi
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Masukkan kata sandi"
                    className="min-h-12 w-full rounded-lg border border-[#858e9d] bg-white py-2 pl-4 pr-14 text-base text-text placeholder:text-[#687080] focus-visible:border-ink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
                    required
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-1 top-1 grid size-10 place-items-center rounded-md text-muted hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
                    aria-label={
                      showPassword
                        ? 'Sembunyikan kata sandi'
                        : 'Tampilkan kata sandi'
                    }
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <EyeOff className="size-5" aria-hidden="true" />
                    ) : (
                      <Eye className="size-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {error ? (
                <p
                  id="login-error"
                  role="alert"
                  className="rounded-lg border border-crit/25 bg-crit-bg px-3 py-2.5 text-sm leading-5 text-crit-fg"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={pendingAction !== null}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 disabled:cursor-wait disabled:opacity-60"
              >
                {pendingAction === 'form' ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    Sedang masuk...
                  </>
                ) : (
                  'Masuk'
                )}
              </button>
            </form>

            <InstallApp />
          </div>
        </div>
      </section>
    </main>
  )
}
