import { Dialog } from 'radix-ui'
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Package,
  ShieldAlert,
  X,
} from 'lucide-react'

export interface DeficitItem {
  partner_id: string
  partner_name: string
  partner_type: string
  product_id: string
  product_name: string
  current_qty: number
  par_level: number
  days_of_cover: number
  critical_frequency: number
  root_cause: 'UNDER_CAPACITY' | 'LATE_REORDER' | 'SUPPLY_DEFICIT'
  root_cause_label: string
  risk_level: 'DARURAT' | 'WASPADA'
  action_recommendation: string
}

export interface PartnerDeficitGroup {
  partner_id: string
  partner_name: string
  partner_type: string
  highest_risk_level: 'DARURAT' | 'WASPADA'
  items: DeficitItem[]
  total_products: number
  stockout_count: number
  min_days_of_cover: number
  min_qty: number
  primary_root_cause_label: string
  primary_action_recommendation: string
}

export function PartnerDeficitModal({
  group,
  open,
  onOpenChange,
  onReviewOrders,
}: {
  group: PartnerDeficitGroup | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onReviewOrders?: () => void
}) {
  if (!group) return null

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-xs animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] max-w-3xl sm:max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl focus:outline-none animate-in fade-in zoom-in-95 duration-200">
          {/* Header Dialog */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white/95 px-6 py-4.5 backdrop-blur-md">
            <div className="flex items-center gap-3.5 min-w-0">
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ${
                  group.highest_risk_level === 'DARURAT'
                    ? 'bg-rose-50 text-crit-fg ring-rose-200'
                    : 'bg-amber-50 text-amber-700 ring-amber-200'
                }`}
              >
                <AlertTriangle className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Dialog.Title className="truncate font-display text-lg font-bold text-ink-900 sm:text-xl">
                    {group.partner_name}
                  </Dialog.Title>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      group.highest_risk_level === 'DARURAT'
                        ? 'bg-crit-bg text-crit-fg'
                        : 'bg-warn-bg text-warn-fg'
                    }`}
                  >
                    {group.highest_risk_level === 'DARURAT'
                      ? 'Darurat Kritis'
                      : 'Waspada Defisit'}
                  </span>
                  {group.partner_type ? (
                    <span className="rounded-full bg-ink-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-muted ring-1 ring-line">
                      {group.partner_type}
                    </span>
                  ) : null}
                </div>
                <Dialog.Description className="mt-0.5 text-xs text-muted">
                  Rincian risiko stok dan rekomendasi tindakan per kategori produk untuk cabang ini.
                </Dialog.Description>
              </div>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-ink-700 cursor-pointer"
                aria-label="Tutup dialog rincian risiko"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-6 p-6">
            {/* KPI Cards Ringkasan Risiko Cabang */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="dashboard-surface rounded-xl border border-line bg-ink-50/40 p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <Package className="size-3.5 text-ink-700" />
                  Produk Rawan Defisit
                </p>
                <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-ink-900">
                  {group.total_products}{' '}
                  <span className="text-sm font-normal text-muted">produk</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {group.stockout_count > 0 ? (
                    <span className="font-semibold text-crit-fg">
                      {group.stockout_count} produk habis (0 pcs)
                    </span>
                  ) : (
                    <span>Semua produk masih memiliki sisa stok</span>
                  )}
                </p>
              </div>

              <div className="dashboard-surface rounded-xl border border-line bg-ink-50/40 p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <Clock className="size-3.5 text-crit-fg" />
                  Cakupan Stok Terendah
                </p>
                <p
                  className={`mt-1.5 font-display text-2xl font-bold tabular-nums ${
                    group.min_days_of_cover < 1
                      ? 'text-crit-fg'
                      : 'text-warn-fg'
                  }`}
                >
                  {group.min_days_of_cover}{' '}
                  <span className="text-sm font-normal text-muted">hari</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {group.min_days_of_cover === 0
                    ? 'Stok sudah habis hari ini'
                    : `Bertahan sekitar ${Math.ceil(group.min_days_of_cover)} hari`}
                </p>
              </div>

              <div className="dashboard-surface rounded-xl border border-line bg-ink-50/40 p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <ShieldAlert className="size-3.5 text-amber-600" />
                  Penyebab Dominan
                </p>
                <p
                  className="mt-1.5 truncate font-display text-base font-bold text-ink-900"
                  title={group.primary_root_cause_label}
                >
                  {group.primary_root_cause_label}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Prioritas penanganan logistik
                </p>
              </div>
            </div>

            {/* Tabel Produk Rawan di Cabang Ini */}
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="border-b border-line bg-ink-50/80 px-4 py-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                    Rincian Kategori Produk yang Berisiko di Cabang Ini
                  </h4>
                  <span className="text-xs font-semibold text-ink-700">
                    {group.items.length} produk terdeteksi
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="border-b border-line bg-ink-50/40 text-xs font-semibold text-muted">
                    <tr>
                      <th className="px-4 py-3">Nama Produk</th>
                      <th className="px-4 py-3 text-right">Sisa Stok</th>
                      <th className="px-4 py-3 text-right">Cakupan Stok</th>
                      <th className="px-4 py-3">Akar Masalah</th>
                      <th className="px-4 py-3">Rekomendasi Tindakan Solusi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {group.items.map((item) => (
                      <tr
                        key={item.product_id}
                        className="transition-colors hover:bg-ink-50/30"
                      >
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-ink-900">
                            {item.product_name}
                          </p>
                          <span className="text-[11px] text-muted">
                            {item.critical_frequency}x fase kritis
                          </span>
                        </td>
                        <td className="num px-4 py-3.5 text-right tabular-nums">
                          <span
                            className={`inline-block font-bold ${
                              item.current_qty === 0
                                ? 'text-crit-fg'
                                : 'text-ink-900'
                            }`}
                          >
                            {item.current_qty} pcs
                          </span>
                        </td>
                        <td className="num px-4 py-3.5 text-right tabular-nums">
                          <span
                            className={`font-semibold ${
                              item.days_of_cover < 2
                                ? 'text-crit-fg'
                                : 'text-warn-fg'
                            }`}
                          >
                            {item.days_of_cover} hari
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${
                              item.root_cause === 'UNDER_CAPACITY'
                                ? 'bg-amber-100 text-amber-800'
                                : item.root_cause === 'LATE_REORDER'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {item.root_cause_label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs leading-relaxed text-ink-800">
                          <p className="border-l-2 border-ink-600 pl-2.5">
                            {item.action_recommendation}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/80 pt-4">
              <p className="text-xs text-muted">
                Keputusan alokasi pengiriman dan persetujuan tetap wewenang admin pusat.
              </p>
              <div className="flex items-center gap-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="min-h-10 rounded-md border border-line bg-white px-4 text-xs font-semibold text-ink-900 hover:bg-ink-50 cursor-pointer shadow-2xs"
                  >
                    Tutup
                  </button>
                </Dialog.Close>
                {onReviewOrders ? (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false)
                      onReviewOrders()
                    }}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-ink-900 px-4 text-xs font-semibold text-white hover:bg-ink-700 cursor-pointer shadow-2xs"
                  >
                    <span>Tinjau Persetujuan Pesanan</span>
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
