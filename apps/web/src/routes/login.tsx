import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Building2, Loader2, Package, Store } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { InstallApp } from '@/components/install-app'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const { user, login, quickLogin, isLoading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pendingAction, setPendingAction] = useState<
    'form' | 'admin' | 'mitra' | null
  >(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && user) {
      void navigate({ to: user.role === 'admin' ? '/admin' : '/mitra' })
    }
  }, [isLoading, navigate, user])

  async function finishLogin(result: Awaited<ReturnType<typeof login>>) {
    if (!result.success || !result.role) {
      setError(
        result.error ?? 'Login belum berhasil. Periksa kembali data Anda.',
      )
      return
    }

    await navigate({ to: result.role === 'admin' ? '/admin' : '/mitra' })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPendingAction('form')
    await finishLogin(await login(email, password))
    setPendingAction(null)
  }

  async function handleDemo(type: 'admin' | 'mitra') {
    setError(null)
    setPendingAction(type)
    await finishLogin(await quickLogin(type))
    setPendingAction(null)
  }

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper p-6">
        <p className="text-sm font-medium text-muted" role="status">
          Memeriksa sesi login...
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-8 sm:grid sm:place-items-center sm:px-6">
      <section className="mx-auto w-full max-w-5xl overflow-hidden rounded-lg border border-line bg-surface lg:grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-between bg-ink-900 p-6 text-white sm:p-9">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-md bg-white text-ume">
                <Package className="size-6" aria-hidden="true" />
              </span>
              <p className="font-display text-xl font-semibold">
                Daisuki Inventory
              </p>
            </div>
            <h1 className="mt-10 max-w-md text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Stok cabang dan restock dalam satu alur kerja.
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-ink-100">
              Mitra melaporkan stok fisik. Admin pusat menindak stok kritis dan
              pesanan masuk.
            </p>
          </div>
          <p className="mt-10 text-sm text-ink-100">
            Akun demo memakai kata sandi{' '}
            <span className="font-semibold text-white">password123</span>.
          </p>
        </div>

        <div className="p-6 sm:p-9">
          <div className="max-w-lg">
            <p className="text-sm font-semibold text-ume">Akses operasional</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink-900">
              Masuk ke akun Anda
            </h2>
            <p className="mt-2 text-sm text-muted">
              Gunakan akun cabang atau akun admin pusat.
            </p>
          </div>

          <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-ink-900"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@daisuki.test"
                className="min-h-12 w-full rounded-sm border border-line bg-white px-3 text-base text-text placeholder:text-stale focus:border-ink-700"
                required
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-semibold text-ink-900"
              >
                Kata sandi
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-h-12 w-full rounded-sm border border-line bg-white px-3 text-base text-text focus:border-ink-700"
                required
                minLength={8}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>

            {error ? (
              <p
                id="login-error"
                className="rounded-sm bg-crit-bg p-3 text-sm font-medium text-crit-fg"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pendingAction !== null}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-ink-700 px-4 font-semibold text-white hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingAction === 'form' ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Masuk ke portal
            </button>
          </form>

          <InstallApp />

          <div className="mt-8 border-t border-line pt-6">
            <p className="text-sm font-semibold text-ink-900">Akses demo</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleDemo('admin')}
                disabled={pendingAction !== null}
                className="flex min-h-14 items-center gap-3 rounded-md border border-ink-700 bg-white px-3 text-left text-sm font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-60"
              >
                {pendingAction === 'admin' ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Building2 className="size-5" aria-hidden="true" />
                )}
                Login Demo Admin
              </button>
              <button
                type="button"
                onClick={() => void handleDemo('mitra')}
                disabled={pendingAction !== null}
                className="flex min-h-14 items-center gap-3 rounded-md border border-line bg-ink-50 px-3 text-left text-sm font-semibold text-ink-900 hover:border-ink-500 disabled:opacity-60"
              >
                {pendingAction === 'mitra' ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Store className="size-5 text-ume" aria-hidden="true" />
                )}
                Login Demo Mitra
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
