import type { StockStatus } from '@daisuki/shared'

interface RakBarProps {
  percentage: number
  status: StockStatus
  compact?: boolean
  label: string
}

const statusFill: Record<StockStatus, string> = {
  aman: 'bg-ok',
  waspada: 'bg-warn',
  kritis: 'bg-crit',
}

export function RakBar({
  percentage,
  status,
  compact = false,
  label,
}: RakBarProps) {
  const slotCount = compact ? 5 : 10
  const filled = Math.min(
    slotCount,
    Math.max(0, Math.ceil((percentage / 100) * slotCount)),
  )

  return (
    <div className="flex min-w-20 flex-1 gap-0.5" role="img" aria-label={label}>
      {Array.from({ length: slotCount }, (_, index) => (
        <span
          key={index}
          className={`${compact ? 'h-2' : 'h-3'} flex-1 rounded-[2px] ${
            index < filled ? statusFill[status] : 'bg-line'
          }`}
        />
      ))}
    </div>
  )
}
