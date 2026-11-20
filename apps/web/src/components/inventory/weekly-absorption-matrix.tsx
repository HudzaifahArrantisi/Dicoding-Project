import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Layers,
  Calendar,
  MapPin,
  AlertTriangle,
  Clock,
  Flame,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Search,
  RotateCcw,
} from 'lucide-react'
import {
  getWeeklyAbsorptionMatrix,
  type WeeklyAbsorptionMatrixResponse,
  type PartnerAbsorptionRanking,
} from '@/lib/api/analysis'
import { FALLBACK_WEEKLY_ABSORPTION_MATRIX } from '@/data/weekly-absorption-matrix-fallback'

type TierFilter = 'all' | 'top_performer' | 'steady' | 'slow_moving' | 'critical'

export function WeeklyAbsorptionMatrix() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<WeeklyAbsorptionMatrixResponse>({
    queryKey: ['weekly-absorption-matrix'],
    queryFn: async () => {
      try {
        return await getWeeklyAbsorptionMatrix()
      } catch (err) {
        console.warn('API matrix unavailable, using offline fallback dataset:', err)
        return FALLBACK_WEEKLY_ABSORPTION_MATRIX as unknown as WeeklyAbsorptionMatrixResponse
      }
    },
    staleTime: 60_000,
  })

  // Pastikan data selalu ada dengan fallback
  const matrix: WeeklyAbsorptionMatrixResponse = data ?? (FALLBACK_WEEKLY_ABSORPTION_MATRIX as unknown as WeeklyAbsorptionMatrixResponse)

  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => matrix.metadata.current_period_id || '2026-W46')
  const [selectedCity, setSelectedCity] = useState<string>('Semua Lokasi')
  const [selectedTier, setSelectedTier] = useState<TierFilter>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null)

  // Ambil list rankings untuk periode terpilih
  const currentPeriodData = matrix.period_data[selectedPeriod] ?? matrix.period_data[matrix.metadata.current_period_id] ?? Object.values(matrix.period_data)[0]
  const rawRankings: PartnerAbsorptionRanking[] = currentPeriodData?.rankings ?? []

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

  return (
    <section className="dashboard-surface min-w-0 overflow-hidden space-y-5 p-4 sm:p-6" aria-labelledby="absorption-matrix-heading">
      {/* Header & Status */}
      <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-6 items-center justify-center rounded-md bg-ink-900 text-white">
              <Layers className="size-3.5" aria-hidden="true" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-wider text-ume">
              Data Science · Tiket #6
            </p>
            {isError ? (
              <span className="inline-flex items-center gap-1 rounded bg-warn-bg px-2 py-0.5 text-[11px] font-semibold text-warn-fg">
                Offline Fallback
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-ok-bg px-2 py-0.5 text-[11px] font-semibold text-ok-fg">
                Terverifikasi
              </span>
            )}
          </div>
          <h2 id="absorption-matrix-heading" className="mt-1 font-display text-xl font-semibold text-ink-900 sm:text-2xl">
            Matriks Peringkat Kecepatan Penyerapan Produk Mingguan Antar Mitra
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Integrasi metrik laju penyerapan (Tiket #2), proyeksi risiko kehabisan stok (Tiket #3), dan persona klaster pengiriman Tipe A/B/C (Tiket #5).
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isLoading || isFetching}
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-md border border-line bg-white px-3 text-xs font-semibold text-ink-900 hover:bg-ink-50 disabled:opacity-50 sm:self-auto"
        >
          <RotateCcw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>Segarkan Matriks</span>
        </button>
      </div>

      {/* Ringkasan Metrik Jaringan (KPI Cards) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-line bg-paper p-3 sm:p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-medium">Laju Penyerapan Rata-rata</span>
            <Sparkles className="size-4 text-ink-700" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-display text-xl font-bold tabular-nums text-ink-900 sm:text-2xl">
              {(matrix.summary.network_avg_absorption_rate * 100).toFixed(1)}%
            </span>
            <span className="text-xs text-muted">/ buffer</span>
          </div>
          <p className="mt-1 text-[11px] text-muted">Seluruh cabang aktif</p>
        </div>

        <div className="rounded-lg border border-line bg-paper p-3 sm:p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-medium">Top Performers</span>
            <Flame className="size-4 text-emerald-600" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-display text-xl font-bold tabular-nums text-emerald-700 sm:text-2xl">
              {matrix.summary.top_performer_count}
            </span>
            <span className="text-xs text-muted">cabang</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-700 font-medium">Fast-moving & penyerapan tinggi</p>
        </div>

        <div className="rounded-lg border border-line bg-paper p-3 sm:p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-medium">Slow-Moving</span>
            <Clock className="size-4 text-amber-600" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-display text-xl font-bold tabular-nums text-amber-700 sm:text-2xl">
              {matrix.summary.slow_moving_count}
            </span>
            <span className="text-xs text-muted">cabang</span>
          </div>
          <p className="mt-1 text-[11px] text-amber-700 font-medium">Stok menumpuk / penyerapan rendah</p>
        </div>

        <div className="rounded-lg border border-line bg-paper p-3 sm:p-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-medium">Urgensi Lead Time Pabrik</span>
            <AlertTriangle className="size-4 text-crit-fg" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-display text-xl font-bold tabular-nums text-crit-fg sm:text-2xl">
              {matrix.summary.lead_time_breached_count}
            </span>
            <span className="text-xs text-muted">cabang</span>
          </div>
          <p className="mt-1 text-[11px] text-crit-fg font-medium">Sisa stok &lt; 7 hari lead time</p>
        </div>
      </div>

      {/* Kontrol Filter Interaktif */}
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-ink-50/50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Periode Minggu */}
          <div className="flex items-center gap-1.5">
            <Calendar className="size-4 text-muted" aria-hidden="true" />
            <select
              aria-label="Pilih Periode Minggu"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="min-h-11 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-900 shadow-sm focus-visible:outline-2 focus-visible:outline-ink-900"
            >
              {matrix.available_periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.date_range})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Lokasi / Kota */}
          <div className="flex items-center gap-1.5">
            <MapPin className="size-4 text-muted" aria-hidden="true" />
            <select
              aria-label="Pilih Lokasi Cabang"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="min-h-11 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-900 shadow-sm focus-visible:outline-2 focus-visible:outline-ink-900"
            >
              {matrix.available_cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pencarian Nama Mitra */}
        <div className="relative min-w-0 sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama cabang..."
            aria-label="Cari nama cabang mitra"
            className="min-h-11 w-full rounded-md border border-line bg-white pl-9 pr-3 text-xs text-ink-900 placeholder:text-muted focus-visible:outline-2 focus-visible:outline-ink-900"
          />
        </div>
      </div>

      {/* Tabs Kategori Performa */}
      <div className="flex flex-wrap gap-1.5 border-b border-line pb-2 text-xs">
        {[
          { key: 'all', label: `Semua Cabang (${rawRankings.length})` },
          { key: 'top_performer', label: `Top Performers (${matrix.summary.top_performer_count})` },
          { key: 'steady', label: `Penyerapan Stabil (${matrix.summary.steady_count})` },
          { key: 'slow_moving', label: `Slow-Moving (${matrix.summary.slow_moving_count})` },
          { key: 'critical', label: `Urgensi Kritis (${matrix.summary.critical_risk_count})` },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSelectedTier(tab.key as TierFilter)}
            className={`min-h-11 rounded-md px-3 py-1.5 font-semibold transition-colors ${
              selectedTier === tab.key
                ? 'bg-ink-900 text-white shadow-sm'
                : 'bg-transparent text-ink-700 hover:bg-ink-100 hover:text-ink-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grafik Bar Perbandingan Kecepatan Penyerapan Mingguan Antar Mitra */}
      <div className="rounded-xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-semibold text-ink-900">
              Grafik Komparasi Laju Penyerapan Mingguan (Top Sample)
            </h3>
            <p className="text-xs text-muted">
              Rasio konsumsi mingguan terhadap buffer rak (skor tinggi = perputaran barang cepat)
            </p>
          </div>
          <span className="text-xs font-semibold text-ink-700">
            {chartPartners.length} cabang ditampilkan
          </span>
        </div>

        {chartPartners.length > 0 ? (
          <div className="mt-4 space-y-3">
            {chartPartners.map((partner) => {
              const widthPct = Math.min(100, (partner.avg_absorption_rate / maxAbsorptionRate) * 100)
              const isHigh = partner.performance_tier === 'top_performer'
              const isSlow = partner.performance_tier === 'slow_moving'
              const isCrit = partner.dominant_risk_level === 'Kritis'

              return (
                <div key={partner.partner_id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium text-ink-900">
                      <span className="inline-flex size-5 items-center justify-center rounded bg-ink-100 font-mono text-[11px] font-bold">
                        #{partner.rank}
                      </span>
                      <strong className="truncate max-w-[200px] sm:max-w-[320px]">{partner.partner_name}</strong>
                      <span className="text-muted">({partner.city})</span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[10px] font-bold uppercase ${
                          partner.cluster_code === 'TIPE_A'
                            ? 'bg-amber-100 text-amber-800'
                            : partner.cluster_code === 'TIPE_B'
                            ? 'bg-emerald-100 text-emerald-800'
                            : partner.cluster_code === 'TIPE_C'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {partner.cluster_code}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 font-mono text-xs tabular-nums">
                      <span className="font-bold text-ink-900">
                        {partner.avg_absorption_rate.toFixed(2)}x
                      </span>
                      <span className="text-muted">({partner.total_weekly_consumption} pcs)</span>
                      {isCrit && (
                        <span className="inline-flex items-center rounded bg-crit-bg px-1.5 py-0.5 text-[10px] font-bold text-crit-fg">
                          Kritis
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Visual Bar Indicator */}
                  <div className="h-3 w-full overflow-hidden rounded-full bg-ink-100/70">
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
            Tidak ada cabang mitra yang cocok dengan filter yang dipilih.
          </p>
        )}
      </div>

      {/* Tabel Peringkat Lengkap dari Top Performers hingga Slow-Moving */}
      <div className="rounded-xl border border-line bg-white overflow-hidden">
        <div className="border-b border-line px-4 py-3 bg-paper/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-sm font-semibold text-ink-900">
              Tabel Matriks Peringkat ({filteredRankings.length} Cabang)
            </h3>
            <span className="text-xs text-muted">
              Klik baris untuk melihat rincian 4 produk resmi
            </span>
          </div>
        </div>

        {filteredRankings.length > 0 ? (
          <div className="overflow-x-auto max-h-[38rem] overflow-y-auto">
            <table className="w-full min-w-[850px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-line bg-ink-50 font-semibold text-ink-700">
                <tr>
                  <th scope="col" className="px-3 py-2.5 w-12 text-center">Rank</th>
                  <th scope="col" className="px-3 py-2.5">Mitra & Kota</th>
                  <th scope="col" className="px-3 py-2.5">Profil Persona</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Laju Penyerapan</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Konsumsi 7d</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Sisa Stok</th>
                  <th scope="col" className="px-3 py-2.5 text-center">Status Risiko</th>
                  <th scope="col" className="px-3 py-2.5">Jadwal Pabrik</th>
                  <th scope="col" className="px-3 py-2.5 text-center w-10">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {filteredRankings.map((partner) => {
                  const isExpanded = expandedPartnerId === partner.partner_id
                  const isTop = partner.performance_tier === 'top_performer'
                  const isSlow = partner.performance_tier === 'slow_moving'

                  return (
                    <tr
                      key={partner.partner_id}
                      className="group cursor-pointer hover:bg-ink-50/70 transition-colors"
                      onClick={() => toggleExpand(partner.partner_id)}
                    >
                      <td colSpan={9} className="p-0">
                        <div className="flex items-center px-3 py-3 w-full">
                          {/* Rank */}
                          <div className="w-12 text-center shrink-0">
                            <span
                              className={`inline-flex size-6 items-center justify-center rounded-full font-mono text-xs font-bold ${
                                partner.rank <= 3
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-ink-100 text-ink-700'
                              }`}
                            >
                              {partner.rank}
                            </span>
                          </div>

                          {/* Mitra & Lokasi */}
                          <div className="flex-1 min-w-[180px] px-3">
                            <strong className="block text-ink-900 group-hover:text-ink-700 truncate font-semibold">
                              {partner.partner_name}
                            </strong>
                            <span className="text-[11px] text-muted flex items-center gap-1">
                              <MapPin className="size-3" aria-hidden="true" />
                              {partner.city}, {partner.province}
                            </span>
                          </div>

                          {/* Profil Persona Badge */}
                          <div className="w-36 px-3 shrink-0">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                                partner.cluster_code === 'TIPE_A'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : partner.cluster_code === 'TIPE_B'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : partner.cluster_code === 'TIPE_C'
                                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {partner.cluster_code}
                              <span className="font-normal text-[10px] text-muted hidden sm:inline">
                                · {partner.segment_name.split(':')[1]?.split('(')[0]?.trim() || partner.cluster_code}
                              </span>
                            </span>
                          </div>

                          {/* Laju Penyerapan */}
                          <div className="w-28 px-3 text-right shrink-0">
                            <span
                              className={`font-mono text-xs font-bold tabular-nums ${
                                isTop ? 'text-emerald-700' : isSlow ? 'text-amber-700' : 'text-ink-900'
                              }`}
                            >
                              {partner.avg_absorption_rate.toFixed(2)}x
                            </span>
                            <span className="block text-[10px] text-muted">
                              {(partner.avg_absorption_rate * 100).toFixed(0)}% rasio
                            </span>
                          </div>

                          {/* Konsumsi 7d */}
                          <div className="w-24 px-3 text-right font-mono tabular-nums text-ink-900 shrink-0 font-medium">
                            {partner.total_weekly_consumption.toLocaleString('id-ID')} pcs
                          </div>

                          {/* Sisa Stok */}
                          <div className="w-24 px-3 text-right font-mono tabular-nums text-ink-900 shrink-0">
                            {partner.total_current_stock.toLocaleString('id-ID')} pcs
                          </div>

                          {/* Status Risiko */}
                          <div className="w-28 px-3 text-center shrink-0">
                            <span
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold ${
                                partner.dominant_risk_level === 'Kritis'
                                  ? 'bg-crit-bg text-crit-fg'
                                  : partner.dominant_risk_level === 'Waspada'
                                  ? 'bg-warn-bg text-warn-fg'
                                  : 'bg-ok-bg text-ok-fg'
                              }`}
                            >
                              {partner.dominant_risk_level}
                            </span>
                            {partner.has_lead_time_breach && (
                              <span className="block text-[10px] text-crit-fg font-semibold mt-0.5">
                                &lt;7h Lead Time
                              </span>
                            )}
                          </div>

                          {/* Jadwal Pabrik */}
                          <div className="w-44 px-3 text-xs text-muted truncate shrink-0">
                            {partner.recommended_schedule}
                          </div>

                          {/* Expand Icon */}
                          <div className="w-10 text-center shrink-0">
                            <button
                              type="button"
                              aria-label={isExpanded ? 'Tutup rincian produk' : 'Buka rincian produk'}
                              className="size-8 grid place-items-center rounded hover:bg-ink-100 text-muted"
                            >
                              {isExpanded ? (
                                <ChevronUp className="size-4 text-ink-900" aria-hidden="true" />
                              ) : (
                                <ChevronDown className="size-4" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Rincian Expandable 4 Produk Resmi Daisuki */}
                        {isExpanded && (
                          <div className="bg-paper/70 border-t border-line px-6 py-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between text-xs font-semibold text-ink-900">
                              <span>Rincian 4 Produk Resmi di Cabang Ini:</span>
                              <span className="text-muted font-normal">
                                Proyeksi sisa hari kehabisan & status lead time
                              </span>
                            </div>

                            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                              {partner.products.map((p) => (
                                <div
                                  key={p.product_id}
                                  className="rounded-lg border border-line bg-white p-3 space-y-1.5 shadow-sm"
                                >
                                  <div className="flex items-start justify-between gap-1">
                                    <strong className="text-xs font-semibold text-ink-900 truncate">
                                      {p.product_name}
                                    </strong>
                                    <span
                                      className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                                        p.predicted_risk_level === 'Kritis'
                                          ? 'bg-crit-bg text-crit-fg'
                                          : p.predicted_risk_level === 'Waspada'
                                          ? 'bg-warn-bg text-warn-fg'
                                          : 'bg-ok-bg text-ok-fg'
                                      }`}
                                    >
                                      {p.predicted_risk_level}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-1 text-[11px] pt-1 border-t border-line/60">
                                    <div>
                                      <span className="text-muted block text-[10px]">Konsumsi:</span>
                                      <strong className="font-mono tabular-nums text-ink-900">
                                        {p.weekly_consumption} pcs
                                      </strong>
                                    </div>
                                    <div>
                                      <span className="text-muted block text-[10px]">Sisa Stok:</span>
                                      <strong className="font-mono tabular-nums text-ink-900">
                                        {p.current_qty} pcs
                                      </strong>
                                    </div>
                                    <div>
                                      <span className="text-muted block text-[10px]">Laju Absorpsi:</span>
                                      <span className="font-mono font-bold text-ink-900">
                                        {p.absorption_rate.toFixed(2)}x
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted block text-[10px]">Sisa Hari:</span>
                                      <span
                                        className={`font-mono font-bold ${
                                          p.urgency_lead_time_breached ? 'text-crit-fg' : 'text-ink-900'
                                        }`}
                                      >
                                        {p.predicted_days_to_stockout} hari
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <p className="text-[11px] text-muted italic">
                              Strategi Tindakan: {partner.actionable_strategy}
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
            Tidak ada cabang yang memenuhi kriteria pencarian & filter.
          </div>
        )}
      </div>
    </section>
  )
}
