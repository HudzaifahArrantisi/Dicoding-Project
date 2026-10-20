import { Dialog } from 'radix-ui'
import { Clock, X } from 'lucide-react'
import type { StockLog } from '@/lib/inventory-types'

export interface StockLogBatch {
  key: string
  timeFormatted: string
  timeRaw: string
  dateStr: string
  source: string
  sourceLabel: string
  totalItems: number
  totalConsumed: number
  totalRestocked: number
  logs: StockLog[]
}

export function BatchDetailModal({
  batch,
  partnerName,
  dateLabel,
  open,
  onOpenChange,
}: {
  batch: StockLogBatch | null
  partnerName: string
  dateLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!batch) return null

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink-900/60 backdrop-blur-xs animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] max-h-[88vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-white shadow-2xl focus:outline-none animate-in fade-in zoom-in-95 duration-200">
          {/* Header Sticky */}
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-ink-50/95 p-4 backdrop-blur-sm sm:p-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Dialog.Title className="inline-flex items-center gap-1.5 font-display text-base font-bold text-ink-900 sm:text-lg">
                  <Clock className="size-4 text-ink-700" aria-hidden="true" />
                  {batch.timeFormatted}
                </Dialog.Title>
                <span
                  className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
                    batch.source === 'order_received'
                      ? 'bg-ok-bg text-ok-fg'
                      : 'bg-ink-100 text-ink-700'
                  }`}
                >
                  {batch.sourceLabel}
                </span>
              </div>
              <Dialog.Description className="mt-1 truncate text-xs text-muted sm:text-sm">
                <span className="font-medium text-ink-900">{partnerName}</span> ·{' '}
                {dateLabel}
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-muted transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-ink-700"
                aria-label="Tutup rincian log"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {/* Ringkasan Perubahan Ringkas */}
          <div className="flex items-center justify-between gap-2 border-b border-line bg-white px-4 py-2.5 text-xs sm:px-5">
            <span className="font-medium text-muted">
              {batch.totalItems} Produk
            </span>
            <div className="flex items-center gap-1.5 font-bold tabular-nums">
              {batch.totalConsumed > 0 ? (
                <span className="rounded bg-crit-bg px-2 py-0.5 text-crit-fg">
                  −{batch.totalConsumed} pcs
                </span>
              ) : null}
              {batch.totalRestocked > 0 ? (
                <span className="rounded bg-ok-bg px-2 py-0.5 text-ok-fg">
                  +{batch.totalRestocked} pcs
                </span>
              ) : null}
            </div>
          </div>

          {/* List Item Perubahan */}
          <div className="p-4 sm:p-5">
            <div className="space-y-2.5">
              {batch.logs.map((log) => {
                const isConsumption = log.delta > 0
                const isRestock = log.delta < 0
                return (
                  <div
                    key={log.id}
                    className="rounded-lg border border-line bg-white p-3 shadow-2xs transition-colors hover:border-ink-400"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink-900">
                        {log.product_name}
                      </span>
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold tabular-nums ${
                          isConsumption
                            ? 'bg-crit-bg text-crit-fg'
                            : isRestock
                              ? 'bg-ok-bg text-ok-fg'
                              : 'bg-ink-100 text-muted'
                        }`}
                      >
                        {isConsumption
                          ? `−${log.delta} pcs`
                          : isRestock
                            ? `+${Math.abs(log.delta)} pcs`
                            : '0 pcs'}
                      </span>
                    </div>

                    {/* Alur Kalkulasi Ringkas: Awal: 30 pcs − 5 pcs = Sisa: 25 pcs */}
                    <div className="mt-2 flex items-center justify-between rounded-md bg-ink-50/70 px-2.5 py-1.5 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-muted">Awal:</span>
                        <span className="font-semibold tabular-nums text-ink-900">
                          {log.qty_before} pcs
                        </span>
                      </div>

                      <span
                        className="font-bold text-muted"
                        aria-hidden="true"
                      >
                        {isConsumption ? '−' : isRestock ? '+' : '→'}
                      </span>

                      <div className="flex items-center gap-1">
                        <span
                          className={`font-semibold tabular-nums ${
                            isConsumption
                              ? 'text-crit-fg'
                              : isRestock
                                ? 'text-ok-fg'
                                : 'text-ink-700'
                          }`}
                        >
                          {Math.abs(log.delta)} pcs
                        </span>
                      </div>

                      <span
                        className="font-bold text-muted"
                        aria-hidden="true"
                      >
                        =
                      </span>

                      <div className="flex items-center gap-1">
                        <span className="text-muted">Sisa:</span>
                        <span className="font-display font-bold tabular-nums text-ink-900">
                          {log.qty_after} pcs
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer Sticky */}
          <div className="sticky bottom-0 flex justify-end border-t border-line bg-paper/95 p-3 backdrop-blur-sm sm:px-5">
            <Dialog.Close asChild>
              <button
                type="button"
                className="min-h-9 rounded-md border border-line bg-white px-4 text-xs font-semibold text-ink-900 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
              >
                Tutup
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
