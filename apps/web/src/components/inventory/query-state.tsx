import { AlertTriangle, Inbox, RotateCw } from 'lucide-react'

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="space-y-3 py-6" role="status" aria-live="polite">
      <p className="text-sm font-medium text-muted">{label}</p>
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-20 animate-pulse rounded-md border border-line bg-ink-50"
        />
      ))}
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div
      className="rounded-md border border-crit/30 bg-crit-bg p-4"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 size-5 shrink-0 text-crit-fg"
          aria-hidden="true"
        />
        <div>
          <p className="font-semibold text-crit-fg">Data belum dapat dimuat</p>
          <p className="mt-1 text-sm text-crit-fg">{message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-crit/40 bg-white px-3 text-sm font-semibold text-crit-fg hover:bg-crit-bg"
          >
            <RotateCw className="size-4" aria-hidden="true" />
            Muat ulang data
          </button>
        </div>
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-dashed border-line bg-ink-50 p-6 text-center">
      <Inbox className="mx-auto size-6 text-muted" aria-hidden="true" />
      <p className="mt-2 font-semibold text-ink-900">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
