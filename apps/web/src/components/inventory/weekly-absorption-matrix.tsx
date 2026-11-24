import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Calendar,
  MapPin,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  RotateCcw,
  TrendingUp,
  Package,
  ShieldAlert,
  X,
} from 'lucide-react'
import {
  getWeeklyAbsorptionMatrix,
  getOperationalInsight,
  type WeeklyAbsorptionMatrixResponse,
  type PartnerAbsorptionRanking,
} from '@/lib/api/analysis'
import { FALLBACK_WEEKLY_ABSORPTION_MATRIX } from '@/data/weekly-absorption-matrix-fallback'
import {
  FALLBACK_OPERATIONAL_INSIGHT,
  type OperationalInsightResponse,
} from '@/data/operational-insight-fallback'

type TierFilter = 'all' | 'top_performer' | 'steady' | 'slow_moving' | 'critical'

function getClusterBadge(clusterCode: string) {
  switch (clusterCode) {
    case 'TIPE_A':
      return {
        label: 'Ramai Akhir Pekan',
        className: 'bg-amber-100 text-amber-900 border-amber-300',
      }
    case 'TIPE_B':
      return {
        label: 'Stabil Harian',
        className: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      }
    case 'TIPE_C':
      return {
        label: 'Tengah Minggu',
        className: 'bg-sky-100 text-sky-900 border-sky-300',
      }
    default:
      return {
        label: 'Belum Ada Penjualan',
        className: 'bg-slate-100 text-slate-700 border-slate-300',
      }
  }
}

