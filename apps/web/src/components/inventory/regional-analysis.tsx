import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Flame,
  PieChart,
  Sparkles,
} from 'lucide-react'
import { ThreeDPieChart, type ThreeDPieSlice } from './three-d-pie-chart'

type Zone = 'ZONA_MERAH' | 'ZONA_KUNING' | 'ZONA_HIJAU' | 'BELUM_DIANALISIS' | 'PERLU_LOKASI'

export interface RegionalPartner {
  partner_id: string
  partner_name: string
  critical_logs: number
  stockout_logs: number
  restock_requests: number
  zone: Zone
  suggested_products: Array<{ product_name: string; suggested_par_level: number }>
}

export interface RegionalActivity {
  period_days: number
  model_generated_at: string | null
  regions: Array<{
    province_name: string
    regency_name: string
    regional_zone: Zone
    recommended_action: string | null
    critical_logs: number
    stockout_logs: number
    restock_requests: number
    partners: RegionalPartner[]
  }>
}

export interface RegionalAnalysisProps {
  activity?: RegionalActivity
  fastMovingProducts?: Array<{
    partner_id: string
    partner_name: string
    product_name: string
    current_qty: number
    par_level: number
    suggested_par_level: number
    par_delta: number
    turnover_rate?: number
    critical_frequency?: number
  }>
  deficitAnalysis?: Array<{
    partner_id: string
    partner_name: string
    product_name: string
    current_qty: number
    par_level: number
    days_of_cover: number
    root_cause_label: string
    risk_level: string
    action_recommendation: string
  }>
}

const zoneLabel: Record<Zone, string> = {
  ZONA_MERAH: 'Zona Merah · Prioritas Tinggi',
  ZONA_KUNING: 'Zona Kuning · Perlu Dipantau',
  ZONA_HIJAU: 'Zona Hijau · Pasokan Stabil',
  BELUM_DIANALISIS: 'Belum Dinilai Model',
  PERLU_LOKASI: 'Lokasi Belum Lengkap',
}

const zoneStyle: Record<Zone, string> = {
  ZONA_MERAH: 'bg-crit-bg text-crit-fg border-crit-fg/20',
  ZONA_KUNING: 'bg-warn-bg text-warn-fg border-warn-fg/20',
  ZONA_HIJAU: 'bg-ok-bg text-ok-fg border-ok-fg/20',
  BELUM_DIANALISIS: 'bg-ink-100 text-ink-700 border-line',
  PERLU_LOKASI: 'bg-ink-100 text-ink-700 border-line',
}

const number = (value: number) => value.toLocaleString('id-ID')

