import type { StockStatus } from '@daisuki/shared'
import { cn } from 'cn'

interface RakBarProps {
  percentage: number
  status: StockStatus
  compact?: boolean
  label: string
  className?: string
  slotCount?: number
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
  className,
  slotCount: customSlotCount,
}: RakBarProps) {
  const slotCount = customSlotCount ?? 10
  // Jika stok > 0 maka minimal 1 slot terisi agar tidak terlihat kosong total
  const filled = Math.min(
    slotCount,
    Math.max(
      percentage > 0 ? 1 : 0,
      Math.round((percentage / 100) * slotCount),
    ),
  )

  return (
    <div
      className={cn(
        'flex w-full items-center gap-1 rounded-md border border-line/80 bg-paper/90 p-1 shadow-2xs',
        className,
      )}
      role="img"
      aria-label={label}
    >
      {Array.from({ length: slotCount }, (_, index) => (
        <span
          key={index}
          className={cn(
            'flex-1 rounded-[2px] transition-colors',
            compact ? 'h-2' : 'h-2.5',
            index < filled
              ? statusFill[status]
              : 'bg-slate-200/90 dark:bg-slate-700/80',
          )}
        />
      ))}
    </div>
  )
}