export function WeeklyAbsorptionMatrix({ view = 'overview' }: { view?: 'overview' | 'comparison' | 'branches' }) {
  const [usingFallback, setUsingFallback] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(() => {
    return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
  })

  // 1. Query Matriks Penyerapan
  const { data, isLoading, isError, refetch, isFetching } = useQuery<WeeklyAbsorptionMatrixResponse>({
    queryKey: ['weekly-absorption-matrix'],
    queryFn: async () => {
      try {
        const res = await getWeeklyAbsorptionMatrix()
        setUsingFallback(false)
        setLastRefreshedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB')
        return res
      } catch (err) {
        console.warn('API matrix unavailable, using offline fallback dataset:', err)
        setUsingFallback(true)
        return FALLBACK_WEEKLY_ABSORPTION_MATRIX as unknown as WeeklyAbsorptionMatrixResponse
      }
    },
    staleTime: 60_000,
  })

  // 2. Query AI Operational Insight
  const { data: insightData, refetch: refetchInsight } = useQuery<OperationalInsightResponse>({
    queryKey: ['operational-insight'],
    queryFn: async () => {
      try {
        return await getOperationalInsight()
      } catch (err) {
        console.warn('API insight unavailable, using offline fallback dataset:', err)
        return FALLBACK_OPERATIONAL_INSIGHT
      }
    },
    staleTime: 60_000,
  })

  // Pastikan data selalu ada dengan fallback
  const matrix: WeeklyAbsorptionMatrixResponse = data ?? (FALLBACK_WEEKLY_ABSORPTION_MATRIX as unknown as WeeklyAbsorptionMatrixResponse)
  const insights: OperationalInsightResponse = insightData ?? FALLBACK_OPERATIONAL_INSIGHT

  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => matrix.metadata.current_period_id || '2026-W46')
  const [selectedCity, setSelectedCity] = useState<string>('Semua Lokasi')
  const [selectedTier, setSelectedTier] = useState<TierFilter>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null)

  // Ambil list rankings untuk periode terpilih
  const currentPeriodData = matrix.period_data[selectedPeriod] ?? matrix.period_data[matrix.metadata.current_period_id] ?? Object.values(matrix.period_data)[0]
  const rawRankings: PartnerAbsorptionRanking[] = currentPeriodData?.rankings ?? []

  // Hitung sisa hari stok aman untuk cabang-cabang mendesak (< 7 hari)
  const breachedPartners = useMemo(() => {
    return rawRankings.filter((p) =>
      (selectedCity === 'Semua Lokasi' || p.city === selectedCity) &&
      (p.has_lead_time_breach || p.dominant_risk_level === 'Kritis'))
  }, [rawRankings, selectedCity])

  const minCriticalDays = useMemo(() => {
    if (!breachedPartners.length) return 7.0
    return Math.min(...breachedPartners.map((p) => p.min_days_to_stockout))
  }, [breachedPartners])

  const criticalAvgDays = useMemo(() => {
    if (!breachedPartners.length) return '7.0'
    const sum = breachedPartners.reduce((acc, p) => acc + p.min_days_to_stockout, 0)
    return (sum / breachedPartners.length).toFixed(1)
  }, [breachedPartners])

  // Filter rankings berdasarkan Kota, Tier, dan Keyword pencarian
  const filteredRankings = useMemo(() => {
    return rawRankings.filter((item) => {
      // Filter Kota
      if (selectedCity !== 'Semua Lokasi' && item.city !== selectedCity) {
        return false
      }
      // Filter Tier
      if (selectedTier === 'top_performer' && item.performance_tier !== 'top_performer') {
        return false
      }
      if (selectedTier === 'steady' && item.performance_tier !== 'steady') {
        return false
      }
      if (selectedTier === 'slow_moving' && item.performance_tier !== 'slow_moving') {
        return false
      }
      if (selectedTier === 'critical' && item.dominant_risk_level !== 'Kritis' && !item.has_lead_time_breach) {
        return false
      }
      // Filter Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchName = item.partner_name.toLowerCase().includes(query)
        const matchCity = item.city.toLowerCase().includes(query)
        const matchCluster = item.segment_name.toLowerCase().includes(query)
        if (!matchName && !matchCity && !matchCluster) {
          return false
        }
      }
      return true
    })
  }, [rawRankings, selectedCity, selectedTier, searchQuery])

  // Cek apakah ada filter aktif
  const hasActiveFilter = selectedCity !== 'Semua Lokasi' || selectedTier !== 'all' || searchQuery.trim() !== ''

  const resetFilters = () => {
    setSelectedCity('Semua Lokasi')
    setSelectedTier('all')
    setSearchQuery('')
  }

  // Data untuk visualisasi bar perbandingan kecepatan penyerapan (ambil 8 cabang teratas dalam filter)
  const chartPartners = useMemo(() => {
    return filteredRankings.slice(0, 8)
  }, [filteredRankings])

  const maxAbsorptionRate = useMemo(() => {
    const vals = chartPartners.map((p) => p.avg_absorption_rate)
    return Math.max(1.0, ...vals)
  }, [chartPartners])

  const toggleExpand = (partnerId: string) => {
    setExpandedPartnerId((prev) => (prev === partnerId ? null : partnerId))
  }

  const handleManualRefresh = async () => {
    await Promise.all([refetch(), refetchInsight()])
    setLastRefreshedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB')
  }

  // Dapatkan ringkasan AI Operational Insight dinamis sesuai filter Periode & Lokasi
  const currentInsightView = useMemo(() => {
    const periodData = insights.period_insights[selectedPeriod] ?? insights.network_overview
    const currentPeriodObj = matrix.available_periods.find((p) => p.id === selectedPeriod)
    const periodLabel = currentPeriodObj?.label ?? selectedPeriod

    if (selectedCity !== 'Semua Lokasi') {
      const cityData = periodData.city_insights?.[selectedCity] ?? insights.city_insights?.[selectedCity]
      if (cityData) {
        return {
          scopeTitle: `Wilayah ${selectedCity}`,
          headline: cityData.headline,
          summary: cityData.summary,
          status: cityData.status,
          recommendedAction: cityData.recommended_action,
          priorityActions: [],
          periodLabel,
        }
      }

      // Jika kota tidak ada dalam kamus kota (fallback dinamis)
      const cityActiveCount = filteredRankings.filter((p) => p.is_active_partner).length
      const cityCritCount = filteredRankings.filter((p) => p.has_lead_time_breach || p.dominant_risk_level === 'Kritis').length
      const totalPcs = filteredRankings.reduce((sum, p) => sum + p.total_weekly_consumption, 0)
      return {
        scopeTitle: `Wilayah ${selectedCity}`,
        headline: cityCritCount > 0 ? `Perhatian Kritis di ${selectedCity}: Butuh Pasokan Segera` : `Aktivitas Distribusi di ${selectedCity}`,
        summary: `Wilayah ${selectedCity} memiliki ${filteredRankings.length} cabang (${cityActiveCount} aktif melapor) dengan total penjualan ${totalPcs.toLocaleString('id-ID')} pcs. ${cityCritCount > 0 ? `${cityCritCount} cabang butuh restock sebelum batas lead time 5–7 hari.` : 'Pasokan berjalan stabil.'}`,
        status: cityCritCount > 0 ? ('Kritis' as const) : ('Aman' as const),
        recommendedAction: cityCritCount > 0 ? `Segera alokasikan pengiriman armada ke cabang di ${selectedCity}.` : `Pantau jadwal pengiriman rutin armada di ${selectedCity}.`,
        priorityActions: [],
        periodLabel,
      }
    }

    // Default: Seluruh Jaringan
    return {
      scopeTitle: 'Seluruh Jaringan Mitra',
      headline: periodData.headline,
      summary: periodData.executive_summary,
      status: (periodData.total_critical_branches > 0 ? 'Kritis' : 'Aman') as 'Kritis' | 'Aman',
      recommendedAction: null,
      priorityActions: periodData.priority_actions ?? [],
      periodLabel,
    }
  }, [insights, selectedPeriod, selectedCity, matrix.available_periods, filteredRankings])

  return (
    <section className="dashboard-surface min-w-0 space-y-5 p-4 sm:p-6" aria-labelledby="absorption-matrix-heading">
      {/* Header & Status Operasional */}
      <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="absorption-matrix-heading" className="mt-1 font-display text-xl font-bold text-ink-900 sm:text-2xl">
            Penjualan & pasokan mitra
          </h2>
          <p className="mt-1 text-sm text-muted">{usingFallback || isError ? 'Data cadangan' : 'Data terbaru'} · {currentInsightView.periodLabel}</p>
        </div>

        {/* Tombol Segarkan & Waktu Pembaruan Terakhir */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <span className="hidden text-xs text-muted sm:inline tabular-nums">{lastRefreshedAt}</span>
          <button
            type="button"
            onClick={() => void handleManualRefresh()}
            disabled={isLoading || isFetching}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-surface shadow-xs px-3.5 text-xs font-bold text-ink-900 shadow-xs hover:bg-ink-50 disabled:opacity-50"
            title="Muat ulang data kecepatan jual dan stok terbaru"
          >
            <RotateCcw className={`size-3.5 ${isFetching ? 'animate-spin text-ink-900' : 'text-muted'}`} aria-hidden="true" />
            <span>{isFetching ? 'Memuat...' : 'Segarkan'}</span>
          </button>
        </div>
      </div>

      {view === 'overview' && <details className="group rounded-lg border border-line bg-ink-50/60 px-4 py-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink-900 focus-visible:outline-2 focus-visible:outline-ink-900 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0"><span className="text-crit-fg tabular-nums">{breachedPartners.length} cabang</span> perlu perhatian · {currentInsightView.scopeTitle}</span>
          <span className="shrink-0 text-xs text-ink-700 group-open:hidden">Lihat analisis</span>
          <span className="hidden shrink-0 text-xs text-ink-700 group-open:inline">Tutup</span>
        </summary>
        <div className="border-t border-line pt-3 text-sm text-ink-800">
          <p className="font-semibold text-ink-900">{currentInsightView.headline}</p>
          <p className="mt-2 leading-relaxed">{currentInsightView.summary}</p>
          {currentInsightView.recommendedAction && <p className="mt-2 font-medium">{currentInsightView.recommendedAction}</p>}
          {currentInsightView.priorityActions.length > 0 && (
            <ul className="mt-3 space-y-2 border-t border-line pt-3">
              {currentInsightView.priorityActions.map((action, index) => (
                <li key={index}><strong>{action.target}:</strong> {action.action}</li>
              ))}
            </ul>
          )}
        </div>
      </details>}

      {/* 4 KARTU KPI UTAMA (Hierarki Angka Utama & Keterbacaan Tinggi untuk PIC Senior) */}
      {view === 'overview' && <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* KPI 1: Kecepatan Jual Jaringan */}
        <div className="rounded-xl border-2 border-line bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-700">Laju Penjualan</span>
            <TrendingUp className="size-5 text-emerald-600" aria-hidden="true" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="font-display text-3xl font-black tabular-nums text-ink-900 sm:text-4xl">
              {(matrix.summary.network_avg_absorption_rate * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* KPI 2: Wajib Kirim Segera (< 7 Hari) */}
        <div className="rounded-xl border-2 border-crit-fg/30 bg-crit-bg/15 p-4 shadow-xs">
          <div className="flex items-center justify-between text-crit-fg">
            <span className="text-xs font-bold uppercase tracking-wider text-crit-fg">Wajib Kirim Segera</span>
            <AlertTriangle className="size-5 text-crit-fg" aria-hidden="true" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="font-display text-3xl font-black tabular-nums text-crit-fg sm:text-4xl">
              {matrix.summary.lead_time_breached_count}
            </span>
            <span className="text-xs font-bold text-crit-fg">cabang</span>
          </div>
        </div>

        {/* KPI 3: Stok Menumpuk */}
        <div className="rounded-xl border-2 border-warn-fg/30 bg-warn-bg/15 p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Stok Menumpuk</span>
            <Package className="size-5 text-amber-600" aria-hidden="true" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="font-display text-3xl font-black tabular-nums text-amber-700 sm:text-4xl">
              {matrix.summary.slow_moving_count}
            </span>
            <span className="text-xs font-bold text-amber-700">cabang</span>
          </div>
        </div>

        {/* KPI 4: Sisa Hari Stok Aman */}
        <div className="rounded-xl border-2 border-rose-300 bg-rose-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-800">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800">Ketahanan stok kritis</span>
            <ShieldAlert className="size-5 text-rose-600" aria-hidden="true" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="font-display text-3xl font-black tabular-nums text-rose-700 sm:text-4xl">
              {criticalAvgDays}
            </span>
            <span className="text-xs font-bold text-rose-700">Hari</span>
          </div>
          <p className="mt-1 text-xs text-rose-800">Terendah {minCriticalDays.toFixed(1)} hari</p>
        </div>
      </div>}

      {/* KONTROL FILTER & RESET FILTER CEPAT */}
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-paper/60 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Periode Minggu */}
            <div className="flex items-center gap-2">
              <label htmlFor="period-select" className="text-xs font-bold text-ink-900 whitespace-nowrap flex items-center gap-1.5">
                <Calendar className="size-3.5 text-muted" aria-hidden="true" />
                Periode:
              </label>
              <select
                id="period-select"
                aria-label="Pilih Periode Minggu"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="min-h-11 rounded-lg border border-line bg-surface shadow-xs px-3 py-2 text-xs font-semibold text-ink-900 shadow-xs focus-visible:outline-2 focus-visible:outline-ink-900"
              >
                {matrix.available_periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.date_range})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Lokasi / Kota */}
            <div className="flex items-center gap-2">
              <label htmlFor="city-select" className="text-xs font-bold text-ink-900 whitespace-nowrap flex items-center gap-1.5">
                <MapPin className="size-3.5 text-muted" aria-hidden="true" />
                Lokasi:
              </label>
              <select
                id="city-select"
                aria-label="Pilih Lokasi Cabang"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="min-h-11 rounded-lg border border-line bg-surface shadow-xs px-3 py-2 text-xs font-semibold text-ink-900 shadow-xs focus-visible:outline-2 focus-visible:outline-ink-900"
              >
                {matrix.available_cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pencarian Nama Toko & Tombol Reset Filter Cepat */}
          <div className="flex flex-1 sm:flex-initial items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama toko mitra..."
                aria-label="Cari nama cabang mitra"
                className="min-h-11 w-full rounded-lg border border-line bg-surface shadow-xs pl-9 pr-3 text-xs text-ink-900 placeholder:text-muted shadow-xs focus-visible:outline-2 focus-visible:outline-ink-900"
              />
            </div>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-ink-300 bg-surface px-3 text-xs font-bold text-ink-900 hover:bg-ink-100 hover:border-ink-900 transition-colors shadow-xs"
                title="Kembalikan semua filter ke tampilan awal"
              >
                <X className="size-3.5" aria-hidden="true" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABS KATEGORI OPERASIONAL BISNIS */}
      {view !== 'overview' && <div className="flex flex-wrap gap-1.5 border-b border-line pb-3 text-xs">
        {[
          { key: 'all', label: `Semua (${rawRankings.length})` },
          { key: 'top_performer', label: `Laris (${matrix.summary.top_performer_count})` },
          { key: 'steady', label: `Stabil (${matrix.summary.steady_count})` },
          { key: 'slow_moving', label: `Menumpuk (${matrix.summary.slow_moving_count})` },
          { key: 'critical', label: `Kirim segera (${matrix.summary.lead_time_breached_count})` },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSelectedTier(tab.key as TierFilter)}
            className={`min-h-11 rounded-lg px-3.5 py-2 font-bold transition-all ${
              selectedTier === tab.key
                ? 'bg-ink-900 text-white shadow-sm'
                : 'bg-surface border border-line text-ink-700 hover:bg-ink-50 hover:text-ink-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>}

      {/* GRAFIK BAR PERBANDINGAN KECEPATAN JUAL ANTAR TOKO */}
      {view === 'comparison' && <div className="rounded-lg border border-line bg-surface shadow-xs p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-ink-900">Perbandingan penjualan · {chartPartners.length} cabang</h3>

        {chartPartners.length > 0 ? (
          <div className="mt-4 space-y-3.5">
            {chartPartners.map((partner) => {
              const widthPct = Math.min(100, (partner.avg_absorption_rate / maxAbsorptionRate) * 100)
              const isHigh = partner.performance_tier === 'top_performer'
              const isSlow = partner.performance_tier === 'slow_moving'

              return (
                <div key={partner.partner_id} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between text-xs gap-1">
                    <span className="flex items-center gap-2 font-semibold text-ink-900">
                      <span className="inline-flex size-5 items-center justify-center rounded bg-ink-100 font-mono text-[11px] font-bold">
                        #{partner.rank}
                      </span>
                      <strong className="truncate max-w-[180px] sm:max-w-[280px] text-ink-900">{partner.partner_name}</strong>
                      <span className="hidden text-muted sm:inline">{partner.city}</span>
                    </span>
                    <span className="flex items-center gap-2 font-mono text-xs tabular-nums">
                      <span className="font-bold text-ink-900">
                        {partner.avg_absorption_rate.toFixed(2)}x
                      </span>
                    </span>
                  </div>

                  {/* Visual Bar Indicator */}
                  <div className="h-3.5 w-full overflow-hidden rounded-full bg-ink-100/80">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isHigh
                          ? 'bg-emerald-600'
                          : isSlow
                          ? 'bg-amber-500'
                          : 'bg-sky-600'
                      }`}
                      style={{ width: `${Math.max(4, widthPct)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="mt-4 text-center text-xs text-muted py-6">
            Tidak ada toko mitra yang cocok dengan filter yang dipilih.
          </p>
        )}
      </div>}

      {/* TABEL PERINGKAT OPERASIONAL LENGKAP */}
      {view === 'branches' && <div className="rounded-xl border border-line bg-surface shadow-xs overflow-hidden shadow-xs">
        <div className="border-b border-line px-4 py-3 bg-paper/60 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-sm font-bold text-ink-900">
              Cabang ({filteredRankings.length})
            </h3>
          </div>
        </div>

        {filteredRankings.length > 0 ? (
          <div className="overflow-x-auto max-h-[38rem] overflow-y-auto">
            <table className="w-full min-w-[620px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-line bg-ink-50 font-bold text-ink-800">
                <tr>
                  <th scope="col" className="px-3 py-3 w-12 text-center">No</th>
                  <th scope="col" className="px-3 py-3">Cabang</th>
                  <th scope="col" className="px-3 py-3 text-right">Terjual 7 hari</th>
                  <th scope="col" className="px-3 py-3 text-right">Sisa stok</th>
                  <th scope="col" className="px-3 py-3 text-center">Status</th>
                  <th scope="col" className="px-3 py-3 text-center w-12">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {filteredRankings.map((partner) => {
                  const isExpanded = expandedPartnerId === partner.partner_id
                  const clusterBadge = getClusterBadge(partner.cluster_code)
                  const isCriticalStock = partner.dominant_risk_level === 'Kritis' || partner.has_lead_time_breach

                  return (
                    <tr
                      key={partner.partner_id}
                      className="group cursor-pointer hover:bg-ink-50/70 transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ink-900"
                      onClick={() => toggleExpand(partner.partner_id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          toggleExpand(partner.partner_id)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-expanded={isExpanded}
                      aria-label={`${partner.partner_name}, ${isExpanded ? 'tutup' : 'buka'} rincian produk`}
                    >
                      <td colSpan={6} className="p-0">
                        <div className="flex min-h-14 items-center px-3 py-2 w-full">
                          {/* Rank */}
                          <div className="w-12 text-center shrink-0">
                            <span
                              className={`inline-flex size-6 items-center justify-center rounded-full font-mono text-xs font-black ${
                                partner.rank <= 3
                                    ? 'bg-amber-100 text-amber-950 border border-amber-400'
                                    : 'bg-ink-100 text-ink-700'
                              }`}
                            >
                              {partner.rank}
                            </span>
                          </div>

                          {/* Toko & Lokasi */}
                          <div className="flex-1 min-w-[160px] px-3">
                            <strong className="block text-ink-900 group-hover:text-ink-700 truncate font-bold">
                              {partner.partner_name}
                            </strong>
                            <span className="text-[11px] text-muted flex items-center gap-1 font-medium">
                              <MapPin className="size-3 text-muted" aria-hidden="true" />
                              {partner.city}, {partner.province}
                            </span>
                          </div>

                          {/* Terjual 7 Hari */}
                          <div className="w-28 px-3 text-right tabular-nums text-ink-900 shrink-0 font-bold">
                            {partner.total_weekly_consumption.toLocaleString('id-ID')} pcs
                          </div>

                          {/* Sisa Stok Rak */}
                          <div className="w-24 px-3 text-right tabular-nums text-ink-900 shrink-0 font-medium">
                            {partner.total_current_stock.toLocaleString('id-ID')} pcs
                          </div>

                          {/* Status Stok */}
                          <div className="w-28 px-2 text-center shrink-0">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                                isCriticalStock
                                  ? 'bg-crit-bg text-crit-fg border border-crit-fg/30'
                                  : partner.dominant_risk_level === 'Waspada'
                                  ? 'bg-warn-bg text-warn-fg border border-warn-fg/30'
                                  : 'bg-ok-bg text-ok-fg border border-ok-fg/30'
                              }`}
                            >
                              {isCriticalStock ? 'Kirim segera' : partner.dominant_risk_level === 'Waspada' ? 'Pantau' : 'Aman'}
                            </span>
                          </div>

                          {/* Expand Icon */}
                          <div className="w-12 text-center shrink-0">
                            <span className="size-11 grid place-items-center text-muted">
                              {isExpanded ? (
                                <ChevronUp className="size-4 text-ink-900" aria-hidden="true" />
                              ) : (
                                <ChevronDown className="size-4" aria-hidden="true" />
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Rincian Expandable 4 Produk Resmi Daisuki */}
                        {isExpanded && (
                          <div className="bg-paper/70 border-t border-line px-6 py-4 space-y-3">
                            <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-ink-900">
                              <span className={`rounded-md border px-2 py-1 ${clusterBadge.className}`}>{clusterBadge.label}</span>
                              <span>Jadwal: {partner.recommended_schedule}</span>
                            </div>

                            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                              {partner.products.map((p) => {
                                const isProductCritical = p.predicted_risk_level === 'Kritis' || p.urgency_lead_time_breached
                                return (
                                  <div
                                    key={p.product_id}
                                    className="rounded-lg border border-line bg-surface shadow-xs p-3 space-y-2 shadow-xs"
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <strong className="text-xs font-bold text-ink-900 truncate">
                                        {p.product_name}
                                      </strong>
                                      <span
                                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                          isProductCritical
                                            ? 'bg-crit-bg text-crit-fg border border-crit-fg/30'
                                            : p.predicted_risk_level === 'Waspada'
                                            ? 'bg-warn-bg text-warn-fg border border-warn-fg/30'
                                            : 'bg-ok-bg text-ok-fg border border-ok-fg/30'
                                        }`}
                                      >
                                        {isProductCritical ? 'Wajib Kirim' : p.predicted_risk_level}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1.5 border-t border-line/60">
                                      <div>
                                        <span className="text-muted block text-[10px]">Terjual 7 Hari:</span>
                                        <strong className="font-mono tabular-nums text-ink-900 font-bold">
                                          {p.weekly_consumption} pcs
                                        </strong>
                                      </div>
                                      <div>
                                        <span className="text-muted block text-[10px]">Sisa Stok Rak:</span>
                                        <strong className="font-mono tabular-nums text-ink-900 font-bold">
                                          {p.current_qty} pcs
                                        </strong>
                                      </div>
                                      <div>
                                        <span className="text-muted block text-[10px]">Kecepatan Jual:</span>
                                        <span className="font-mono font-black text-ink-900">
                                          {p.absorption_rate.toFixed(2)}x
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-muted block text-[10px]">Ketahanan Stok:</span>
                                        <span
                                          className={`font-mono font-black ${
                                            p.urgency_lead_time_breached ? 'text-crit-fg' : 'text-ink-900'
                                          }`}
                                        >
                                          {p.predicted_days_to_stockout} Hari
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            <p className="text-xs text-ink-700 bg-surface border border-line rounded-md p-2.5">
                              <strong className="text-ink-900">Arahan Tindakan PIC:</strong> {partner.actionable_strategy}
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-muted">
            Tidak ada cabang toko yang memenuhi kriteria pencarian & filter.
          </div>
        )}
      </div>}
    </section>
  )
}