export function RegionalAnalysis({
  activity,
  fastMovingProducts = [],
}: RegionalAnalysisProps) {
  const [zone, setZone] = useState<Zone | 'semua'>('semua')
  const [regionKey, setRegionKey] = useState('semua')
  const [partnerId, setPartnerId] = useState('semua')
  const [detailChartTab, setDetailChartTab] = useState<'3d_pie' | 'events' | 'par_capacity'>('3d_pie')
  const [pieMetric, setPieMetric] = useState<'critical' | 'stockout' | 'restock' | 'total'>('critical')

  const regions = activity?.regions ?? []
  const analyzedRegions = regions.filter(
    (region) =>
      region.regional_zone !== 'BELUM_DIANALISIS' &&
      region.regional_zone !== 'PERLU_LOKASI'
  )

  const filteredByZone = zone === 'semua' ? regions : regions.filter((region) => region.regional_zone === zone)

  const visibleRegions =
    regionKey === 'semua'
      ? filteredByZone
      : filteredByZone.filter(
          (region) => `${region.province_name}\u0000${region.regency_name}` === regionKey
        )

  // Region currently selected by user click
  const selectedRegion = visibleRegions.length === 1 ? visibleRegions[0] : null

  // Partners under consideration
  const partners = useMemo(() => {
    return visibleRegions.flatMap((region) =>
      region.partners.map((partner) => ({
        ...partner,
        region_name: region.regency_name,
        province_name: region.province_name,
      }))
    )
  }, [visibleRegions])

  const visiblePartners =
    partnerId === 'semua'
      ? partners.filter(
          (partner) =>
            partner.critical_logs > 0 ||
            partner.stockout_logs > 0 ||
            partner.restock_requests > 0 ||
            partner.zone === 'ZONA_MERAH'
        )
      : partners.filter((partner) => partner.partner_id === partnerId)

  // Overall metric totals for KPI cards
  const totalCritical = visibleRegions.reduce((sum, r) => sum + r.critical_logs, 0)
  const totalStockouts = visibleRegions.reduce((sum, r) => sum + r.stockout_logs, 0)
  const totalRequests = visibleRegions.reduce((sum, r) => sum + r.restock_requests, 0)

  // Max value in selected region among partners
  const maxPartnerEventValue = Math.max(
    1,
    ...partners.flatMap((p) => [p.critical_logs, p.stockout_logs, p.restock_requests])
  )

  // Fast moving products associated with the selected region's partners
  const regionFastMoving = useMemo(() => {
    if (!selectedRegion) return []
    const partnerIds = new Set(selectedRegion.partners.map((p) => p.partner_id))
    return fastMovingProducts.filter((item) => partnerIds.has(item.partner_id))
  }, [selectedRegion, fastMovingProducts])

  const maxParValue = Math.max(
    1,
    ...regionFastMoving.flatMap((item) => [item.par_level, item.suggested_par_level])
  )

  // Slices for Overview 3D Pie Chart (Semua Wilayah)
  const regionalPieSlices: ThreeDPieSlice[] = useMemo(() => {
    return visibleRegions.map((region) => {
      const key = `${region.province_name}\u0000${region.regency_name}`
      let val = 0
      if (pieMetric === 'critical') val = region.critical_logs
      else if (pieMetric === 'stockout') val = region.stockout_logs
      else if (pieMetric === 'restock') val = region.restock_requests
      else val = region.critical_logs + region.stockout_logs + region.restock_requests

      return {
        id: key,
        label: region.regency_name,
        sublabel: `${region.province_name} · ${region.partners.length} mitra`,
        value: val,
        badge: zoneLabel[region.regional_zone],
      }
    })
  }, [visibleRegions, pieMetric])

  // Slices for Selected Region's Partners 3D Pie Chart
  const partnerPieSlices: ThreeDPieSlice[] = useMemo(() => {
    if (!selectedRegion) return []
    return selectedRegion.partners.map((partner) => {
      let val = 0
      if (pieMetric === 'critical') val = partner.critical_logs
      else if (pieMetric === 'stockout') val = partner.stockout_logs
      else if (pieMetric === 'restock') val = partner.restock_requests
      else val = partner.critical_logs + partner.stockout_logs + partner.restock_requests

      return {
        id: partner.partner_id,
        label: partner.partner_name,
        sublabel: zoneLabel[partner.zone],
        value: val,
      }
    })
  }, [selectedRegion, pieMetric])

  const pieMetricLabel =
    pieMetric === 'critical'
      ? 'Log Stok Kritis'
      : pieMetric === 'stockout'
        ? 'Stok Habis (0 pcs)'
        : pieMetric === 'restock'
          ? 'Pengajuan Restok'
          : 'Total Kasus Stok'

  const pieUnit =
    pieMetric === 'critical'
      ? 'log kritis'
      : pieMetric === 'stockout'
        ? 'log habis'
        : pieMetric === 'restock'
          ? 'pengajuan'
          : 'kejadian'

  return (
    <section className="dashboard-surface overflow-hidden" aria-labelledby="regional-analysis-title">
      {/* Header Panel */}
      <div className="border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-ink-900" />
              <h2 id="regional-analysis-title" className="font-display text-lg font-semibold text-ink-900 sm:text-xl">
                Peta & Diagram 3D Analisis Stok Daerah
              </h2>
            </div>
          </div>
          {activity?.model_generated_at ? (
            <span className="rounded-full bg-ink-50 px-2.5 py-1 text-xs text-muted ring-1 ring-line">
              Diperbarui: {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(activity.model_generated_at))} · {analyzedRegions.length} wilayah
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-6 p-5">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Ringkasan wilayah terpilih">
          <div className="rounded-lg bg-ink-50/60 p-3">
            <p className="text-xs font-semibold text-muted">Wilayah Terpantau</p>
            <p className="num mt-1 font-display text-2xl font-bold tabular-nums text-ink-900">
              {number(visibleRegions.length)}
            </p>
          </div>
          <div className="rounded-lg bg-warn-bg/50 p-3">
            <p className="text-xs font-semibold text-warn-fg">Log Stok Kritis</p>
            <p className="num mt-1 font-display text-2xl font-bold tabular-nums text-warn-fg">
              {number(totalCritical)}
            </p>
          </div>
          <div className="rounded-lg bg-crit-bg/50 p-3">
            <p className="text-xs font-semibold text-crit-fg">Stok Habis (0 pcs)</p>
            <p className="num mt-1 font-display text-2xl font-bold tabular-nums text-crit-fg">
              {number(totalStockouts)}
            </p>
          </div>
          <div className="rounded-lg bg-ink-50/60 p-3">
            <p className="text-xs font-semibold text-muted">Pengajuan Restok</p>
            <p className="num mt-1 font-display text-2xl font-bold tabular-nums text-ink-900">
              {number(totalRequests)}
            </p>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs font-semibold text-ink-800">
            Kategori Wilayah
            <select
              className="min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm font-medium text-ink-900 focus-visible:outline-2 focus-visible:outline-ume"
              value={zone}
              onChange={(e) => {
                setZone(e.target.value as Zone | 'semua')
                setRegionKey('semua')
                setPartnerId('semua')
              }}
            >
              <option value="semua">Semua Kategori Zona</option>
              <option value="ZONA_MERAH">Prioritas Tinggi (Zona Merah)</option>
              <option value="ZONA_KUNING">Perlu Dipantau (Zona Kuning)</option>
              <option value="ZONA_HIJAU">Stabil (Zona Hijau)</option>
              <option value="BELUM_DIANALISIS">Belum Dinilai Model</option>
              <option value="PERLU_LOKASI">Lokasi Belum Lengkap</option>
            </select>
          </label>

          <label className="space-y-1 text-xs font-semibold text-ink-800">
            Pilih Daerah (Kabupaten / Kota)
            <select
              className="min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm font-medium text-ink-900 focus-visible:outline-2 focus-visible:outline-ume"
              value={regionKey}
              onChange={(e) => {
                setRegionKey(e.target.value)
                setPartnerId('semua')
              }}
            >
              <option value="semua">Semua Daerah</option>
              {filteredByZone.map((region) => (
                <option
                  key={`${region.province_name}\u0000${region.regency_name}`}
                  value={`${region.province_name}\u0000${region.regency_name}`}
                >
                  {region.regency_name}, {region.province_name} [{region.regional_zone.replace('_', ' ')}]
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs font-semibold text-ink-800">
            Filter Mitra Cabang
            <select
              className="min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm font-medium text-ink-900 focus-visible:outline-2 focus-visible:outline-ume"
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
            >
              <option value="semua">Semua Mitra di Pilihan Ini</option>
              {partners.map((partner) => (
                <option key={partner.partner_id} value={partner.partner_id}>
                  {partner.partner_name} · {partner.region_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* KONDISI 1: JIKA SATU DAERAH DIKLIK / DIPILIH (DETAIL VIEW)    */}
        {/* ------------------------------------------------------------- */}
        {selectedRegion ? (
          <div className="space-y-5 rounded-xl border-2 border-ume/20 bg-gradient-to-b from-ink-50/40 via-white to-white p-4 sm:p-6 shadow-xs">
            {/* Header Detail Daerah & Tombol Reset */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-block rounded-md border px-2.5 py-0.5 text-xs font-bold ${
                      zoneStyle[selectedRegion.regional_zone]
                    }`}
                  >
                    {zoneLabel[selectedRegion.regional_zone]}
                  </span>
                </div>
                <h3 className="font-display text-xl font-bold text-ink-900 sm:text-2xl">
                  {selectedRegion.regency_name}
                  <span className="text-sm font-normal text-muted ml-2">
                    ({selectedRegion.province_name})
                  </span>
                </h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  setRegionKey('semua')
                  setPartnerId('semua')
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-xs font-bold text-ink-800 shadow-2xs transition hover:bg-ink-100 hover:text-ink-900"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Lihat Semua Daerah (3D Pie)</span>
              </button>
            </div>

            {/* AI Recommendation Callout Box */}
            <div className="rounded-lg border border-line/80 bg-white p-4 shadow-2xs">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-ume/10 p-2 text-ume shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink-900">
                    Rekomendasi Taktis AI untuk {selectedRegion.regency_name}
                  </h4>
                  <p className="mt-1 text-sm text-ink-800 leading-relaxed font-medium">
                    {selectedRegion.recommended_action ||
                      'Pasokan stabil. Lanjutkan jadwal restok rutin dan pantau status rak mitra setiap pekan.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Sub-Tab Diagram Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailChartTab('3d_pie')}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                    detailChartTab === '3d_pie'
                      ? 'bg-ink-900 text-white shadow-xs'
                      : 'bg-ink-50 text-ink-700 hover:bg-ink-100'
                  }`}
                >
                  <PieChart className="h-3.5 w-3.5 text-blue-400" />
                  <span>1. Diagram 3D Pie Mitra</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      detailChartTab === '3d_pie' ? 'bg-white/20 text-white' : 'bg-ink-200 text-ink-800'
                    }`}
                  >
                    {selectedRegion.partners.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDetailChartTab('events')}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                    detailChartTab === 'events'
                      ? 'bg-ink-900 text-white shadow-xs'
                      : 'bg-ink-50 text-ink-700 hover:bg-ink-100'
                  }`}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>2. Diagram Batang Detail</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDetailChartTab('par_capacity')}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                    detailChartTab === 'par_capacity'
                      ? 'bg-ink-900 text-white shadow-xs'
                      : 'bg-ink-50 text-ink-700 hover:bg-ink-100'
                  }`}
                >
                  <Flame className="h-3.5 w-3.5 text-amber-500" />
                  <span>3. Saran Par Level Rak</span>
                  {regionFastMoving.length > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        detailChartTab === 'par_capacity'
                          ? 'bg-white/20 text-white'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {regionFastMoving.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Metric Selector for Pie */}
              {detailChartTab === '3d_pie' ? (
                <div className="flex flex-wrap items-center gap-1.5 bg-ink-100/70 p-1 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setPieMetric('critical')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      pieMetric === 'critical' ? 'bg-white text-ink-900 shadow-2xs' : 'text-muted hover:text-ink-900'
                    }`}
                  >
                    Stok Kritis
                  </button>
                  <button
                    type="button"
                    onClick={() => setPieMetric('stockout')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      pieMetric === 'stockout' ? 'bg-white text-ink-900 shadow-2xs' : 'text-muted hover:text-ink-900'
                    }`}
                  >
                    Stok Habis
                  </button>
                  <button
                    type="button"
                    onClick={() => setPieMetric('restock')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      pieMetric === 'restock' ? 'bg-white text-ink-900 shadow-2xs' : 'text-muted hover:text-ink-900'
                    }`}
                  >
                    Restok
                  </button>
                </div>
              ) : null}
            </div>

            {/* TAB DETAIL 1: DIAGRAM 3D PIE PER MITRA */}
            {detailChartTab === '3d_pie' && (
              <div className="rounded-xl border border-line bg-white p-4 sm:p-5">
                <ThreeDPieChart
                  slices={partnerPieSlices}
                  title={`Proporsi ${pieMetricLabel} per Mitra di ${selectedRegion.regency_name}`}
                  subtitle={`Membandingkan persentase kontribusi kasus tiap mitra cabang di ${selectedRegion.regency_name}.`}
                  unitLabel={pieUnit}
                  selectedId={partnerId !== 'semua' ? partnerId : undefined}
                  onSelectSlice={(id) => setPartnerId(id)}
                />
              </div>
            )}

            {/* TAB DETAIL 2: DIAGRAM BATANG DETAIL */}
            {detailChartTab === 'events' && (
              <div className="rounded-xl border border-line bg-white p-4 sm:p-5">
                <div className="border-b border-line pb-3">
                  <h4 className="font-semibold text-ink-900 text-sm sm:text-base">
                    Diagram Batang: Distribusi Riwayat Stok per Mitra Cabang
                  </h4>
                  <p className="mt-0.5 text-xs text-muted">
                    Membandingkan frekuensi stok kritis (&lt;20%), kehabisan stok total (0 pcs), dan permohonan restok di {selectedRegion.regency_name}.
                  </p>
                </div>

                {selectedRegion.partners.length > 0 ? (
                  <div className="mt-4 space-y-5">
                    {selectedRegion.partners.map((partner) => {
                      const critPct = Math.round((partner.critical_logs / maxPartnerEventValue) * 100)
                      const stockoutPct = Math.round((partner.stockout_logs / maxPartnerEventValue) * 100)
                      const restockPct = Math.round((partner.restock_requests / maxPartnerEventValue) * 100)

                      return (
                        <div
                          key={partner.partner_id}
                          className="rounded-lg border border-line/70 bg-ink-50/20 p-3 sm:p-4 transition hover:bg-ink-50/50"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-ink-700" />
                                <span className="font-semibold text-ink-900 text-sm">
                                  {partner.partner_name}
                                </span>
                              </div>
                            </div>
                            <span
                              className={`rounded-sm px-2 py-0.5 text-[11px] font-bold ${
                                zoneStyle[partner.zone]
                              }`}
                            >
                              {zoneLabel[partner.zone]}
                            </span>
                          </div>

                          {/* 3-Row Grouped Bars per Partner */}
                          <div className="mt-3 space-y-2">
                            <div className="grid grid-cols-[100px_1fr_60px] sm:grid-cols-[120px_1fr_80px] items-center gap-2 text-xs">
                              <span className="font-medium text-amber-700">Stok Kritis</span>
                              <div className="h-4 w-full rounded-sm bg-ink-100 overflow-hidden">
                                <div
                                  className="h-full rounded-sm bg-amber-500 transition-all duration-500"
                                  style={{ width: `${Math.max(critPct > 0 ? 3 : 0, critPct)}%` }}
                                />
                              </div>
                              <span className="num font-bold text-right text-amber-800 tabular-nums">
                                {partner.critical_logs} log
                              </span>
                            </div>

                            <div className="grid grid-cols-[100px_1fr_60px] sm:grid-cols-[120px_1fr_80px] items-center gap-2 text-xs">
                              <span className="font-medium text-rose-700">Stok Habis (0)</span>
                              <div className="h-4 w-full rounded-sm bg-ink-100 overflow-hidden">
                                <div
                                  className="h-full rounded-sm bg-rose-500 transition-all duration-500"
                                  style={{ width: `${Math.max(stockoutPct > 0 ? 3 : 0, stockoutPct)}%` }}
                                />
                              </div>
                              <span className="num font-bold text-right text-rose-800 tabular-nums">
                                {partner.stockout_logs} log
                              </span>
                            </div>

                            <div className="grid grid-cols-[100px_1fr_60px] sm:grid-cols-[120px_1fr_80px] items-center gap-2 text-xs">
                              <span className="font-medium text-indigo-700">Restok Diajukan</span>
                              <div className="h-4 w-full rounded-sm bg-ink-100 overflow-hidden">
                                <div
                                  className="h-full rounded-sm bg-indigo-600 transition-all duration-500"
                                  style={{ width: `${Math.max(restockPct > 0 ? 3 : 0, restockPct)}%` }}
                                />
                              </div>
                              <span className="num font-bold text-right text-indigo-800 tabular-nums">
                                {partner.restock_requests}x
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-muted">Belum ada data riwayat log di daerah ini.</p>
                )}
              </div>
            )}

            {/* TAB DETAIL 3: REKOMENDASI KAPASITAS RAK (PAR LEVEL) */}
            {detailChartTab === 'par_capacity' && (
              <div className="rounded-xl border border-line bg-white p-4 sm:p-5">
                <div className="border-b border-line pb-3">
                  <h4 className="font-semibold text-ink-900 text-sm sm:text-base">
                    Diagram Batang: Rekomendasi Kapasitas Rak (Par Level Saat Ini vs Saran AI)
                  </h4>
                  <p className="mt-0.5 text-xs text-muted">
                    Menunjukkan produk fast-moving di {selectedRegion.regency_name} yang memerlukan ekspansi kapasitas rak agar toko tidak kehilangan omzet.
                  </p>
                </div>

                {regionFastMoving.length > 0 ? (
                  <div className="mt-4 space-y-4">
                    {regionFastMoving.map((item) => {
                      const curParPct = Math.round((item.par_level / maxParValue) * 100)
                      const sugParPct = Math.round((item.suggested_par_level / maxParValue) * 100)
                      const growthRatio = Math.round((item.par_delta / Math.max(1, item.par_level)) * 100)

                      return (
                        <div
                          key={`${item.partner_id}-${item.product_name}`}
                          className="rounded-lg border border-line/70 bg-ink-50/20 p-3 sm:p-4 transition hover:bg-ink-50/50"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-semibold text-ink-900 text-sm">{item.product_name}</p>
                              <p className="text-xs text-muted">{item.partner_name}</p>
                            </div>
                            <span className="inline-flex items-center gap-1 rounded-md bg-ok-bg px-2.5 py-1 text-xs font-bold text-ok-fg">
                              <ArrowUpRight className="h-3.5 w-3.5" />
                              +{item.par_delta} pcs ({growthRatio}%)
                            </span>
                          </div>

                          {/* Side-by-Side Horizontal Comparison Bars */}
                          <div className="mt-3 space-y-2">
                            <div className="grid grid-cols-[110px_1fr_70px] sm:grid-cols-[130px_1fr_90px] items-center gap-2 text-xs">
                              <span className="font-medium text-muted">Par Saat Ini</span>
                              <div className="h-4 w-full rounded-sm bg-ink-100 overflow-hidden">
                                <div
                                  className="h-full rounded-sm bg-ink-400"
                                  style={{ width: `${curParPct}%` }}
                                />
                              </div>
                              <span className="num font-semibold text-right text-ink-800 tabular-nums">
                                {item.par_level} pcs
                              </span>
                            </div>

                            <div className="grid grid-cols-[110px_1fr_70px] sm:grid-cols-[130px_1fr_90px] items-center gap-2 text-xs">
                              <span className="font-bold text-ok-fg">Saran Par Baru</span>
                              <div className="h-4 w-full rounded-sm bg-ink-100 overflow-hidden">
                                <div
                                  className="h-full rounded-sm bg-emerald-600"
                                  style={{ width: `${sugParPct}%` }}
                                />
                              </div>
                              <span className="num font-bold text-right text-ok-fg tabular-nums">
                                {item.suggested_par_level} pcs
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg bg-ink-50/60 p-6 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-ok-fg opacity-80" />
                    <p className="mt-2 text-sm font-semibold text-ink-900">
                      Kapasitas Rak Mitra di {selectedRegion.regency_name} Saat Ini Optimal
                    </p>
                    <p className="mt-1 text-xs text-muted max-w-md mx-auto">
                      Belum ditemukan produk fast-moving yang mengalami defisit akibat keterbatasan kapasitas rak di daerah ini.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* ------------------------------------------------------------- */}
        {/* KONDISI 2: OVERVIEW SEMUA WILAYAH (DIAGRAM 3D PIE DAERAH)     */}
        {/* ------------------------------------------------------------- */}
        {regionKey === 'semua' ? (
          <div className="space-y-4">
            {/* Header & Metric Filter Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-3">
              <div>
                <h3 className="text-sm font-bold text-ink-900 sm:text-base flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-ume" />
                  Diagram 3D Distribusi Kasus per Daerah
                </h3>
              </div>

              {/* Metric Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 bg-ink-100/70 p-1 rounded-lg text-xs self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setPieMetric('critical')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition ${
                    pieMetric === 'critical' ? 'bg-white text-ink-900 shadow-2xs' : 'text-muted hover:text-ink-900'
                  }`}
                >
                   Log Kritis
                </button>
                <button
                  type="button"
                  onClick={() => setPieMetric('stockout')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition ${
                    pieMetric === 'stockout' ? 'bg-white text-ink-900 shadow-2xs' : 'text-muted hover:text-ink-900'
                  }`}
                >
                  Stok Habis
                </button>
                <button
                  type="button"
                  onClick={() => setPieMetric('restock')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition ${
                    pieMetric === 'restock' ? 'bg-white text-ink-900 shadow-2xs' : 'text-muted hover:text-ink-900'
                  }`}
                >
                  Restok
                </button>
                <button
                  type="button"
                  onClick={() => setPieMetric('total')}
                  className={`px-3 py-1.5 rounded-md font-semibold transition ${
                    pieMetric === 'total' ? 'bg-white text-ink-900 shadow-2xs' : 'text-muted hover:text-ink-900'
                  }`}
                >
                   Total
                </button>
              </div>
            </div>

            {/* 3D Pie Chart Render */}
            <ThreeDPieChart
              slices={regionalPieSlices}
              unitLabel={pieUnit}
              selectedId={undefined}
              onSelectSlice={(id) => {
                setRegionKey(id)
                setPartnerId('semua')
              }}
            />
          </div>
        ) : null}

        {/* Daftar Mitra Cabang yang Perlu Diperiksa */}
        <div className="pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">
                Mitra Cabang yang Perlu Perhatian
                {selectedRegion ? ` di ${selectedRegion.regency_name}` : ''}
              </h3>
              <p className="mt-0.5 text-xs text-muted">
                Cabang dengan log stok kritis, pengajuan restok, atau berstatus prioritas tinggi.
              </p>
            </div>
            <span className="text-xs text-muted font-medium">
              {visiblePartners.length} mitra terdaftar
            </span>
          </div>

          {visiblePartners.length > 0 ? (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {visiblePartners.map((partner) => (
                <li
                  key={partner.partner_id}
                  className="grid gap-2 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start hover:bg-ink-50/30 px-2 rounded-md"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">
                      {partner.partner_name}{' '}
                      <span className="font-normal text-muted">
                        · {partner.region_name}, {partner.province_name}
                      </span>
                    </p>
                    {partner.suggested_products.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-medium text-muted">
                          Rekomendasi Kapasitas AI:
                        </span>
                        {partner.suggested_products.map((product) => (
                          <span
                            key={product.product_name}
                            className="inline-flex items-center gap-1 rounded bg-ok-bg/50 px-2 py-0.5 text-[11px] font-medium text-ok-fg"
                          >
                            <span>{product.product_name}</span>
                            <span className="font-bold">→ {product.suggested_par_level} pcs</span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs sm:justify-end">
                    <span
                      className={`rounded-sm px-2 py-0.5 font-semibold ${zoneStyle[partner.zone]}`}
                    >
                      {zoneLabel[partner.zone]}
                    </span>
                    <span className="num rounded bg-ink-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-700">
                      {number(partner.critical_logs)} kritis
                    </span>
                    <span className="num rounded bg-ink-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-rose-700">
                      {number(partner.stockout_logs)} habis
                    </span>
                    <span className="num rounded bg-ink-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-indigo-700">
                      {number(partner.restock_requests)} restok
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-md bg-ink-50 px-4 py-5 text-sm text-ink-700">
              Belum ada mitra yang perlu diperiksa untuk pilihan ini.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
