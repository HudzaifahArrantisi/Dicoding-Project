import { Dialog } from 'radix-ui'
import {
  ArrowUpRight,
  Building2,
  Flame,
  TrendingUp,
  X,
} from 'lucide-react'

export interface FastMovingProductItem {
  partner_id: string
  partner_name: string
  partner_type: string
  product_id: string
  product_name: string
  product_sku: string
  current_qty: number
  par_level: number
  weekly_consumption: number
  daily_velocity: number
  critical_frequency: number
  turnover_rate: number
  suggested_par_level: number
  par_delta: number
  reason: string
}

export interface PartnerFastMovingGroup {
  partner_id: string
  partner_name: string
  partner_type: string
  total_weekly_units: number
  total_daily_velocity: number
  avg_turnover_rate: number
  total_critical_frequency: number
  top_product: FastMovingProductItem
  products: FastMovingProductItem[]
}

export function PartnerFastMovingModal({
  group,
  open,
  onOpenChange,
}: {
  group: PartnerFastMovingGroup | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!group) return null

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-xs animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl sm:max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl focus:outline-none animate-in fade-in zoom-in-95 duration-200">
          {/* Header Dialog */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white/95 px-6 py-4.5 backdrop-blur-md">
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20">
                <Flame className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Dialog.Title className="truncate font-display text-lg font-bold text-ink-900 sm:text-xl">
                    {group.partner_name}
                  </Dialog.Title>
                  <span className="rounded-full bg-ink-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-muted ring-1 ring-line">
                    {group.partner_type}
                  </span>
                </div>
                <Dialog.Description className="mt-0.5 text-xs text-muted">
                  Rincian seluruh produk dengan performa penjualan tertinggi di cabang ini (7 hari terakhir).
                </Dialog.Description>
              </div>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-ink-700"
                aria-label="Tutup dialog rincian produk"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-6 p-6">
            {/* KPI Cards Ringkasan Mitra */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="dashboard-surface rounded-xl border border-line bg-ink-50/40 p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <TrendingUp className="size-3.5 text-ink-700" />
                  Total Laku (7 Hari)
                </p>
                <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-ink-900">
                  {group.total_weekly_units.toLocaleString('id-ID')}{' '}
                  <span className="text-sm font-normal text-muted">pcs</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  ~{group.total_daily_velocity} pcs per hari
                </p>
              </div>

              <div className="dashboard-surface rounded-xl border border-line bg-ink-50/40 p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <Flame className="size-3.5 text-amber-500" />
                  Rata-rata Turnover
                </p>
                <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-amber-600">
                  {group.avg_turnover_rate}%
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {group.total_critical_frequency}x total fase kritis
                </p>
              </div>

              <div className="dashboard-surface rounded-xl border border-line bg-ink-50/40 p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <Building2 className="size-3.5 text-ink-700" />
                  Produk Paling Dominan
                </p>
                <p className="mt-1.5 truncate font-display text-base font-bold text-ink-900" title={group.top_product.product_name}>
                  {group.top_product.product_name}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {group.top_product.weekly_consumption} pcs (
                  {Math.round((group.top_product.weekly_consumption / group.total_weekly_units) * 100)}% dari total)
                </p>
              </div>
            </div>

            {/* Tabel Produk Paling Laku di Mitra Ini */}
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="border-b border-line bg-ink-50/80 px-4 py-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                    Daftar Produk Diurutkan Berdasarkan Penjualan Tertinggi
                  </h4>
                  <span className="text-xs font-medium text-muted">
                    {group.products.length} dari 4 produk resmi
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="border-b border-line bg-ink-50/40 text-xs font-semibold text-muted">
                    <tr>
                      <th className="px-4 py-3">Peringkat & Nama Produk</th>
                      <th className="px-4 py-3 text-right">Terjual (7 Hari)</th>
                      <th className="px-4 py-3 text-right">Saran Pasokan AI</th>
                      <th className="px-4 py-3 text-center">Turnover</th>
                      <th className="px-4 py-3">Rekomendasi Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {group.products.map((item, index) => (
                      <tr key={item.product_id} className="transition-colors hover:bg-ink-50/30">
                        {/* 1. Rank & Nama Produk */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-bold text-ink-700">
                              #{index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-ink-900">{item.product_name}</p>
                              <p className="text-[11px] text-muted">Sisa saat ini: {item.current_qty} pcs</p>
                            </div>
                          </div>
                        </td>

                        {/* 2. Laku 7 Hari */}
                        <td className="num px-4 py-3.5 text-right tabular-nums">
                          <p className="font-bold text-ink-900">{item.weekly_consumption} pcs</p>
                          <p className="text-xs text-muted">~{item.daily_velocity} pcs/hari</p>
                        </td>

                        {/* 3. Saran Pasokan AI (Suggested Par Level) */}
                        <td className="num px-4 py-3.5 text-right tabular-nums">
                          <span className="inline-flex items-center gap-1 rounded-md bg-ok-bg px-2.5 py-1 text-xs font-bold text-ok-fg">
                            <ArrowUpRight className="size-3" aria-hidden="true" />
                            {item.suggested_par_level} pcs
                          </span>
                          {item.par_delta > 0 && (
                            <p className="mt-0.5 text-[11px] font-semibold text-ok-fg">
                              +{item.par_delta} pcs
                            </p>
                          )}
                        </td>

                        {/* 5. Turnover Rate */}
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            <Flame className="size-3 text-amber-600" aria-hidden="true" />
                            {item.turnover_rate}%
                          </span>
                          <p className="mt-0.5 text-[11px] text-muted">
                            {item.critical_frequency}x kritis
                          </p>
                        </td>

                        {/* 6. Rekomendasi Aksi */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-ok-fg">
                              Prioritas Pasokan Restok
                            </span>
                            <span className="text-[11px] text-muted">
                              {item.reason || `Konsumsi ${item.weekly_consumption} pcs/minggu`}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Note Kebijakan Bisnis Daisuki */}
            <div className="rounded-xl border border-line bg-paper/60 p-4 text-xs leading-relaxed text-muted">
              <p className="font-semibold text-ink-900">Catatan Kebijakan Buffer Daisuki:</p>
              <p className="mt-0.5">
                Stok cabang tidak memiliki plafon maksimal. Nilai stok minimal (buffer) di atas dihitung oleh model AI berdasarkan laju konsumsi riil agar cabang mitra tidak mengalami kekosongan mendadak selama lead time pengiriman pabrik 5–7 hari.
              </p>
            </div>
          </div>

          {/* Footer Modal */}
          <div className="sticky bottom-0 flex items-center justify-between border-t border-line bg-paper/90 px-6 py-3.5 backdrop-blur-sm">
            <span className="text-xs text-muted">
              Data analitik teragregasi otomatis dari mutasi log stok fisik
            </span>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-ink-900 px-5 text-xs font-semibold text-white shadow-xs transition hover:bg-ink-700 focus-visible:outline-2 focus-visible:outline-ink-700"
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
