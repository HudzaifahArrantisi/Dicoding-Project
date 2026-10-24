import { Dialog } from 'radix-ui'
import { Building2, Clock, X } from 'lucide-react'
import type { StockStatus } from '@daisuki/shared'
import { RakBar } from './rak-bar'
import { StaleBadge, StockStatusBadge } from './status-badge'
import type { StockItem } from '@/lib/inventory-types'

export interface PartnerStockGroup {
  partner_id: string
  partner_name: string
  partner_type: string
  overall_status: StockStatus
  is_stale: boolean
  items: StockItem[]
}

function formatShortDateTime(
  dateInput: string | Date | null | undefined,
): string {
  if (!dateInput) return '—'
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (Number.isNaN(date.getTime())) return String(dateInput)

  const datePart = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)

  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${datePart}, ${hours}.${minutes} WIB`
}

export function PartnerStockDetailModal({
  group,
  open,
  onOpenChange,
}: {
  group: PartnerStockGroup | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!group) return null

  const criticalCount = group.items.filter((i) => i.status === 'kritis').length
  const warningCount = group.items.filter((i) => i.status === 'waspada').length
  const safeCount = group.items.filter((i) => i.status === 'aman').length

  const latestUpdate = group.items.reduce<string | null>((latest, item) => {
    if (!item.updated_at) return latest
    if (!latest) return item.updated_at
    return new Date(item.updated_at) > new Date(latest)
      ? item.updated_at
      : latest
  }, null)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-xs animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg sm:max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-white shadow-2xl focus:outline-none animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white/95 px-5 py-4 backdrop-blur-sm">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                  group.overall_status === 'kritis'
                    ? 'bg-crit-bg text-crit'
                    : group.overall_status === 'waspada'
                      ? 'bg-warn-bg text-warn'
                      : 'bg-ok-bg text-ok'
                }`}
              >
                <Building2 className="size-4.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Dialog.Title className="truncate font-display text-base font-bold text-ink-900 sm:text-lg">
                    {group.partner_name}
                  </Dialog.Title>
                  <StockStatusBadge status={group.overall_status} />
                  {group.is_stale ? <StaleBadge /> : null}
                </div>
                <Dialog.Description className="mt-0.5 truncate text-xs text-muted">
                  Cabang{' '}
                  <span className="capitalize">{group.partner_type}</span>
                  {latestUpdate
                    ? ` · Update: ${formatShortDateTime(latestUpdate)}`
                    : ''}
                </Dialog.Description>
              </div>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Tutup detail stok mitra"
                className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-white text-muted transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-ink-700"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4 p-5">
            {/* Stale Warning Banner (hanya tampil jika terlambat update) */}
            {group.is_stale ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-stale/30 bg-stale-bg px-3.5 py-2.5 text-xs text-stale-fg">
                <Clock
                  className="size-4 shrink-0 text-stale"
                  aria-hidden="true"
                />
                <span>
                  Stok belum diperbarui oleh mitra dalam 24 jam terakhir.
                </span>
              </div>
            ) : null}

            {/* Ringkasan Status Simpel & Clean */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper px-3.5 py-2 text-xs">
              <span className="font-medium text-muted">
                Ringkasan ({group.items.length} Produk)
              </span>
              <div className="flex items-center gap-3">
                {safeCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-ok-fg">
                    <span className="size-1.5 rounded-full bg-ok" />
                    {safeCount} Aman
                  </span>
                ) : null}
                {warningCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-warn-fg">
                    <span className="size-1.5 rounded-full bg-warn" />
                    {warningCount} Waspada
                  </span>
                ) : null}
                {criticalCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-crit-fg">
                    <span className="size-1.5 rounded-full bg-crit" />
                    {criticalCount} Kritis
                  </span>
                ) : null}
              </div>
            </div>

            {/* Daftar Produk dengan Grid Terstruktur & Lurus Sempurna */}
            <div className="overflow-hidden rounded-xl border border-line bg-white shadow-xs">
              {/* Tampilan Mobile: Kartu Vertikal Responsif & Rapi */}
              <div className="divide-y divide-line sm:hidden">
                {group.items.map((stock) => (
                  <div key={stock.product_id} className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className="truncate text-sm font-semibold text-ink-900"
                        title={stock.product_name}
                      >
                        {stock.product_name}
                      </p>
                      <StockStatusBadge status={stock.status} />
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <RakBar
                          percentage={stock.percentage}
                          status={stock.status}
                          label={`${stock.product_name}: ${stock.percentage} persen`}
                        />
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-display text-sm font-bold tabular-nums text-ink-900">
                          {stock.current_qty}
                        </span>
                        <span className="text-xs text-muted">
                          /{stock.par_level}
                        </span>
                        <span className="ml-1 text-[11px] font-semibold tabular-nums text-muted">
                          ({Math.round(stock.percentage)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tampilan Desktop: Tabel Grid Presisi */}
              <div className="hidden sm:block">
                {/* Header Kolom Tabel */}
                <div className="grid grid-cols-[minmax(0,1fr)_130px_60px_90px] items-center gap-4 border-b border-line bg-paper/70 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <span>Produk</span>
                  <span className="text-center">Kapasitas Rak</span>
                  <span className="text-right">Sisa / Par</span>
                  <span className="text-right">Status</span>
                </div>

                {/* Baris Produk */}
                <div className="divide-y divide-line">
                  {group.items.map((stock) => (
                    <div
                      key={stock.product_id}
                      className="grid grid-cols-[minmax(0,1fr)_130px_60px_90px] items-center gap-4 px-4 py-3 transition-colors hover:bg-paper/40"
                    >
                      {/* 1. Nama Produk */}
                      <div className="min-w-0 pr-1">
                        <p
                          className="truncate text-sm font-medium text-ink-900"
                          title={stock.product_name}
                        >
                          {stock.product_name}
                        </p>
                      </div>

                      {/* 2. Visual Petak Rak */}
                      <div className="w-full">
                        <RakBar
                          percentage={stock.percentage}
                          status={stock.status}
                          label={`${stock.product_name}: ${stock.percentage} persen`}
                        />
                      </div>

                      {/* 3. Angka Stok Tabular */}
                      <div className="text-right whitespace-nowrap">
                        <span className="font-display text-sm font-semibold tabular-nums text-ink-900">
                          {stock.current_qty}
                        </span>
                        <span className="text-xs text-muted">
                          /{stock.par_level}
                        </span>
                      </div>

                      {/* 4. Status Badge */}
                      <div className="flex justify-end">
                        <StockStatusBadge status={stock.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Simpel */}
          <div className="sticky bottom-0 flex items-center justify-between border-t border-line bg-paper/90 px-5 py-3 backdrop-blur-sm">
            <span className="text-xs text-muted">Data sinkron otomatis</span>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex min-h-9 items-center justify-center rounded-md border border-line bg-white px-4 text-xs font-semibold text-ink-900 shadow-xs transition hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-ink-700"
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
