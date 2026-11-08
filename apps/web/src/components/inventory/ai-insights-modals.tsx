import { useMemo } from 'react'
import { Dialog } from 'radix-ui'
import {
  Building2,
  History,
  MapPin,
  Package,
  X,
} from 'lucide-react'
import { ThreeDPieChart, type ThreeDPieSlice } from './three-d-pie-chart'

// ==========================================
// 1. MODAL 4 PRODUK PALING LAKU
// ==========================================

export interface ProductSalesItem {
  rank: number
  product_name: string
  category: string
  weekly_units: number
  share_pct: number
  daily_velocity?: number
  central_stock?: number
}

export function ProductSalesDetailModal({
  open,
  onOpenChange,
  products,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: ProductSalesItem[]
  totalUnits: number
}) {
  const pieSlices: ThreeDPieSlice[] = useMemo(() => {
    return products.map((item) => ({
      id: item.product_name,
      label: item.product_name,
      sublabel: item.category,
      value: item.weekly_units,
      badge: `${item.share_pct}%`,
    }))
  }, [products])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-xs animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] max-w-3xl sm:max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl focus:outline-none animate-in fade-in zoom-in-95 duration-200">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white/95 px-6 py-4.5 backdrop-blur-md">
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink-50 text-ink-700 ring-1 ring-line">
                <Package className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <Dialog.Title className="truncate font-display text-lg font-bold text-ink-900 sm:text-xl">
                  Analisis 4 Produk Paling Laku
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-muted">
                  Pangsa pasar dan perbandingan konsumsi 4 produk resmi Daisuki di seluruh mitra & wilayah.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-ink-700 cursor-pointer"
                aria-label="Tutup dialog"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-6 p-6">
            {/* Proporsi konsumsi produk */}
            <div className="rounded-xl border border-line bg-paper/30 p-4">
              <ThreeDPieChart
                slices={pieSlices}
                title="Pangsa Konsumsi 4 Produk Daisuki"
                subtitle="Visualisasi proporsi penjualan per produk di seluruh jaringan cabang (7 hari terakhir)"
                unitLabel="pcs terjual"
                legendTitle="Daftar Produk"
                donutOnly
              />
            </div>

            {/* Tabel Peringkat 4 Produk */}
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="border-b border-line bg-ink-50/80 px-4 py-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Rincian Penjualan 4 Produk Resmi
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-b border-line bg-ink-50/40 text-xs font-semibold text-muted">
                    <tr>
                      <th className="px-4 py-3">Peringkat & Produk</th>
                      <th className="px-4 py-3">Kategori</th>
                      <th className="px-4 py-3 text-right">Terjual (7 Hari)</th>
                      <th className="px-4 py-3 text-right">Porsi Pangsa</th>
                      {products.some((p) => p.central_stock !== undefined) ? (
                        <th className="px-4 py-3 text-right">Stok Gudang Pusat</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {products.map((item, idx) => (
                      <tr key={item.product_name} className="hover:bg-ink-50/30">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                idx === 0
                                  ? 'bg-amber-100 text-amber-800'
                                  : idx === 1
                                    ? 'bg-slate-200 text-slate-800'
                                    : 'bg-ink-100 text-ink-700'
                              }`}
                            >
                              #{idx + 1}
                            </span>
                            <span className="font-semibold text-ink-900">{item.product_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted">{item.category}</td>
                        <td className="num px-4 py-3.5 text-right font-bold tabular-nums text-ink-900">
                          {item.weekly_units.toLocaleString('id-ID')} pcs
                        </td>
                        <td className="num px-4 py-3.5 text-right tabular-nums">
                          <span className="rounded bg-ink-50 px-2 py-0.5 text-xs font-bold text-ink-700">
                            {item.share_pct}%
                          </span>
                        </td>
                        {item.central_stock !== undefined ? (
                          <td className="num px-4 py-3.5 text-right font-semibold tabular-nums text-ink-800">
                            {item.central_stock.toLocaleString('id-ID')} pcs
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="min-h-10 rounded-md border border-line bg-white px-5 text-xs font-semibold text-ink-900 hover:bg-ink-50 cursor-pointer shadow-2xs"
                >
                  Tutup
                </button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ==========================================
// 2. MODAL MITRA PALING LAKU
// ==========================================

export interface TopPartnerItem {
  partner_id: string
  partner_name: string
  region?: string
  partner_type?: string
  weekly_consumption: number
  daily_velocity?: number
  turnover_rate?: number
  top_product?: string
  percentage?: number
}

export function TopPartnersDetailModal({
  open,
  onOpenChange,
  partners,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  partners: TopPartnerItem[]
}) {
  const pieSlices: ThreeDPieSlice[] = useMemo(() => {
    return partners.slice(0, 8).map((p) => ({
      id: p.partner_id || p.partner_name,
      label: p.partner_name,
      sublabel: p.region || p.partner_type || 'Cabang Mitra',
      value: p.weekly_consumption,
      badge: p.percentage ? `${p.percentage}%` : undefined,
    }))
  }, [partners])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-xs animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] max-w-3xl sm:max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl focus:outline-none animate-in fade-in zoom-in-95 duration-200">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white/95 px-6 py-4.5 backdrop-blur-md">
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink-50 text-ink-700 ring-1 ring-line">
                <Building2 className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <Dialog.Title className="truncate font-display text-lg font-bold text-ink-900 sm:text-xl">
                  Analisis Mitra Paling Laku
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-muted">
                  Peringkat cabang mitra dengan konsumsi dan perputaran stok tertinggi di seluruh wilayah (7 hari).
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-ink-700 cursor-pointer"
                aria-label="Tutup dialog"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-6 p-6">
            <div className="rounded-xl border border-line bg-paper/30 p-4">
              <ThreeDPieChart
                slices={pieSlices}
                title="Porsi Kontribusi Konsumsi Antar Mitra"
                subtitle="Perbandingan pengeluaran stok per cabang mitra (8 mitra teratas)"
                unitLabel="pcs konsumsi"
                legendTitle="Cabang Mitra"
                donutOnly
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-line">
              <div className="border-b border-line bg-ink-50/80 px-4 py-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Daftar Peringkat Konsumsi Seluruh Mitra
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="border-b border-line bg-ink-50/40 text-xs font-semibold text-muted">
                    <tr>
                      <th className="px-4 py-3">Peringkat & Mitra</th>
                      <th className="px-4 py-3">Wilayah</th>
                      <th className="px-4 py-3 text-right">Konsumsi 7 Hari</th>
                      <th className="px-4 py-3 text-right">Laju Harian</th>
                      <th className="px-4 py-3">Produk Terlaris di Toko</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {partners.map((item, idx) => (
                      <tr key={`${item.partner_name}-${idx}`} className="hover:bg-ink-50/30">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                idx === 0
                                  ? 'bg-amber-100 text-amber-800'
                                  : idx === 1
                                    ? 'bg-slate-200 text-slate-800'
                                    : 'bg-ink-100 text-ink-700'
                              }`}
                            >
                              #{idx + 1}
                            </span>
                            <div>
                              <p className="font-semibold text-ink-900">{item.partner_name}</p>
                              {item.partner_type ? (
                                <p className="text-[11px] capitalize text-muted">{item.partner_type}</p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted">{item.region || 'Wilayah cabang'}</td>
                        <td className="num px-4 py-3.5 text-right font-bold tabular-nums text-ink-900">
                          {item.weekly_consumption.toLocaleString('id-ID')} pcs
                        </td>
                        <td className="num px-4 py-3.5 text-right text-xs tabular-nums text-muted">
                          ~{item.daily_velocity ?? Math.round(item.weekly_consumption / 7)} pcs/hari
                        </td>
                        <td className="px-4 py-3.5 text-xs font-medium text-ink-800">
                          {item.top_product || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="min-h-10 rounded-md border border-line bg-white px-5 text-xs font-semibold text-ink-900 hover:bg-ink-50 cursor-pointer shadow-2xs"
                >
                  Tutup
                </button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ==========================================
// 3. MODAL WILAYAH PALING LAKU
// ==========================================

export interface RegionRestockItem {
  region: string
  province?: string
  restock_units: number
  partner_count: number
  percentage?: number
  metric_label?: string
  unit_label?: string
}

export function TopRegionsDetailModal({
  open,
  onOpenChange,
  regions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  regions: RegionRestockItem[]
}) {
  const pieSlices: ThreeDPieSlice[] = useMemo(() => {
    return regions.map((r) => ({
      id: r.region,
      label: r.region,
      sublabel: `${r.partner_count} mitra cabang`,
      value: r.restock_units,
      badge: r.percentage ? `${r.percentage}%` : undefined,
    }))
  }, [regions])
  const metricLabel = regions[0]?.metric_label ?? 'Aktivitas wilayah'
  const unitLabel = regions[0]?.unit_label ?? 'kejadian'

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-xs animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] max-w-3xl sm:max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl focus:outline-none animate-in fade-in zoom-in-95 duration-200">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white/95 px-6 py-4.5 backdrop-blur-md">
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink-50 text-ink-700 ring-1 ring-line">
                <MapPin className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <Dialog.Title className="truncate font-display text-lg font-bold text-ink-900 sm:text-xl">
                  Aktivitas wilayah
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-muted">
                  Perbandingan {metricLabel.toLowerCase()} berdasarkan data wilayah yang tersedia.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-ink-700 cursor-pointer"
                aria-label="Tutup dialog"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-6 p-6">
            <div className="rounded-xl border border-line bg-paper/30 p-4">
              <ThreeDPieChart
                slices={pieSlices}
                title={metricLabel + ' per wilayah'}
                subtitle="Proporsi tiap kabupaten atau kota"
                unitLabel={unitLabel}
                legendTitle="Daerah / Wilayah"
                donutOnly
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-line">
              <div className="border-b border-line bg-ink-50/80 px-4 py-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Peringkat wilayah berdasarkan {metricLabel.toLowerCase()}
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="border-b border-line bg-ink-50/40 text-xs font-semibold text-muted">
                    <tr>
                      <th className="px-4 py-3">Peringkat & Wilayah</th>
                      <th className="px-4 py-3 text-center">Jumlah Mitra</th>
                      <th className="px-4 py-3 text-right">{metricLabel}</th>
                      <th className="px-4 py-3 text-right">Rata-rata per Cabang</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {regions.map((item, idx) => (
                      <tr key={item.region} className="hover:bg-ink-50/30">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                idx === 0
                                  ? 'bg-amber-100 text-amber-800'
                                  : idx === 1
                                    ? 'bg-slate-200 text-slate-800'
                                    : 'bg-ink-100 text-ink-700'
                              }`}
                            >
                              #{idx + 1}
                            </span>
                            <span className="font-semibold text-ink-900">{item.region}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center text-xs font-medium text-muted">
                          {item.partner_count} cabang
                        </td>
                        <td className="num px-4 py-3.5 text-right font-bold tabular-nums text-ink-900">
                          {item.restock_units.toLocaleString('id-ID')} {unitLabel}
                        </td>
                        <td className="num px-4 py-3.5 text-right text-xs tabular-nums text-muted">
                          ~{Math.round(item.restock_units / Math.max(1, item.partner_count))} {unitLabel}/cabang
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="min-h-10 rounded-md border border-line bg-white px-5 text-xs font-semibold text-ink-900 hover:bg-ink-50 cursor-pointer shadow-2xs"
                >
                  Tutup
                </button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ==========================================
// 4. MODAL MITRA PALING AKTIF UPDATE STOK
// ==========================================

export interface PartnerActivityItem {
  partner_id: string
  partner_name: string
  total_logs: number
  active_days: number
  last_report_day?: string
  compliance_status: 'Sangat Disiplin' | 'Cukup Aktif' | 'Perlu Perhatian'
}

export function ActiveReportingPartnersModal({
  open,
  onOpenChange,
  partners,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  partners: PartnerActivityItem[]
}) {
  const pieSlices: ThreeDPieSlice[] = useMemo(() => {
    return partners.slice(0, 8).map((p) => ({
      id: p.partner_id || p.partner_name,
      label: p.partner_name,
      sublabel: `${p.active_days}/7 hari aktif`,
      value: p.total_logs,
      badge: `${p.total_logs} log`,
    }))
  }, [partners])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-xs animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] max-w-3xl sm:max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl focus:outline-none animate-in fade-in zoom-in-95 duration-200">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white/95 px-6 py-4.5 backdrop-blur-md">
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink-50 text-ink-700 ring-1 ring-line">
                <History className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <Dialog.Title className="truncate font-display text-lg font-bold text-ink-900 sm:text-xl">
                  Analisis Mitra Paling Aktif Update Stok
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-muted">
                  Peringkat kepatuhan dan keaktifan mitra menginput laporan stok fisik harian dari data log sistem (7 hari terakhir).
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-ink-700 cursor-pointer"
                aria-label="Tutup dialog"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-6 p-6">
            <div className="rounded-xl border border-line bg-paper/30 p-4">
              <ThreeDPieChart
                slices={pieSlices}
                title="Proporsi Keaktifan Update Stok Antar Cabang"
                subtitle="Visualisasi frekuensi entri laporan stok fisik harian per cabang mitra"
                unitLabel="kali update"
                legendTitle="Mitra Teraktif"
                donutOnly
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-line">
              <div className="border-b border-line bg-ink-50/80 px-4 py-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Peringkat Kepatuhan Laporan Stok Fisik Mitra
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[580px] text-left text-sm">
                  <thead className="border-b border-line bg-ink-50/40 text-xs font-semibold text-muted">
                    <tr>
                      <th className="px-4 py-3">Peringkat & Cabang Mitra</th>
                      <th className="px-4 py-3 text-right">Total Log Update</th>
                      <th className="px-4 py-3 text-center">Hari Aktif (7 Hari)</th>
                      <th className="px-4 py-3 text-center">Status Disiplin SOP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {partners.map((item, idx) => (
                      <tr key={item.partner_id || item.partner_name} className="hover:bg-ink-50/30">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                idx === 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : idx === 1
                                    ? 'bg-slate-200 text-slate-800'
                                    : 'bg-ink-100 text-ink-700'
                              }`}
                            >
                              #{idx + 1}
                            </span>
                            <span className="font-semibold text-ink-900">{item.partner_name}</span>
                          </div>
                        </td>
                        <td className="num px-4 py-3.5 text-right font-bold tabular-nums text-ink-900">
                          {item.total_logs} log
                        </td>
                        <td className="px-4 py-3.5 text-center text-xs font-medium text-muted">
                          {item.active_days} dari 7 hari
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              item.compliance_status === 'Sangat Disiplin'
                                ? 'bg-ok-bg text-ok-fg ring-1 ring-ok/20'
                                : item.compliance_status === 'Cukup Aktif'
                                  ? 'bg-warn-bg text-warn-fg ring-1 ring-warn/20'
                                  : 'bg-crit-bg text-crit-fg ring-1 ring-crit/20'
                            }`}
                          >
                            {item.compliance_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="min-h-10 rounded-md border border-line bg-white px-5 text-xs font-semibold text-ink-900 hover:bg-ink-50 cursor-pointer shadow-2xs"
                >
                  Tutup
                </button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
