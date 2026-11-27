import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import type { AssistantQuotaStatus } from '@/lib/api/assistant'

export function formatCountdownHms(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function useQuotaCountdown(quota: AssistantQuotaStatus | null, onCooldownExpired?: () => void) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!quota?.reset_at && !(quota?.burst_cooldown_seconds && quota.burst_cooldown_seconds > 0)) {
      return
    }
    setNowMs(Date.now())
    const timer = window.setInterval(() => {
      const current = Date.now()
      setNowMs(current)
      if (quota.reset_at) {
        const target = new Date(quota.reset_at).getTime()
        if (current >= target) {
          window.clearInterval(timer)
          onCooldownExpired?.()
        }
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [quota?.reset_at, quota?.burst_cooldown_seconds, onCooldownExpired])

  const resetAtMs = quota?.reset_at ? new Date(quota.reset_at).getTime() : null
  const remainingWindowSeconds =
    resetAtMs !== null ? Math.max(0, Math.ceil((resetAtMs - nowMs) / 1000)) : 0

  const isExhausted = Boolean(quota && quota.remaining <= 0 && remainingWindowSeconds > 0)

  return {
    remainingWindowSeconds,
    countdownLabel: remainingWindowSeconds > 0 ? formatCountdownHms(remainingWindowSeconds) : null,
    isExhausted,
  }
}

export function ChatQuotaBar({
  quota,
  accountLabel,
  compact = false,
  onCooldownExpired,
}: {
  quota: AssistantQuotaStatus | null
  accountLabel: string
  compact?: boolean
  onCooldownExpired?: () => void
}) {
  const { remainingWindowSeconds, countdownLabel, isExhausted } = useQuotaCountdown(
    quota,
    onCooldownExpired,
  )

  if (!quota) return null

  const used = Math.min(quota.limit, Math.max(0, quota.used))
  const limit = Math.max(1, quota.limit)
  const remaining = Math.max(0, limit - used)
  const ratio = Math.min(100, Math.round((used / limit) * 100))

  const level: 'ok' | 'warn' | 'crit' =
    isExhausted || ratio >= 85 ? 'crit' : ratio >= 60 ? 'warn' : 'ok'

  const fillClass =
    level === 'crit' ? 'bg-crit' : level === 'warn' ? 'bg-warn' : 'bg-ok'

  return (
    <div
      role="region"
      aria-label={`Status kuota chat ${accountLabel}`}
      className={`border-b border-line bg-paper/80 ${
        compact ? 'px-3.5 py-2' : 'px-3 py-2 sm:px-6 sm:py-2.5'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-ink-900">
            Kuota {accountLabel}:{' '}
            <strong className="font-display font-bold tabular-nums text-ink-950">
              {used}/{limit}
            </strong>{' '}
            pesan
          </span>
          <span className="hidden text-muted sm:inline">•</span>
          <span className="hidden tabular-nums text-ink-700 sm:inline">
            Sisa {remaining} pesan
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-medium tabular-nums text-ink-700">
          <Clock className="size-3.5 shrink-0 text-ink-500" aria-hidden="true" />
          {remainingWindowSeconds > 0 && countdownLabel ? (
            <span>
              {isExhausted ? 'Buka kembali dalam ' : `Cooldown ${quota.window_hours}j: `}
              <strong
                className={`font-display font-bold tabular-nums ${
                  isExhausted ? 'text-crit-fg' : 'text-ink-950'
                }`}
              >
                {countdownLabel}
              </strong>
            </span>
          ) : (
            <span>Jendela {quota.window_hours} jam siap</span>
          )}
        </div>
      </div>

      <div
        role="progressbar"
        aria-label={`Pemakaian kuota chat ${accountLabel}`}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        aria-valuetext={`${used} dari ${limit} pesan terpakai dalam ${quota.window_hours} jam`}
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full border border-line/80 bg-surface"
      >
        <div
          className={`h-full rounded-full transition-[width,background-color] duration-300 ease-out ${fillClass}`}
          style={{ width: `${Math.max(used > 0 ? 4 : 0, ratio)}%` }}
        />
      </div>
    </div>
  )
}
