import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useDeferredValue, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { getStockStatus, type OrderStatus, type StockStatus } from '@daisuki/shared'
import { Dialog } from 'radix-ui'
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  Boxes,
  Building2,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Download,
  BrainCircuit,
  Database,
  Filter,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Minus,
  PanelLeftClose,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Store,
  Trash2,
  Truck,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/inventory/query-state'
import {
  BatchDetailModal,
  type StockLogBatch,
} from '@/components/inventory/batch-detail-modal'
import {
  PartnerStockDetailModal,
  type PartnerStockGroup,
} from '@/components/inventory/partner-stock-detail-modal'
import { PartnerDetailModal } from '@/components/inventory/partner-detail-modal'
import {
  OrderStatusBadge,
  StaleBadge,
  StockStatusBadge,
} from '@/components/inventory/status-badge'
import { api, resolveImageUrl } from '@/lib/api'
import { useInventoryEvents } from '@/lib/inventory-events'
import { RegionPicker, emptyRegion } from '@/components/inventory/region-picker'
import { apiError, unwrapData } from '@/lib/api-response'
import { useAuth } from '@/lib/auth'
import type {
  ManagedPartner,
  NotificationItem,
  Order,
  PartnerType,
  Product,
  StockItem,
} from '@/lib/inventory-types'

export const Route = createFileRoute('/admin')({ component: AdminDashboard })

interface Metrics {
  totalBranches: number
  criticalBranches: number
  pendingOrders: number
  criticalItemsCount: number
}

type AdminTab = 'stocks' | 'orders' | 'alerts' | 'partners' | 'data-science' | 'ai-insights'
type OrderCategoryTab = 'menunggu' | 'selesai' | 'ditolak'

const adminTabLabels: Record<AdminTab, string> = {
  stocks: 'Stok cabang',
  orders: 'Persetujuan pesanan',
  alerts: 'Notifikasi',
  partners: 'Manajemen mitra',
  'data-science': 'Log & Data',
  'ai-insights': 'AI Insights',
}

const EMPTY_ORDERS: Order[] = []

interface WeeklySummary {
  total_logs_this_week: number
  active_partners_count: number
  total_units_consumed: number
  daily_update_breakdown: Array<{ day: string; active_partners: number; log_count: number }>
}

interface StockLog {
  id: number
  partner_id: string
  partner_name: string
  product_name: string
  qty_before: number
  qty_after: number
  delta: number
  source: string
  created_at: string
}

interface StockLogPartner {
  partner_id: string
  partner_name: string
  log_count: number
  latest_update: string
}

interface AIInsights {
  frequent_stockouts: Array<{
    partner_id: string; partner_name: string; product_id: string; product_name: string
    current_qty: number; par_level: number; critical_log_count: number
  }>
  recommendations: Array<{
    partner_id: string; partner_name: string; product_id: string; product_name: string
    forecast_qty: number; suggested_qty: number; days_of_cover: string | null
    model_version: string; generated_at: string
  }>
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const host = window.location.hostname
  const apiUrl =
    host !== 'localhost' && host !== '127.0.0.1'
      ? `${window.location.protocol}//${host}:3001`
      : import.meta.env.VITE_API_URL || 'http://localhost:3001'
  const token = localStorage.getItem('daisuki_token')
  const response = await fetch(`${apiUrl}/admin/${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(result?.error ?? 'Permintaan belum berhasil. Coba lagi.')
  }
  return response.json() as Promise<T>
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    const msg = error.message.trim()
    if (msg && msg !== '[object Object]') return msg
  }
  return 'Periksa koneksi, lalu coba lagi.'
}

function formatDetailedDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—'
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (Number.isNaN(date.getTime())) return String(dateInput)

  const rawDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)

  const datePart = rawDate
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ')

  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${datePart} jam ${hours}.${minutes}`
}

function DataSciencePanel({
  summary,
  summaryLoading,
  summaryError,
  logPartners,
  logPartnersLoading,
  logPartnersError,
  totalPartners,
  onRetry,
  onExport,
}: {
  summary?: WeeklySummary
  summaryLoading: boolean
  summaryError: Error | null
  logPartners: StockLogPartner[]
  logPartnersLoading: boolean
  logPartnersError: Error | null
  totalPartners: number
  onRetry: () => void
  onExport: () => void
}) {
  const [selectedPartner, setSelectedPartner] = useState<StockLogPartner | null>(null)
  const partnerLogs = useQuery<{ data: StockLog[] }>({
    queryKey: ['admin-stock-logs-partner', selectedPartner?.partner_id],
    queryFn: () => adminFetch(`stock-logs/partners/${selectedPartner?.partner_id}`),
    enabled: selectedPartner !== null,
  })

  return (
    <section className="dashboard-panel-enter space-y-5" aria-labelledby="data-science-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="dashboard-eyebrow">Analisis stok</p>
          <h1 id="data-science-title" className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">Log & Data</h1>
          <p className="mt-1 text-sm text-muted">Perkembangan laporan dan konsumsi stok · 7 hari terakhir</p>
        </div>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-700"
        >
          <Download className="size-4" aria-hidden="true" />
          Export CSV
        </button>
      </div>

      {summaryError ? <ErrorState message={getErrorMessage(summaryError)} onRetry={onRetry} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <InsightMetric label="Total Log Minggu Ini" value={summaryLoading ? '…' : summary?.total_logs_this_week ?? 0} />
        <InsightMetric label="Mitra Aktif Melapor" value={summaryLoading ? '…' : `${summary?.active_partners_count ?? 0} / ${totalPartners}`} detail="Mitra aktif yang mengirim log dalam 7 hari" />
        <InsightMetric label="Rata-rata Konsumsi Harian" value={summaryLoading ? '…' : `${((summary?.total_units_consumed ?? 0) / 7).toFixed(1)} pcs`} detail="Unit per hari dari seluruh cabang" />
      </div>

      {summary?.daily_update_breakdown.length ? (
        <div className="dashboard-surface px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-900">Laporan harian</h3>
            <span className="text-xs text-muted">Mitra unik</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {summary.daily_update_breakdown.map((day) => (
              <div key={day.day} className="min-w-14 flex-1">
                <p className="text-xs text-muted">{new Date(`${day.day}T12:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })}</p>
                <p className="mt-1 font-display text-lg font-semibold tabular-nums text-ink-900">{day.active_partners}<span className="ml-1 text-[10px] font-normal text-muted">/ {totalPartners}</span></p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="dashboard-surface overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h3 className="font-semibold text-ink-900">Log perkembangan per mitra</h3>
          <p className="mt-1 text-sm text-muted">Klik nama mitra untuk melihat detail log perubahan stok.</p>
        </div>
        {logPartnersError ? <div className="p-4"><ErrorState message={getErrorMessage(logPartnersError)} onRetry={onRetry} /></div> : null}
        {logPartnersLoading ? <LoadingState label="Memuat daftar mitra..." /> : null}
        {!logPartnersLoading && !logPartnersError && logPartners.length === 0 ? <EmptyState title="Belum ada log stok" description="Mitra akan muncul setelah mengirim laporan perubahan stok." /> : null}
        <div className="divide-y divide-line">
          {logPartners.map((partner) => (
            <button
              key={partner.partner_id}
              type="button"
              onClick={() => setSelectedPartner(partner)}
              className="group flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink-700"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink-900 group-hover:text-ink-700">
                  {partner.partner_name}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {partner.log_count} log tercatat · Terakhir: {formatDetailedDateTime(partner.latest_update)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="hidden text-xs font-medium text-muted group-hover:text-ink-900 sm:inline">
                  Lihat detail
                </span>
                <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink-900" aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      </div>

      <PartnerStockLogDialog
        partner={selectedPartner}
        open={selectedPartner !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPartner(null)
        }}
        query={partnerLogs}
      />
    </section>
  )
}

function InsightMetric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <article className="dashboard-surface min-w-0 px-4 py-4 sm:px-5 sm:py-5">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-ink-900">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
    </article>
  )
}

function toLocalDateStr(dateInput: string | Date): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWeekDays(weekOffset: number): Date[] {
  const now = new Date()
  const dayOfWeek = (now.getDay() + 6) % 7 // Monday is 0, Sunday is 6
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek + weekOffset * 7)
  monday.setHours(0, 0, 0, 0)

  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    days.push(day)
  }
  return days
}

function formatWeekRange(weekDays: Date[], weekOffset: number): string {
  if (weekDays.length < 7) return 'Rentang Minggu'
  const first = weekDays[0]
  const last = weekDays[6]
  const firstDay = first.getDate()
  const lastDay = last.getDate()
  const firstMonth = first.toLocaleDateString('id-ID', { month: 'short' })
  const lastMonth = last.toLocaleDateString('id-ID', { month: 'short' })
  const year = last.getFullYear()

  const rangeStr =
    firstMonth === lastMonth
      ? `${firstDay} – ${lastDay} ${lastMonth} ${year}`
      : `${firstDay} ${firstMonth} – ${lastDay} ${lastMonth} ${year}`

  if (weekOffset === 0) return `Minggu Ini (${rangeStr})`
  if (weekOffset === -1) return `Minggu Kemarin (${rangeStr})`
  return `${Math.abs(weekOffset)} Minggu Lalu (${rangeStr})`
}

function formatDayDate(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput + 'T12:00:00') : dateInput
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}


function groupLogsByBatch(logs: StockLog[]): StockLogBatch[] {
  const map = new Map<string, StockLog[]>()

  for (const log of logs) {
    const d = new Date(log.created_at)
    const dateStr = toLocalDateStr(d)
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    const key = `${dateStr}_${hour}:${minute}_${log.source}`
    const existing = map.get(key)
    if (existing) {
      existing.push(log)
    } else {
      map.set(key, [log])
    }
  }

  const batches: StockLogBatch[] = []
  for (const [key, batchLogs] of map.entries()) {
    const firstLog = batchLogs[0]
    const d = new Date(firstLog.created_at)
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    const timeFormatted = `${hour}.${minute} WIB`
    const dateStr = toLocalDateStr(d)
    const sourceLabel =
      firstLog.source === 'manual_update'
        ? 'Laporan Mitra'
        : firstLog.source === 'order_received'
          ? 'Restock Masuk'
          : 'Penyesuaian'

    const totalConsumed = batchLogs.reduce(
      (sum, item) => (item.delta > 0 ? sum + item.delta : sum),
      0,
    )
    const totalRestocked = batchLogs.reduce(
      (sum, item) => (item.delta < 0 ? sum + Math.abs(item.delta) : sum),
      0,
    )

    batches.push({
      key,
      timeFormatted,
      timeRaw: `${hour}:${minute}`,
      dateStr,
      source: firstLog.source,
      sourceLabel,
      totalItems: batchLogs.length,
      totalConsumed,
      totalRestocked,
      logs: batchLogs,
    })
  }

  batches.sort(
    (a, b) =>
      new Date(b.logs[0].created_at).getTime() -
      new Date(a.logs[0].created_at).getTime(),
  )

  return batches
}

function PartnerStockLogDialog({
  partner,
  open,
  onOpenChange,
  query,
}: {
  partner: StockLogPartner | null
  open: boolean
  onOpenChange: (open: boolean) => void
  query: UseQueryResult<{ data: StockLog[] }>
}) {
  const dbHealthQuery = useQuery({
    queryKey: ['health-db'],
    queryFn: async () => {
      try {
        const response = await api.health.db.get()
        if (response.error) return false
        return Boolean(response.data.ok)
      } catch {
        return false
      }
    },
    enabled: open,
  })

  const isDbConnected = Boolean(dbHealthQuery.data)

  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<StockLogBatch | null>(null)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')

  // Reset to current week and reset selections when opening for a new partner
  useEffect(() => {
    if (open) {
      setWeekOffset(0)
      setSelectedDateStr(null)
      setSelectedBatch(null)
    }
  }, [open, partner?.partner_id])

  const allLogs = useMemo(() => query.data?.data ?? [], [query.data])

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset])

  const logsByDate = useMemo(() => {
    const map = new Map<string, StockLog[]>()
    for (const log of allLogs) {
      const key = toLocalDateStr(log.created_at)
      const list = map.get(key)
      if (list) list.push(log)
      else map.set(key, [log])
    }
    return map
  }, [allLogs])

  const todayStr = useMemo(() => toLocalDateStr(new Date()), [])

  // Auto-determine active date if not chosen or not in the visible week
  const activeDateStr = useMemo(() => {
    const currentWeekDates = weekDays.map((d) => toLocalDateStr(d))
    if (selectedDateStr && currentWeekDates.includes(selectedDateStr)) {
      return selectedDateStr
    }
    // If today is in current week, prefer today
    if (currentWeekDates.includes(todayStr)) {
      return todayStr
    }
    // Prefer the latest day with logs in this week
    for (let i = currentWeekDates.length - 1; i >= 0; i--) {
      const dStr = currentWeekDates[i]
      if ((logsByDate.get(dStr)?.length ?? 0) > 0) {
        return dStr
      }
    }
    // Default to Monday
    return currentWeekDates[0]
  }, [selectedDateStr, weekDays, todayStr, logsByDate])

  const activeDateLogs = useMemo(() => {
    return logsByDate.get(activeDateStr) ?? []
  }, [logsByDate, activeDateStr])

  const dayBatches = useMemo(() => {
    return groupLogsByBatch(activeDateLogs)
  }, [activeDateLogs])

  const activeDateObj = useMemo(() => {
    return new Date(activeDateStr + 'T12:00:00')
  }, [activeDateStr])


  if (!partner) return null

  const totalDayConsumed = activeDateLogs.reduce(
    (sum, l) => (l.delta > 0 ? sum + l.delta : sum),
    0,
  )
  const totalDayRestocked = activeDateLogs.reduce(
    (sum, l) => (l.delta < 0 ? sum + Math.abs(l.delta) : sum),
    0,
  )

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/45 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border border-line bg-white shadow-xl focus:outline-none animate-in fade-in zoom-in-95 duration-200">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-white p-4 sm:p-5">
            <div>
              <div className="flex items-center gap-2">
                <Dialog.Title className="text-lg font-semibold text-ink-900">
                  {partner.partner_name}
                </Dialog.Title>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${dbHealthQuery.isLoading
                      ? 'bg-ink-100 text-muted'
                      : isDbConnected
                        ? 'bg-ok-bg text-ok-fg'
                        : 'bg-crit-bg text-crit-fg'
                    }`}
                  title={
                    isDbConnected
                      ? 'Koneksi database Neon aktif (/health/db)'
                      : 'Koneksi database Neon terputus (/health/db)'
                  }
                >
                  <span
                    className={`size-1.5 rounded-full ${dbHealthQuery.isLoading
                        ? 'animate-pulse bg-ink-400'
                        : isDbConnected
                          ? 'animate-pulse bg-ok'
                          : 'bg-crit'
                      }`}
                    aria-hidden="true"
                  />
                  <span>
                    {dbHealthQuery.isLoading
                      ? 'Memeriksa DB...'
                      : isDbConnected
                        ? 'Live Sync'
                        : 'DB Terputus'}
                  </span>
                </span>
              </div>
              <Dialog.Description className="mt-1 text-sm text-muted">
                Riwayat perubahan stok cabang · {partner.log_count} log tercatat
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Tutup log perubahan"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-line text-muted hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            {!isDbConnected && !dbHealthQuery.isLoading ? (
              <div className="flex items-center gap-2 rounded-md border border-crit-fg/20 bg-crit-bg p-3 text-xs text-crit-fg animate-in fade-in duration-200">
                <AlertOctagon className="size-4 shrink-0" aria-hidden="true" />
                <span>
                  Koneksi database terputus (/health/db). Log perubahan stok mungkin tidak sinkron secara real-time.
                </span>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-ink-50/70 p-3 text-xs text-muted">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>
                  Terakhir:{' '}
                  <strong className="font-semibold text-ink-900">
                    {formatDetailedDateTime(partner.latest_update)}
                  </strong>
                </span>
                <span>
                  Total:{' '}
                  <strong className="font-semibold tabular-nums text-ink-900">
                    {partner.log_count} log
                  </strong>
                </span>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center rounded-md border border-line bg-white p-0.5 font-semibold">
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors ${viewMode === 'calendar'
                      ? 'bg-ink-900 text-white shadow-2xs'
                      : 'text-muted hover:text-ink-900'
                    }`}
                >
                  <Calendar className="size-3.5" aria-hidden="true" />
                  <span>Kalender</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors ${viewMode === 'list'
                      ? 'bg-ink-900 text-white shadow-2xs'
                      : 'text-muted hover:text-ink-900'
                    }`}
                >
                  <Clock className="size-3.5" aria-hidden="true" />
                  <span>Semua Log</span>
                </button>
              </div>
            </div>

            {query.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingState label="Memuat riwayat log perubahan..." />
              </div>
            ) : query.isError ? (
              <ErrorState
                message={getErrorMessage(query.error)}
                onRetry={() => void query.refetch()}
              />
            ) : !allLogs.length ? (
              <EmptyState
                title="Belum ada riwayat perubahan"
                description="Cabang ini belum mencatat perubahan stok fisik."
              />
            ) : viewMode === 'list' ? (
              /* Flat list of all logs */
              <div className="overflow-hidden rounded-md border border-line">
                <div className="divide-y divide-line">
                  {allLogs.map((log) => {
                    const isConsumption = log.delta > 0
                    const isRestock = log.delta < 0
                    const sourceLabel =
                      log.source === 'manual_update'
                        ? 'Laporan Mitra'
                        : log.source === 'order_received'
                          ? 'Restock Masuk'
                          : 'Penyesuaian'

                    return (
                      <article
                        key={log.id}
                        className="flex flex-col gap-2 p-3.5 transition-colors hover:bg-ink-50/50 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink-900">
                            {log.product_name}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                            <span className="font-medium text-ink-700">
                              {formatDetailedDateTime(log.created_at)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-medium text-ink-700">
                              {sourceLabel}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <div className="flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-sm tabular-nums">
                            <span className="text-muted">{log.qty_before}</span>
                            <span className="text-xs text-muted" aria-hidden="true">
                              →
                            </span>
                            <span className="font-semibold text-ink-900">
                              {log.qty_after}
                            </span>
                          </div>
                          <span
                            className={`min-w-16 rounded px-2 py-1 text-center text-xs font-bold tabular-nums ${isConsumption
                                ? 'bg-crit-bg text-crit-fg'
                                : isRestock
                                  ? 'bg-ok-bg text-ok-fg'
                                  : 'bg-ink-100 text-muted'
                              }`}
                          >
                            {isConsumption
                              ? `−${log.delta}`
                              : isRestock
                                ? `+${Math.abs(log.delta)}`
                                : '0'}
                          </span>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            ) : (
              /* ALUR UTAMA: Navigasi Minggu + 7 Hari (Senin - Minggu) + Jam Perubahan */
              <div className="space-y-4">
                {/* 1. Bar Navigasi Minggu (< dan >) */}
                <div className="relative flex flex-wrap items-center justify-center gap-2 rounded-md border border-line bg-white p-3 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setWeekOffset((w) => w - 1)
                        setSelectedBatch(null)
                      }}
                      className="inline-flex size-9 items-center justify-center rounded-md border border-line bg-white text-ink-900 shadow-xs hover:border-ink-400 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-ink-700"
                      title="Lihat minggu kemarin (<)"
                      aria-label="Minggu kemarin"
                    >
                      <ChevronLeft className="size-4" aria-hidden="true" />
                    </button>

                    <div className="flex items-center gap-2 px-1">
                      <Calendar className="size-4 text-ink-700" aria-hidden="true" />
                      <span className="font-display text-sm font-semibold text-ink-900">
                        {formatWeekRange(weekDays, weekOffset)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setWeekOffset((w) => Math.min(0, w + 1))
                        setSelectedBatch(null)
                      }}
                      disabled={weekOffset >= 0}
                      className="inline-flex size-9 items-center justify-center rounded-md border border-line bg-white text-ink-900 shadow-xs hover:border-ink-400 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ink-700"
                      title="Lihat minggu berikutnya (>)"
                      aria-label="Minggu berikutnya"
                    >
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  {weekOffset !== 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setWeekOffset(0)
                        setSelectedBatch(null)
                      }}
                      className="inline-flex items-center rounded-md border border-line bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100 hover:text-ink-900 sm:absolute sm:right-3"
                    >
                      Kembali ke Minggu Ini
                    </button>
                  ) : null}
                </div>

                {/* 2. Grid 7 Hari (Senin sampai Minggu) */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {weekDays.map((d, index) => {
                    const dStr = toLocalDateStr(d)
                    const isSelected = dStr === activeDateStr
                    const isToday = dStr === todayStr
                    const count = logsByDate.get(dStr)?.length ?? 0
                    const dayNameShort = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'][index]
                    const dayNameFull = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'][index]
                    const dayNumber = d.getDate()

                    return (
                      <button
                        key={dStr}
                        type="button"
                        onClick={() => {
                          setSelectedDateStr(dStr)
                          setSelectedBatch(null)
                        }}
                        className={`group relative flex flex-col items-center justify-between rounded-md border p-2 text-center transition-all focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink-700 sm:p-2.5 ${isSelected
                            ? 'border-ink-900 bg-ink-900 text-white shadow-sm ring-2 ring-ink-900/20'
                            : count > 0
                              ? 'border-line bg-white text-ink-900 hover:border-ink-400 hover:bg-ink-50/80'
                              : 'border-line/70 bg-ink-50/40 text-muted hover:border-line hover:bg-ink-50'
                          }`}
                      >
                        <span
                          className={`text-[11px] font-semibold sm:text-xs ${isSelected ? 'text-white/90' : 'text-muted'
                            }`}
                        >
                          <span className="sm:hidden">{dayNameShort}</span>
                          <span className="hidden sm:inline">{dayNameFull}</span>
                        </span>

                        <span
                          className={`my-1 font-display text-base font-bold tabular-nums sm:text-lg ${isSelected ? 'text-white' : 'text-ink-900'
                            }`}
                        >
                          {dayNumber}
                        </span>

                        <div className="flex items-center gap-1">
                          {count > 0 ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-ok-bg text-ok-fg'
                                }`}
                            >
                              <span
                                className={`size-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-ok'
                                  }`}
                              />
                              {count} log
                            </span>
                          ) : (
                            <span
                              className={`text-[10px] ${isSelected ? 'text-white/60' : 'text-muted/60'
                                }`}
                            >
                              —
                            </span>
                          )}
                        </div>

                        {isToday ? (
                          <span
                            className={`absolute -top-1.5 right-1 rounded-sm px-1 text-[8px] font-bold uppercase tracking-wider ${isSelected
                                ? 'bg-white text-ink-900'
                                : 'bg-ink-900 text-white'
                              }`}
                          >
                            Hari Ini
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>

                {/* 3. Panel Detail Hari Terpilih & Jam-Jam Perubahan */}
                <div className="rounded-md border border-line bg-white p-4 sm:p-5 shadow-xs">
                  <div className="flex flex-col gap-2 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar className="size-4 text-ink-700" aria-hidden="true" />
                        <h4 className="font-display text-base font-bold text-ink-900">
                          {formatDayDate(activeDateObj)}
                        </h4>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {dayBatches.length > 0
                          ? `${dayBatches.length} sesi · ${activeDateLogs.length} produk`
                          : 'Tidak ada laporan stok tercatat pada tanggal ini'}
                      </p>
                    </div>

                    {activeDateLogs.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {totalDayConsumed > 0 ? (
                          <span className="rounded-md bg-crit-bg px-2 py-0.5 font-bold text-crit-fg tabular-nums">
                            −{totalDayConsumed} pcs
                          </span>
                        ) : null}
                        {totalDayRestocked > 0 ? (
                          <span className="rounded-md bg-ok-bg px-2 py-0.5 font-bold text-ok-fg tabular-nums">
                            +{totalDayRestocked} pcs
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="pt-4">
                    {dayBatches.length === 0 ? (
                      <EmptyState
                        title="Tidak ada aktivitas stok"
                        description={`Cabang ${partner.partner_name} tidak mencatat perubahan stok fisik pada ${formatDayDate(activeDateObj)}.`}
                      />
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-muted">
                          <span className="font-semibold text-ink-900">
                            Sesi Waktu
                          </span>
                          <span>
                            {dayBatches.length} sesi tercatat
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          {dayBatches.map((batch) => (
                            <button
                              key={batch.key}
                              type="button"
                              onClick={() => setSelectedBatch(batch)}
                              className="group flex flex-col justify-between rounded-lg border border-line bg-white p-3.5 text-left shadow-2xs transition-all hover:border-ink-500 hover:bg-ink-50/40 hover:shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-ink-100 text-ink-700 transition-colors group-hover:bg-ink-700 group-hover:text-white">
                                    <Clock className="size-3.5" aria-hidden="true" />
                                  </span>
                                  <div>
                                    <span className="font-display text-sm font-bold text-ink-900">
                                      {batch.timeFormatted}
                                    </span>
                                    <p className="text-[11px] text-muted">
                                      {batch.totalItems} item
                                    </p>
                                  </div>
                                </div>

                                <span
                                  className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-[11px] font-semibold ${batch.source === 'order_received'
                                      ? 'bg-ok-bg text-ok-fg'
                                      : 'bg-ink-100 text-ink-700'
                                    }`}
                                >
                                  {batch.sourceLabel}
                                </span>
                              </div>

                              <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2 text-xs">
                                <div className="flex items-center gap-1.5 font-bold tabular-nums">
                                  {batch.totalConsumed > 0 ? (
                                    <span className="rounded bg-crit-bg px-1.5 py-0.5 text-crit-fg">
                                      −{batch.totalConsumed} pcs
                                    </span>
                                  ) : null}
                                  {batch.totalRestocked > 0 ? (
                                    <span className="rounded bg-ok-bg px-1.5 py-0.5 text-ok-fg">
                                      +{batch.totalRestocked} pcs
                                    </span>
                                  ) : null}
                                </div>

                                <span className="inline-flex items-center gap-1 font-semibold text-ink-700 transition-transform group-hover:translate-x-0.5">
                                  <span>Lihat detail</span>
                                  <span aria-hidden="true">→</span>
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end border-t border-line bg-paper/60 px-4 py-3 sm:px-5">
            <Dialog.Close asChild>
              <button
                type="button"
                className="min-h-10 rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink-900 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
              >
                Tutup
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>

        <BatchDetailModal
          batch={selectedBatch}
          partnerName={partner.partner_name}
          dateLabel={formatDayDate(activeDateObj)}
          open={Boolean(selectedBatch)}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedBatch(null)
          }}
        />
      </Dialog.Portal>
    </Dialog.Root>
  )
}


function AIInsightsPanel({
  data,
  loading,
  error,
  onRetry,
}: {
  data?: AIInsights
  loading: boolean
  error: Error | null
  onRetry: () => void
}) {
  const stockouts = data?.frequent_stockouts ?? []
  const recommendations = data?.recommendations ?? []
  return (
    <section className="dashboard-panel-enter space-y-5" aria-labelledby="ai-insights-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="dashboard-eyebrow">Perencanaan stok</p>
          <h1 id="ai-insights-title" className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">AI Insights</h1>
          <p className="mt-1 text-sm text-muted">Cabang berisiko dan alokasi yang disarankan</p>
        </div>
        <span className="text-xs text-muted">Diperbarui otomatis · 15 detik</span>
      </div>
      {error ? <ErrorState message={getErrorMessage(error)} onRetry={onRetry} /> : null}
      {loading ? <LoadingState label="Memuat analisis stok..." /> : (
        <>
          <div className="dashboard-surface overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <h3 className="font-semibold text-ink-900">Mitra sering kehabisan barang</h3>
              <p className="mt-1 text-sm text-muted">Stok saat ini di bawah 20% par atau pernah mencapai kondisi kritis dalam 30 hari.</p>
            </div>
            {stockouts.length ? <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-ink-50 text-xs text-muted"><tr><th className="px-4 py-3 font-semibold">Cabang</th><th className="px-4 py-3 font-semibold">Produk</th><th className="px-4 py-3 text-right font-semibold">Stok / Par</th><th className="px-4 py-3 text-right font-semibold">Log kritis (30 hari)</th><th className="px-4 py-3 font-semibold">Kondisi</th></tr></thead>
              <tbody className="divide-y divide-line">{stockouts.map((row) => <tr key={`${row.partner_id}-${row.product_id}`}><td className="px-4 py-3 font-medium text-ink-900">{row.partner_name}</td><td className="px-4 py-3">{row.product_name}</td><td className="num px-4 py-3 text-right tabular-nums">{row.current_qty} / {row.par_level}</td><td className="num px-4 py-3 text-right tabular-nums">{row.critical_log_count}</td><td className="px-4 py-3"><span className="rounded-sm bg-crit-bg px-2 py-1 text-xs font-semibold text-crit-fg">Kritis</span></td></tr>)}</tbody>
            </table></div> : <EmptyState title="Tidak ada cabang kritis" description="Belum ada mitra yang memenuhi ambang stok kritis." />}
          </div>

          <div className="dashboard-surface overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <h3 className="font-semibold text-ink-900">Rekomendasi alokasi pengiriman</h3>
              <p className="mt-1 text-sm text-muted">Saran terbaru berdasarkan stok cabang dan ketersediaan gudang pusat.</p>
            </div>
            {recommendations.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-ink-50 text-xs text-muted"><tr><th className="px-4 py-3 font-semibold">Cabang</th><th className="px-4 py-3 font-semibold">Produk</th><th className="px-4 py-3 text-right font-semibold">Disarankan</th><th className="px-4 py-3 text-right font-semibold">Cakupan</th><th className="px-4 py-3 font-semibold">Prioritas</th><th className="px-4 py-3 font-semibold">Dibuat</th></tr></thead>
              <tbody className="divide-y divide-line">{recommendations.map((row, index) => {
                const emergency = Number(row.days_of_cover ?? 0) < 2
                return <tr key={`${row.partner_id}-${row.product_id}-${row.generated_at}-${index}`}><td className="px-4 py-3 font-medium text-ink-900">{row.partner_name}</td><td className="px-4 py-3">{row.product_name}</td><td className="num px-4 py-3 text-right font-semibold tabular-nums">{row.suggested_qty} pcs</td><td className="num px-4 py-3 text-right tabular-nums">{row.days_of_cover ?? '—'} hari</td><td className="px-4 py-3"><span className={`rounded-sm px-2 py-1 text-xs font-semibold ${emergency ? 'bg-crit-bg text-crit-fg' : 'bg-warn-bg text-warn-fg'}`}>{emergency ? 'Darurat' : 'Terjadwal'}</span></td><td className="px-4 py-3 text-muted">{new Date(row.generated_at).toLocaleString('id-ID')}</td></tr>
              })}</tbody>
            </table></div> : <EmptyState title="Belum ada rekomendasi" description="Jalankan pipeline AI untuk mengisi saran alokasi cabang." />}
          </div>
        </>
      )}
    </section>
  )
}

function AdminDashboard() {
  const { user, token, logout, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  useInventoryEvents(user?.role === 'admin' ? token : null, 'admin')
  const [tab, setTab] = useState<AdminTab>('stocks')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const selectTab = (nextTab: AdminTab) => {
    setTab(nextTab)
    setMobileMenuOpen(false)
  }

  useEffect(() => {
    if (!mobileMenuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    mobileCloseButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(
        sidebarRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [],
      ).filter((button) => button.offsetParent !== null)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      mobileMenuButtonRef.current?.focus()
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeMobileMenu = () => {
      if (desktop.matches) setMobileMenuOpen(false)
    }
    desktop.addEventListener('change', closeMobileMenu)
    return () => desktop.removeEventListener('change', closeMobileMenu)
  }, [])
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [partner, setPartner] = useState('semua')
  const [status, setStatus] = useState<StockStatus | 'semua' | 'belum_update'>(
    'semua',
  )
  const [approved, setApproved] = useState<
    Partial<Record<string, Partial<Record<string, number>>>>
  >({})
  const [adminNotes, setAdminNotes] = useState<Partial<Record<string, string>>>(
    {},
  )
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [activeOrderCategory, setActiveOrderCategory] =
    useState<OrderCategoryTab>('menunggu')
  const dirtyApprovalOrderIds = useRef(new Set<string>())

  const handleViewOrderDetail = (
    orderId: string,
    category: OrderCategoryTab = 'menunggu',
  ) => {
    setActiveOrderCategory(category)
    setSelectedOrderId(orderId)
    setTab('orders')
  }

  const handleNavigateToStock = (partnerName?: string) => {
    if (partnerName) {
      setPartner(partnerName)
    }
    setTab('stocks')
  }

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      void navigate({ to: '/login' })
    }
  }, [authLoading, navigate, user])

  const metrics = useQuery<Metrics>({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      const response = await api.admin.metrics.get()
      if (response.error || 'error' in response.data) {
        throw apiError(
          response.error ?? response.data,
          'Ringkasan belum dimuat',
        )
      }
      return response.data
    },
    enabled: user?.role === 'admin',
    staleTime: 30_000,
  })
  const stocks = useQuery<StockItem[]>({
    queryKey: ['admin-stocks'],
    queryFn: async () =>
      unwrapData(
        await api.stocks.get({ query: {} }),
        'Stok cabang belum dimuat',
      ),
    enabled: user?.role === 'admin' && (tab === 'stocks' || tab === 'orders'),
    staleTime: 30_000,
  })
  const centralProducts = useQuery<Product[]>({
    queryKey: ['admin-central-products'],
    queryFn: async () =>
      unwrapData(await api.products.get(), 'Stok pusat belum dimuat'),
    enabled: user?.role === 'admin' && tab === 'stocks',
    staleTime: 30_000,
  })
  const orders = useQuery<Order[]>({
    queryKey: ['admin-orders'],
    queryFn: async () =>
      unwrapData(await api.orders.get({ query: {} }), 'Pesanan belum dimuat'),
    enabled: user?.role === 'admin' && (tab === 'orders' || tab === 'alerts'),
    staleTime: 30_000,
  })
  const notifications = useQuery<NotificationItem[]>({
    queryKey: ['admin-notifications'],
    queryFn: async () =>
      unwrapData(await api.notifications.get(), 'Notifikasi belum dimuat'),
    enabled: user?.role === 'admin',
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
  const weeklySummary = useQuery<{ data: WeeklySummary }>({
    queryKey: ['admin-weekly-summary'],
    queryFn: () => adminFetch('weekly-summary'),
    enabled: user?.role === 'admin' && tab === 'data-science',
  })
  const logPartners = useQuery<{ data: StockLogPartner[] }>({
    queryKey: ['admin-stock-log-partners'],
    queryFn: () => adminFetch('stock-logs/partners'),
    enabled: user?.role === 'admin' && tab === 'data-science',
  })
  const aiInsights = useQuery<{ data: AIInsights }>({
    queryKey: ['admin-ai-insights'],
    queryFn: () => adminFetch('ai-insights'),
    enabled: user?.role === 'admin' && tab === 'ai-insights',
    refetchInterval: 60_000,
  })

  const exportRawLogs = async () => {
    try {
      const host = window.location.hostname
      const apiUrl =
        host !== 'localhost' && host !== '127.0.0.1'
          ? `${window.location.protocol}//${host}:3001`
          : import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const token = localStorage.getItem('daisuki_token')
      const response = await fetch(`${apiUrl}/admin/stock-logs/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!response.ok) throw new Error('Ekspor log belum berhasil.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'raw_stock_logs.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  useEffect(() => {
    if (!orders.data) return
    setApproved((current) =>
      Object.fromEntries(
        orders.data.map((order) => [
          order.id,
          dirtyApprovalOrderIds.current.has(order.id)
            ? current[order.id]
            : Object.fromEntries(
              order.items.map((item) => [
                item.product_id,
                item.qty_approved ?? item.qty_requested,
              ]),
            ),
        ]),
      ),
    )
    setAdminNotes((current) =>
      Object.fromEntries(
        orders.data.map((order) => [
          order.id,
          dirtyApprovalOrderIds.current.has(order.id)
            ? (current[order.id] ?? '')
            : (order.admin_note ?? ''),
        ]),
      ),
    )
  }, [orders.data])

  const updateOrder = useMutation({
    mutationFn: async (input: {
      id: string
      status: OrderStatus
      rejected_reason?: string
    }) => {
      const response = await api.orders({ id: input.id }).status.patch({
        status: input.status,
        rejected_reason: input.rejected_reason,
      })
      if (response.error) throw apiError(response.error, 'Status belum berubah')
    },
    onSuccess: async () => {
      toast.success('Status pesanan diperbarui')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-metrics'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-central-products'] }),
      ])
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  })

  const saveApproval = useMutation({
    mutationFn: async (input: {
      id: string
      admin_note?: string
      items: Array<{ product_id: string; qty_approved: number }>
    }) => {
      const response = await api.orders({ id: input.id }).approval.patch({
        admin_note: input.admin_note,
        items: input.items,
      })
      if (response.error)
        throw apiError(response.error, 'Persetujuan belum disimpan')
    },
    onSuccess: async (_data, variables) => {
      dirtyApprovalOrderIds.current.delete(variables.id)
      toast.success('Jumlah persetujuan disimpan')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-metrics'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
      ])
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  })

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.notifications({ id }).read.patch()
      if (response.error)
        throw apiError(response.error, 'Notifikasi belum ditandai')
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-notifications'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-metrics'] })
    },
  })

  const markAllRead = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id) => api.notifications({ id }).read.patch()),
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-notifications'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-metrics'] })
      toast.success('Semua alert berhasil ditandai sudah dibaca')
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  })

  const partnerNames = useMemo(
    () =>
      Array.from(new Set((stocks.data ?? []).map((item) => item.partner_name))),
    [stocks.data],
  )
  const filteredStocks = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase()
    return (stocks.data ?? []).filter((item) => {
      if (partner !== 'semua' && item.partner_name !== partner) return false
      if (status === 'belum_update' && !item.is_stale) return false
      if (
        status !== 'semua' &&
        status !== 'belum_update' &&
        item.status !== status
      )
        return false
      return (
        !keyword ||
        [item.partner_name, item.product_name, item.product_sku].some((value) =>
          value.toLowerCase().includes(keyword),
        )
      )
    })
  }, [partner, deferredSearch, status, stocks.data])
  const unread = useMemo(
    () => (notifications.data ?? []).reduce((count, item) => count + Number(!item.read_at), 0),
    [notifications.data],
  )

  if (authLoading || !user || user.role !== 'admin') {
    return (
      <main className="grid min-h-screen place-items-center bg-paper">
        <p className="text-sm text-muted" role="status">
          Memeriksa akses admin...
        </p>
      </main>
    )
  }

  return (
    <div className="dashboard-page admin-dashboard min-h-screen text-text lg:flex">
      <button
        type="button"
        className={`fixed inset-0 z-40 bg-ink-900/35 transition-opacity duration-[240ms] lg:hidden ${mobileMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-label="Tutup menu admin"
        inert={!mobileMenuOpen}
        onClick={() => setMobileMenuOpen(false)}
      />
      <AdminSidebar
        sidebarRef={sidebarRef}
        mobileCloseButtonRef={mobileCloseButtonRef}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        tab={tab}
        onSelectTab={selectTab}
        pendingOrders={metrics.data?.pendingOrders}
        unread={unread}
        userName={user.full_name}
        onLogout={() => { logout(); void navigate({ to: '/login' }) }}
      />

      <div className="min-w-0 flex-1">
        <header className="admin-topbar sticky top-0 z-30 border-b border-line bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <button
                ref={mobileMenuButtonRef}
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="grid size-11 shrink-0 place-items-center rounded-md text-ink-700 hover:bg-ink-50 lg:hidden"
                aria-label="Buka menu admin"
                aria-controls="admin-sidebar"
                aria-expanded={mobileMenuOpen}
              >
                <Menu className="size-5" aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink-700 lg:text-muted">Admin Pusat</p>
                <p className="truncate font-display text-base font-semibold text-ink-900 sm:text-lg">{adminTabLabels[tab]}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setTab('alerts')} className="relative grid size-11 place-items-center rounded-md text-ink-700 hover:bg-ink-50" aria-label={`${unread} notifikasi belum dibaca`}>
                <Bell className="size-5" aria-hidden="true" />
                {unread ? <span className="absolute right-1 top-1 rounded-sm bg-crit px-1 text-[10px] font-bold text-white">{unread}</span> : null}
              </button>
              <button type="button" aria-label="Keluar" onClick={() => { logout(); void navigate({ to: '/login' }) }} className="grid size-11 place-items-center rounded-md text-muted hover:bg-ink-50 lg:hidden">
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {tab === 'stocks' ? (
            <section aria-labelledby="summary-title" className="dashboard-panel-enter">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="dashboard-eyebrow">Ringkasan</p>
                  <h1 id="summary-title" className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">Kondisi operasional</h1>
                </div>
                <span className="hidden text-xs text-muted sm:block">Data terkini dari seluruh cabang</span>
              </div>
              {metrics.isError ? (
                <ErrorState message={getErrorMessage(metrics.error)} onRetry={() => void metrics.refetch()} />
              ) : (
                <div className="admin-summary grid md:grid-cols-3">
                  <Metric label="Cabang mitra" value={metrics.data?.totalBranches} detail="Cabang terdaftar" Icon={Building2} />
                  <Metric label="Cabang kritis" value={metrics.data?.criticalBranches} detail={`${metrics.data?.criticalItemsCount ?? 0} produk perlu perhatian`} Icon={AlertOctagon} critical />
                  <Metric label="Perlu persetujuan" value={metrics.data?.pendingOrders} detail="Pesanan menunggu keputusan" Icon={ClipboardCheck} />
                </div>
              )}
            </section>
          ) : null}

          {tab === 'stocks' ? (
            <StockPanel
              query={stocks}
              centralProductsQuery={centralProducts}
              rows={filteredStocks}
              search={search}
              partner={partner}
              status={status}
              partnerNames={partnerNames}
              onSearch={setSearch}
              onPartner={setPartner}
              onStatus={setStatus}
            />
          ) : null}
          {tab === 'orders' ? (
            <OrderPanel
              query={orders}
              stocks={stocks.data}
              approved={approved}
              adminNotes={adminNotes}
              onAdminNoteChange={(orderId, note) => {
                dirtyApprovalOrderIds.current.add(orderId)
                setAdminNotes((current) => ({
                  ...current,
                  [orderId]: note,
                }))
              }}
              pending={updateOrder.isPending || saveApproval.isPending}
              onApprovedChange={(orderId, productId, qty) => {
                dirtyApprovalOrderIds.current.add(orderId)
                setApproved((current) => ({
                  ...current,
                  [orderId]: {
                    ...current[orderId],
                    [productId]: Math.max(0, qty),
                  },
                }))
              }}
              onApprove={(order) =>
                saveApproval.mutateAsync({
                  id: order.id,
                  admin_note: adminNotes[order.id]?.trim() || undefined,
                  items: order.items.map((item) => ({
                    product_id: item.product_id,
                    qty_approved:
                      approved[order.id]?.[item.product_id] ??
                      item.qty_approved ??
                      item.qty_requested,
                  })),
                })
              }
              onReject={(id, reason) =>
                updateOrder.mutateAsync({
                  id,
                  status: 'ditolak',
                  rejected_reason: reason,
                })
              }
              onShip={(id) =>
                updateOrder.mutateAsync({ id, status: 'dalam_pengiriman' })
              }
              selectedOrderId={selectedOrderId}
              onSelectOrder={setSelectedOrderId}
              activeCategory={activeOrderCategory}
              onActiveCategoryChange={setActiveOrderCategory}
            />
          ) : null}
          {tab === 'alerts' ? (
            <AlertPanel
              query={notifications}
              orders={orders.data ?? EMPTY_ORDERS}
              marking={markRead.isPending}
              isMarkingAll={markAllRead.isPending}
              onRead={(id) => markRead.mutate(id)}
              onReadAll={(ids) => markAllRead.mutate(ids)}
              onViewOrderDetail={handleViewOrderDetail}
              onNavigateToStock={handleNavigateToStock}
            />
          ) : null}
          {tab === 'partners' ? <PartnerManagementPanel /> : null}
          {tab === 'data-science' ? (
            <DataSciencePanel
              summary={weeklySummary.data?.data}
              summaryLoading={weeklySummary.isLoading}
              summaryError={weeklySummary.error}
              logPartners={logPartners.data?.data ?? []}
              logPartnersLoading={logPartners.isLoading}
              logPartnersError={logPartners.error}
              totalPartners={metrics.data?.totalBranches ?? 0}
              onRetry={() => {
                void weeklySummary.refetch()
                void logPartners.refetch()
              }}
              onExport={() => void exportRawLogs()}
            />
          ) : null}
          {tab === 'ai-insights' ? (
            <AIInsightsPanel
              data={aiInsights.data?.data}
              loading={aiInsights.isLoading}
              error={aiInsights.error}
              onRetry={() => void aiInsights.refetch()}
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}

function AdminSidebar({
  sidebarRef,
  mobileCloseButtonRef,
  mobileMenuOpen,
  onCloseMobile,
  tab,
  onSelectTab,
  pendingOrders,
  unread,
  userName,
  onLogout,
}: {
  sidebarRef: RefObject<HTMLElement | null>
  mobileCloseButtonRef: RefObject<HTMLButtonElement | null>
  mobileMenuOpen: boolean
  onCloseMobile: () => void
  tab: AdminTab
  onSelectTab: (tab: AdminTab) => void
  pendingOrders?: number
  unread: number
  userName: string
  onLogout: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      id="admin-sidebar"
      ref={sidebarRef}
      className={`admin-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-3rem))] shrink-0 overflow-hidden border-r border-line lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 lg:visible ${mobileMenuOpen ? 'visible translate-x-0' : 'invisible -translate-x-full'} ${collapsed ? 'lg:w-16' : 'lg:w-64'}`}
      data-mobile-open={mobileMenuOpen}
      data-collapsed={collapsed}
      role={mobileMenuOpen ? 'dialog' : undefined}
      aria-modal={mobileMenuOpen ? true : undefined}
      aria-label="Navigasi admin pusat"
    >
      <div className="admin-sidebar-content flex h-full w-[min(18rem,calc(100vw-3rem))] shrink-0 flex-col overflow-y-auto px-3 py-5 lg:w-64" inert={collapsed && !mobileMenuOpen}>
        <div className="flex items-center gap-2 lg:pr-11">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-ink-900 text-white">
            <Boxes className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold leading-tight text-ink-900">Daisuki</p>
            <p className="text-xs text-muted">Admin Pusat</p>
          </div>
          <button
            ref={mobileCloseButtonRef}
            type="button"
            onClick={onCloseMobile}
            className="grid size-11 shrink-0 place-items-center rounded-md text-ink-700 hover:bg-white lg:hidden"
            aria-label="Tutup sidebar"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <nav className="mt-9 flex-1 space-y-1" aria-label="Menu admin">
          <p className="px-3 pb-2 text-xs font-semibold text-muted">Operasional</p>
          <TabButton label="Stok cabang" Icon={Boxes} active={tab === 'stocks'} onClick={() => onSelectTab('stocks')} />
          <TabButton label="Persetujuan" Icon={ClipboardCheck} active={tab === 'orders'} count={pendingOrders} onClick={() => onSelectTab('orders')} />
          <TabButton label="Notifikasi" Icon={Bell} active={tab === 'alerts'} count={unread} critical onClick={() => onSelectTab('alerts')} />
          <TabButton label="Mitra" Icon={Building2} active={tab === 'partners'} onClick={() => onSelectTab('partners')} />
          <p className="px-3 pb-2 pt-6 text-xs font-semibold text-muted">Analisis</p>
          <TabButton label="Log & Data" Icon={Database} active={tab === 'data-science'} onClick={() => onSelectTab('data-science')} />
          <TabButton label="AI Insights" Icon={BrainCircuit} active={tab === 'ai-insights'} onClick={() => onSelectTab('ai-insights')} />
        </nav>
        <div className="border-t border-line pt-4">
          <p className="truncate px-3 text-sm font-semibold text-ink-900">{userName}</p>
          <p className="px-3 text-xs text-muted">Admin Pusat</p>
          <button
            type="button"
            onClick={onLogout}
            className="mt-4 flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-sm font-medium text-ink-700 hover:bg-white"
            aria-label="Keluar"
            title="Keluar"
          >
            <LogOut className="size-4 shrink-0" aria-hidden="true" /> <span>Keluar</span>
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        className="absolute right-3 top-5 hidden size-10 place-items-center rounded-md text-ink-700 hover:bg-white lg:grid"
        aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
        aria-controls="admin-sidebar"
        aria-expanded={!collapsed}
        title={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
      >
        <PanelLeftClose className={`size-5 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
    </aside>
  )
}

function TabButton({
  label,
  Icon,
  active,
  onClick,
  count,
  critical = false,
}: {
  label: string
  Icon: typeof Boxes
  active: boolean
  onClick: () => void
  count?: number
  critical?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      title={label}
      className={`flex min-h-11 w-full items-center gap-3 rounded-md border px-3 text-left text-sm font-semibold transition-colors duration-150 ${active ? 'border-line bg-white text-ink-900' : 'border-transparent text-ink-700 hover:bg-white hover:text-ink-900'}`}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{label}</span>
      {count ? (
        <span
          className={`rounded-sm px-1.5 py-0.5 text-xs tabular-nums ${critical ? 'bg-crit-bg text-crit-fg' : 'bg-ink-100 text-ink-700'}`}
        >
          {count}
        </span>
      ) : null}
    </button>
  )
}

function Metric({
  label,
  value,
  detail,
  Icon,
  critical = false,
}: {
  label: string
  value?: number
  detail?: string
  Icon: typeof Boxes
  critical?: boolean
}) {
  return (
    <article className="admin-metric min-w-0 px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-muted">{label}</p>
        <Icon className={`size-5 ${critical && value ? 'text-crit-fg' : 'text-ink-500'}`} aria-hidden="true" />
      </div>
      <p className={`mt-5 font-display text-4xl font-semibold tabular-nums leading-none ${critical && value ? 'text-crit-fg' : 'text-ink-900'}`}>
        {value ?? '–'}
      </p>
      {detail ? <p className="mt-2 text-xs text-muted">{detail}</p> : null}
    </article>
  )
}

const emptyPartnerForm = {
  name: '',
  type: 'hotel' as PartnerType,
  address: '',
  pic_name: '',
  phone: '',
  username: '',
  password: '',
  ...emptyRegion,
}

function PartnerManagementPanel() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editingPartner, setEditingPartner] = useState<ManagedPartner | null>(null)
  const [selectedDetailPartner, setSelectedDetailPartner] = useState<ManagedPartner | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredPartnerSearch = useDeferredValue(searchQuery)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [visiblePartners, setVisiblePartners] = useState(30)
  const [form, setForm] = useState(emptyPartnerForm)
  const [partnerToDelete, setPartnerToDelete] = useState<ManagedPartner | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    setVisiblePartners(30)
  }, [searchQuery, typeFilter])

  const partnersQuery = useQuery<{
    data: ManagedPartner[]
    pagination?: { page: number; limit: number; total: number; totalPages: number }
  }>({
    queryKey: ['admin-partners', debouncedSearch, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
      if (typeFilter && typeFilter !== 'all') params.set('type', typeFilter)
      params.set('limit', '200')
      const qs = params.toString()
      return adminFetch(`partners${qs ? `?${qs}` : ''}`)
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-partners'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-stocks'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
    ])
  }
  const savePartner = useMutation({
    mutationFn: () => editingPartner
      ? adminFetch(`partners/${editingPartner.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name, type: form.type, address: form.address,
          pic_name: form.pic_name, phone: form.phone,
          province_code: form.province_code, regency_code: form.regency_code,
          district_code: form.district_code, village_code: form.village_code,
        }),
      })
      : adminFetch('partners', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: async () => {
      setFormOpen(false)
      setForm(emptyPartnerForm)
      toast.success(editingPartner ? 'Profil mitra diperbarui' : 'Mitra baru dan akun login berhasil dibuat')
      setEditingPartner(null)
      await refresh()
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  })

  const [selectedPartnerIds, setSelectedPartnerIds] = useState<Set<string>>(new Set())
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)

  const deletePartner = useMutation({
    mutationFn: (id: string) => adminFetch(`partners/${id}`, { method: 'DELETE' }),
    onSuccess: async (_, id) => {
      setPartnerToDelete(null)
      setSelectedPartnerIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      toast.success('Mitra dan datanya berhasil dihapus')
      await refresh()
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  })

  const deleteBulkPartners = useMutation({
    mutationFn: (ids: string[]) =>
      adminFetch<{ success: boolean; count: number }>('partners/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
    onSuccess: async (data) => {
      setBulkDeleteDialogOpen(false)
      const count = data.count
      setSelectedPartnerIds(new Set())
      toast.success(`${count} mitra berhasil dihapus`)
      await refresh()
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  })

  const fieldClass = 'min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700'
  const labelClass = 'mb-1.5 block text-sm font-semibold text-ink-900'
  const openCreate = () => { setEditingPartner(null); setForm(emptyPartnerForm); setFormOpen(true) }
  const openEdit = (partner: ManagedPartner) => {
    setEditingPartner(partner)
    setForm({
      name: partner.name, type: partner.type, address: partner.address ?? '',
      pic_name: partner.pic_name ?? '', phone: partner.pic_phone ?? '',
      username: partner.username ?? '', password: '',
      province_code: partner.province_code ?? '', regency_code: partner.regency_code ?? '',
      district_code: partner.district_code ?? '', village_code: partner.village_code ?? '',
    })
    setFormOpen(true)
  }

  const allPartners = partnersQuery.data?.data ?? []
  const filteredPartners = useMemo(() => {
    const q = deferredPartnerSearch.trim().toLowerCase()
    return allPartners.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.pic_name && p.pic_name.toLowerCase().includes(q)) ||
        (p.pic_phone && p.pic_phone.includes(q)) ||
        (p.username && p.username.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q)) ||
        (p.village_name && p.village_name.toLowerCase().includes(q)) ||
        (p.district_name && p.district_name.toLowerCase().includes(q)) ||
        (p.regency_name && p.regency_name.toLowerCase().includes(q)) ||
        (p.province_name && p.province_name.toLowerCase().includes(q))

      const matchesType = typeFilter === 'all' || p.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [allPartners, deferredPartnerSearch, typeFilter])

  const toggleSelectPartner = (id: string) => {
    setSelectedPartnerIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const isAllFilteredSelected =
    filteredPartners.length > 0 &&
    filteredPartners.every((p) => selectedPartnerIds.has(p.id))

  const isSomeFilteredSelected =
    filteredPartners.some((p) => selectedPartnerIds.has(p.id)) &&
    !isAllFilteredSelected

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      setSelectedPartnerIds((prev) => {
        const next = new Set(prev)
        for (const p of filteredPartners) {
          next.delete(p.id)
        }
        return next
      })
    } else {
      setSelectedPartnerIds((prev) => {
        const next = new Set(prev)
        for (const p of filteredPartners) {
          next.add(p.id)
        }
        return next
      })
    }
  }

  const selectedPartnersList = useMemo(() => {
    return allPartners.filter((p) => selectedPartnerIds.has(p.id))
  }, [allPartners, selectedPartnerIds])

  return (
    <section aria-labelledby="partner-management-title" className="dashboard-panel-enter space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="dashboard-eyebrow">Jaringan mitra</p>
          <h1 id="partner-management-title" className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl">Manajemen mitra</h1>
          <p className="mt-1 text-sm text-muted">Kelola cabang dan akun masuk portal mitra.</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700">
          <Plus className="size-4" aria-hidden="true" /> Tambah mitra
        </button>
      </div>

      {/* Filter & Pencarian */}
      <div className="dashboard-surface flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama mitra, PIC, telepon, wilayah..."
            className="min-h-11 w-full rounded-md border border-line bg-white pl-9 pr-10 text-sm text-ink-900 placeholder:text-muted"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-ink-50 hover:text-ink-900"
              aria-label="Hapus pencarian"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink-900 sm:w-auto"
            aria-label="Filter jenis mitra"
          >
            <option value="all">Semua Jenis ({allPartners.length})</option>
            <option value="hotel">Hotel</option>
            <option value="restoran">Restoran</option>
            <option value="kafe">Kafe</option>
            <option value="minimarket">Minimarket</option>
            <option value="lainnya">Lainnya</option>
          </select>
        </div>
      </div>

      {partnersQuery.isLoading ? <LoadingState label="Memuat daftar mitra..." /> : null}
      {partnersQuery.isError ? <ErrorState message={getErrorMessage(partnersQuery.error)} onRetry={() => void partnersQuery.refetch()} /> : null}
      {allPartners.length === 0 && !partnersQuery.isLoading ? (
        <EmptyState title="Belum ada mitra" description="Tambahkan mitra pertama untuk membuat akun portal cabang." />
      ) : null}

      {filteredPartners.length === 0 && allPartners.length > 0 ? (
        <div className="rounded-lg border border-line bg-white p-8 text-center">
          <p className="text-sm font-medium text-ink-900">Tidak ada mitra yang cocok dengan filter</p>
          <p className="mt-1 text-xs text-muted">Coba ubah kata kunci pencarian atau jenis usaha.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setTypeFilter('all')
            }}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-white px-3.5 text-sm font-semibold text-ink-900 hover:bg-ink-50"
          >
            Reset filter
          </button>
        </div>
      ) : null}

      {/* Toolbar Pilihan Massal & Hapus Banyak Mitra */}
      {filteredPartners.length > 0 ? (
        <div className="dashboard-surface flex flex-wrap items-center justify-between gap-3 p-3 sm:px-4">
          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-ink-900 select-none">
              <input
                type="checkbox"
                ref={(el) => {
                  if (el) el.indeterminate = isSomeFilteredSelected
                }}
                checked={isAllFilteredSelected}
                onChange={toggleSelectAllFiltered}
                className="size-4.5 cursor-pointer rounded border-line text-ink-900 accent-ink-900 focus:ring-ink-700"
              />
              <span>
                {isAllFilteredSelected
                  ? `Semua ${filteredPartners.length} mitra terpilih`
                  : selectedPartnerIds.size > 0
                    ? `${selectedPartnerIds.size} dari ${filteredPartners.length} mitra terpilih`
                    : `Pilih Semua (${filteredPartners.length})`}
              </span>
            </label>
            {selectedPartnerIds.size > 0 ? (
              <button
                type="button"
                onClick={() => setSelectedPartnerIds(new Set())}
                className="text-xs font-semibold text-muted hover:text-ink-900 hover:underline"
              >
                Batalkan pilihan
              </button>
            ) : null}
          </div>

          {selectedPartnerIds.size > 0 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBulkDeleteDialogOpen(true)}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md bg-crit px-3.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-crit-fg focus-visible:outline-2 focus-visible:outline-crit"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                <span>Hapus {selectedPartnerIds.size} Mitra Terpilih</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* List Mitra dengan Border terpisah & Nomor Urut */}
      <div className="space-y-2.5">
        {filteredPartners.slice(0, visiblePartners).map((partner, index) => {
          const isSelected = selectedPartnerIds.has(partner.id)
          const regionSummary = [
            partner.district_name,
            partner.regency_name,
            partner.province_name,
          ]
            .filter(Boolean)
            .join(', ')

          return (
            <article
              key={partner.id}
              className={`dashboard-surface flex flex-col justify-between gap-3 p-4 transition-all sm:flex-row sm:items-center sm:p-5 ${isSelected
                  ? 'border-ink-700 bg-ink-50/50 shadow-xs ring-1 ring-ink-700'
                  : 'hover:border-line'
                }`}
            >
              {/* Sisi Kiri: Checkbox, Nomor Urut, Ikon & Rincian Ringkas */}
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {/* Checkbox Pilihan */}
                <div className="flex items-center pt-1">
                  <input
                    type="checkbox"
                    id={`select-partner-${partner.id}`}
                    checked={isSelected}
                    onChange={() => toggleSelectPartner(partner.id)}
                    aria-label={`Pilih mitra ${partner.name}`}
                    className="size-4.5 cursor-pointer rounded border-line text-ink-900 accent-ink-900 focus:ring-ink-700"
                  />
                </div>

                {/* Badge Nomor Urut */}
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-ink-100 font-display text-xs font-bold tabular-nums text-ink-700">
                  {index + 1}
                </span>

                {/* Ikon Cabang */}
                {/* Informasi Mitra */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDetailPartner(partner)}
                      className="min-h-11 max-w-full truncate text-left font-display text-base font-semibold text-ink-900 hover:underline"
                    >
                      {partner.name}
                    </button>
                    <span className="rounded-sm bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-700">
                      {partner.type}
                    </span>
                    {partner.username ? (
                      <span className="hidden text-xs text-muted md:inline">
                        @{partner.username}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    <span>
                      PIC:{' '}
                      <strong className="font-medium text-ink-900">
                        {partner.pic_name || '—'}
                      </strong>
                    </span>
                    {partner.pic_phone ? (
                      <span>
                        Telp:{' '}
                        <strong className="font-medium tabular-nums text-ink-900">
                          {partner.pic_phone}
                        </strong>
                      </span>
                    ) : null}
                    {regionSummary ? (
                      <span className="truncate max-w-xs">
                        Wilayah:{' '}
                        <span className="font-medium text-ink-900">
                          {regionSummary}
                        </span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Sisi Kanan: Aksi (Detail popup, Ubah, Hapus) */}
              <div className="flex shrink-0 items-center gap-1 border-t border-line pt-3 sm:border-t-0 sm:pt-0">
                <button
                  type="button"
                  onClick={() => setSelectedDetailPartner(partner)}
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink-900 hover:bg-ink-50"
                >
                  Detail
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(partner)}
                  className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md px-3 text-sm font-semibold text-ink-700 hover:bg-ink-100"
                  aria-label={`Ubah profil ${partner.name}`}
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Ubah</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPartnerToDelete(partner)}
                  className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md px-3 text-sm font-semibold text-crit-fg hover:bg-crit-bg"
                  aria-label={`Hapus ${partner.name}`}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Hapus</span>
                </button>
              </div>
            </article>
          )
        })}
        {filteredPartners.length > visiblePartners ? (
          <button
            type="button"
            onClick={() => setVisiblePartners((current) => current + 30)}
            className="min-h-11 w-full rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            Tampilkan 30 mitra berikutnya
          </button>
        ) : null}
      </div>

      {/* Popup Modal Detail Mitra */}
      <PartnerDetailModal
        partner={selectedDetailPartner}
        open={selectedDetailPartner !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDetailPartner(null)
        }}
        onEdit={(partner) => {
          setSelectedDetailPartner(null)
          openEdit(partner)
        }}
        onDelete={(partner) => {
          setSelectedDetailPartner(null)
          setPartnerToDelete(partner)
        }}
      />

      {/* Popup Modal Tambah / Ubah Profil Mitra */}
      <Dialog.Root open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open && !savePartner.isPending) { setForm(emptyPartnerForm); setEditingPartner(null) } }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-white p-5 shadow-xl focus-visible:outline-none sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
              <div>
                <Dialog.Title className="font-display text-xl font-bold text-ink-900">{editingPartner ? `Ubah profil ${editingPartner.name}` : 'Tambah mitra baru'}</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted">{editingPartner ? 'Perbarui data cabang dan wilayah mitra.' : 'Isi data cabang dan buat akun untuk PIC mitra.'}</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Tutup form"
                  className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-white text-muted transition hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-ink-700"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); savePartner.mutate() }}>
              <div className="sm:col-span-2"><label className={labelClass} htmlFor="partner-name">Nama mitra</label><input id="partner-name" className={fieldClass} required minLength={2} maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
              <div><label className={labelClass} htmlFor="partner-type">Jenis perusahaan</label><select id="partner-type" className={fieldClass} value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as PartnerType })}><option value="hotel">Hotel</option><option value="restoran">Rumah makan / restoran</option><option value="kafe">Kafe</option><option value="minimarket">Minimarket</option><option value="lainnya">Lainnya</option></select></div>
              <div><label className={labelClass} htmlFor="partner-phone">Nomor telepon</label><input id="partner-phone" className={fieldClass} type="tel" required minLength={8} maxLength={24} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
              <div className="sm:col-span-2"><label className={labelClass} htmlFor="partner-address">Alamat</label><textarea id="partner-address" className={`${fieldClass} min-h-24 py-3`} required minLength={5} maxLength={500} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div>
              <div className="sm:col-span-2"><label className={labelClass} htmlFor="partner-pic">Nama PIC mitra</label><input id="partner-pic" className={fieldClass} required minLength={2} maxLength={120} value={form.pic_name} onChange={(event) => setForm({ ...form, pic_name: event.target.value })} /></div>
              <div className="sm:col-span-2"><RegionPicker idPrefix="admin-partner-region" value={{ province_code: form.province_code, regency_code: form.regency_code, district_code: form.district_code, village_code: form.village_code }} onChange={(region) => setForm({ ...form, ...region })} required={!editingPartner} /></div>
              {!editingPartner ? <><div><label className={labelClass} htmlFor="partner-username">Username</label><input id="partner-username" className={fieldClass} required minLength={3} maxLength={40} pattern="[a-z0-9._-]+" autoComplete="off" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase().trim() })} /><p className="mt-1 text-xs text-muted">Huruf kecil, angka, titik, _ atau -</p></div>
                <div><label className={labelClass} htmlFor="partner-password">Kata sandi</label><input id="partner-password" className={fieldClass} type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><p className="mt-1 text-xs text-muted">Minimal 8 karakter.</p></div></> : null}
              <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:col-span-2 sm:flex-row sm:justify-end"><Dialog.Close asChild><button type="button" className="min-h-11 rounded-md border border-line px-4 text-sm font-semibold text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700">Batal</button></Dialog.Close><button type="submit" disabled={savePartner.isPending} className="min-h-11 rounded-md bg-ink-900 px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700 disabled:opacity-60">{savePartner.isPending ? 'Menyimpan...' : 'Simpan mitra'}</button></div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={partnerToDelete !== null} onOpenChange={(open) => { if (!open && !deletePartner.isPending) setPartnerToDelete(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-xs animate-in fade-in duration-200" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-white p-5 shadow-2xl focus-visible:outline-none animate-in fade-in zoom-in-95 duration-200 sm:p-6">
            <Dialog.Title className="font-display text-xl font-bold text-ink-900">Hapus {partnerToDelete?.name}?</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-muted">Akun login, stok, riwayat laporan, pesanan, dan notifikasi mitra ini akan dihapus permanen dari database.</Dialog.Description>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setPartnerToDelete(null)} disabled={deletePartner.isPending} className="min-h-11 rounded-md border border-line px-4 text-sm font-semibold text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700">Batal</button><button type="button" onClick={() => { if (partnerToDelete) deletePartner.mutate(partnerToDelete.id) }} disabled={deletePartner.isPending} className="min-h-11 rounded-md bg-crit px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crit disabled:opacity-60">{deletePartner.isPending ? 'Menghapus...' : 'Hapus permanen'}</button></div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Dialog Konfirmasi Hapus Massal */}
      <Dialog.Root
        open={bulkDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && !deleteBulkPartners.isPending) setBulkDeleteDialogOpen(false)
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-xs animate-in fade-in duration-200" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-white p-5 shadow-2xl focus-visible:outline-none animate-in fade-in zoom-in-95 duration-200 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-full bg-crit-bg text-crit">
                <Trash2 className="size-5" aria-hidden="true" />
              </div>
              <div>
                <Dialog.Title className="font-display text-xl font-bold text-ink-900">
                  Hapus {selectedPartnerIds.size} Mitra Terpilih?
                </Dialog.Title>
                <p className="text-xs text-muted">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>

            <Dialog.Description className="mt-3 text-sm leading-6 text-muted">
              Semua akun login portal mitra, stok cabang, riwayat mutasi log, pesanan restock, dan notifikasi terkait untuk{' '}
              <strong className="font-bold text-ink-900">{selectedPartnerIds.size} mitra</strong>{' '}
              ini akan dihapus permanen dari sistem database.
            </Dialog.Description>

            {/* Ringkasan daftar mitra yang akan dihapus */}
            <div className="mt-4 max-h-40 overflow-y-auto rounded-lg border border-line bg-ink-50/50 p-3 text-xs">
              <p className="mb-2 font-semibold text-ink-900">Mitra yang akan dihapus:</p>
              <ul className="space-y-1.5">
                {selectedPartnersList.slice(0, 10).map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-ink-800">
                    <span className="size-1.5 shrink-0 rounded-full bg-crit" />
                    <span className="font-medium truncate">{p.name}</span>
                    <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ink-700">
                      {p.type}
                    </span>
                  </li>
                ))}
                {selectedPartnersList.length > 10 ? (
                  <li className="pt-1 text-[11px] font-semibold text-muted pl-3.5">
                    ... dan {selectedPartnersList.length - 10} mitra lainnya
                  </li>
                ) : null}
              </ul>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setBulkDeleteDialogOpen(false)}
                disabled={deleteBulkPartners.isPending}
                className="min-h-11 rounded-md border border-line px-4 text-sm font-semibold text-ink-900 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => deleteBulkPartners.mutate(Array.from(selectedPartnerIds))}
                disabled={deleteBulkPartners.isPending}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-crit px-4 text-sm font-semibold text-white hover:bg-crit-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crit disabled:opacity-60"
              >
                {deleteBulkPartners.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Menghapus {selectedPartnerIds.size} mitra...</span>
                  </>
                ) : (
                  <span>Hapus {selectedPartnerIds.size} Mitra Permanen</span>
                )}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  )
}

function StockPanel({
  query,
  centralProductsQuery,
  rows,
  search,
  partner,
  status,
  partnerNames,
  onSearch,
  onPartner,
  onStatus,
}: {
  query: UseQueryResult<StockItem[]>
  centralProductsQuery: UseQueryResult<Product[]>
  rows: StockItem[]
  search: string
  partner: string
  status: StockStatus | 'semua' | 'belum_update'
  partnerNames: string[]
  onSearch: (value: string) => void
  onPartner: (value: string) => void
  onStatus: (value: StockStatus | 'semua' | 'belum_update') => void
}) {
  const queryClient = useQueryClient()
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null)
  const [visibleBranches, setVisibleBranches] = useState(24)
  const [centralStockDrafts, setCentralStockDrafts] = useState<
    Record<string, string>
  >({})
  const dirtyCentralStockIds = useRef(new Set<string>())
  const [isBatchSaving, setIsBatchSaving] = useState(false)

  useEffect(() => {
    setVisibleBranches(24)
  }, [search, partner, status])

  useEffect(() => {
    if (!centralProductsQuery.data) return
    setCentralStockDrafts((current) =>
      Object.fromEntries(
        centralProductsQuery.data.map((product) => [
          product.id,
          dirtyCentralStockIds.current.has(product.id)
            ? (current[product.id] ?? String(product.central_stock))
            : String(product.central_stock),
        ]),
      ),
    )
  }, [centralProductsQuery.data])

  const changedProducts = useMemo(() => {
    if (!centralProductsQuery.data) return []
    return centralProductsQuery.data.filter((prod) => {
      const draft =
        centralStockDrafts[prod.id] ?? String(prod.central_stock)
      const parsedDraft = Number(draft)
      return (
        Number.isInteger(parsedDraft) &&
        parsedDraft >= 0 &&
        parsedDraft !== prod.central_stock
      )
    })
  }, [centralProductsQuery.data, centralStockDrafts])

  const hasInvalidDraft = useMemo(() => {
    if (!centralProductsQuery.data) return false
    return centralProductsQuery.data.some((prod) => {
      const draft =
        centralStockDrafts[prod.id] ?? String(prod.central_stock)
      const parsedDraft = Number(draft)
      return !Number.isInteger(parsedDraft) || parsedDraft < 0
    })
  }, [centralProductsQuery.data, centralStockDrafts])

  const saveCentralStock = async (productId?: string) => {
    const productsToSave = productId
      ? changedProducts.filter((product) => product.id === productId)
      : changedProducts

    if (productsToSave.length === 0) {
      toast.info('Tidak ada perubahan stok pusat yang perlu disimpan')
      return
    }

    const hasInvalidSelectedDraft = productsToSave.some((product) => {
      const value = Number(centralStockDrafts[product.id])
      return !Number.isInteger(value) || value < 0
    })
    if (hasInvalidSelectedDraft) {
      toast.error('Pastikan semua jumlah stok berupa bilangan bulat, minimal 0')
      return
    }

    setIsBatchSaving(true)
    try {
      const itemsToSave = productsToSave.map((prod) => {
        const value = Number(centralStockDrafts[prod.id])
        return {
          productId: prod.id,
          name: prod.name,
          centralStock: value,
        }
      })

      const results = await Promise.all(
        itemsToSave.map(async (item) => {
          const response = await api
            .products({ id: item.productId })
          ['central-stock'].put({ central_stock: item.centralStock })

          if (response.error || 'error' in response.data) {
            throw apiError(
              response.error ?? response.data,
              `Gagal memperbarui stok ${item.name}`,
            )
          }
          return item
        }),
      )

      for (const item of results) {
        dirtyCentralStockIds.current.delete(item.productId)
      }

      setCentralStockDrafts((current) => {
        const next = { ...current }
        for (const item of results) {
          next[item.productId] = String(item.centralStock)
        }
        return next
      })

      await queryClient.invalidateQueries({
        queryKey: ['admin-central-products'],
      })

      toast.success(
        results.length === 1
          ? `Stok ${results[0].name} berhasil diperbarui`
          : `${results.length} stok produk berhasil diperbarui`,
      )
    } catch (error: unknown) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsBatchSaving(false)
    }
  }

  const resetAllDrafts = () => {
    if (!centralProductsQuery.data) return
    dirtyCentralStockIds.current.clear()
    setCentralStockDrafts(
      Object.fromEntries(
        centralProductsQuery.data.map((prod) => [
          prod.id,
          String(prod.central_stock),
        ]),
      ),
    )
    toast.info('Perubahan dibatalkan')
  }

  const adjustStock = (productId: string, delta: number, originalStock: number) => {
    dirtyCentralStockIds.current.add(productId)
    setCentralStockDrafts((current) => {
      const currentVal = Number(current[productId] ?? originalStock)
      const base = Number.isNaN(currentVal) ? originalStock : currentVal
      const nextVal = Math.max(0, base + delta)
      return {
        ...current,
        [productId]: String(nextVal),
      }
    })
  }

  const resetSingleDraft = (productId: string, originalStock: number) => {
    dirtyCentralStockIds.current.delete(productId)
    setCentralStockDrafts((current) => ({
      ...current,
      [productId]: String(originalStock),
    }))
  }

  const branchGroups = useMemo<PartnerStockGroup[]>(() => {
    const map = new Map<string, PartnerStockGroup>()
    for (const item of rows) {
      if (!map.has(item.partner_id)) {
        map.set(item.partner_id, {
          partner_id: item.partner_id,
          partner_name: item.partner_name,
          partner_type: item.partner_type,
          overall_status: 'aman',
          is_stale: false,
          items: [],
        })
      }
      const group = map.get(item.partner_id)!
      group.items.push(item)
      if (item.is_stale) group.is_stale = true
    }

    return Array.from(map.values()).map((group) => {
      const hasCritical = group.items.some((i) => i.status === 'kritis')
      const hasWarning = group.items.some((i) => i.status === 'waspada')
      const overall_status: StockStatus = hasCritical
        ? 'kritis'
        : hasWarning
          ? 'waspada'
          : 'aman'

      return {
        ...group,
        overall_status,
      }
    })
  }, [rows])

  const selectedGroup = useMemo(() => {
    if (!selectedPartnerId) return null
    return branchGroups.find((g) => g.partner_id === selectedPartnerId) ?? null
  }, [branchGroups, selectedPartnerId])

  return (
    <div className="dashboard-panel-enter space-y-6">
      <section
        className="dashboard-surface p-4 sm:p-5"
        aria-labelledby="central-stock-admin-title"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-md bg-ink-100 text-ink-700">
                <Store className="size-4" aria-hidden="true" />
              </span>
              <h2
                id="central-stock-admin-title"
                className="text-lg font-semibold text-ink-900"
              >
                Stok gudang pusat
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted">
              Perbarui stok siap kirim yang dilihat mitra saat memesan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {changedProducts.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={resetAllDrafts}
                  disabled={isBatchSaving}
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-white px-3 text-sm font-semibold text-muted hover:bg-paper hover:text-ink-900 disabled:opacity-40"
                >
                  Batal
                </button>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-warn-bg px-2.5 py-1 text-xs font-semibold text-warn-fg">
                  {changedProducts.length} kategori diubah
                </span>
              </>
            ) : null}

            {changedProducts.length > 0 ? (
              <button
                type="button"
                id="btn-selesai-stok-pusat"
                onClick={() => void saveCentralStock()}
                disabled={
                  changedProducts.length === 0 ||
                  isBatchSaving ||
                  hasInvalidDraft
                }
                aria-label="Selesai dan simpan semua perubahan stok pusat"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-700 disabled:opacity-40"
              >
                {isBatchSaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    <span>Menyimpan Semua...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2
                      className={`size-4 ${changedProducts.length > 0
                          ? 'text-emerald-400'
                          : 'text-white/60'
                        }`}
                      aria-hidden="true"
                    />
                    <span>Simpan perubahan ({changedProducts.length})</span>
                  </>
                )}
              </button>
            ) : null}
          </div>
        </div>

        {centralProductsQuery.isLoading ? (
          <div className="mt-4">
            <LoadingState label="Memuat stok gudang pusat..." />
          </div>
        ) : null}
        {centralProductsQuery.isError ? (
          <div className="mt-4">
            <ErrorState
              message={getErrorMessage(centralProductsQuery.error)}
              onRetry={() => void centralProductsQuery.refetch()}
            />
          </div>
        ) : null}
        {centralProductsQuery.data?.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Belum ada produk aktif"
              description="Aktifkan produk agar stok gudang pusat dapat dikelola."
            />
          </div>
        ) : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {centralProductsQuery.data?.map((prod) => {
            const draft =
              centralStockDrafts[prod.id] ?? String(prod.central_stock)
            const parsedDraft = Number(draft)
            const isValid = Number.isInteger(parsedDraft) && parsedDraft >= 0
            const hasChanged = isValid && parsedDraft !== prod.central_stock
            const delta = isValid ? parsedDraft - prod.central_stock : 0

            return (
              <div
                key={prod.id}
                className={`flex flex-col justify-between rounded-md border p-4 ${hasChanged
                    ? 'border-warn bg-warn-bg/30'
                    : 'border-line bg-white'
                  }`}
              >
                {/* Header Card: Nama Produk & Status */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-snug text-ink-900" title={prod.name}>
                      {prod.name}
                    </h3>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${prod.central_stock > 0
                          ? 'bg-ok-bg text-ok'
                          : 'bg-crit-bg text-crit-fg'
                        }`}
                    >
                      {prod.central_stock > 0 ? 'Siap Kirim' : 'Habis'}
                    </span>
                  </div>

                  {/* Real-time Stock Display */}
                  <div className="mt-3.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] font-medium text-muted">
                        Stok Sekarang:
                      </span>
                      {hasChanged ? (
                        <button
                          type="button"
                          onClick={() => resetSingleDraft(prod.id, prod.central_stock)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-warn hover:underline"
                          title="Kembalikan ke stok awal"
                        >
                          <RotateCcw className="size-3" />
                          <span>Reset</span>
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-display text-3xl font-semibold tabular-nums text-ink-900">
                        {isValid ? parsedDraft.toLocaleString('id-ID') : '—'}
                      </span>
                      <span className="text-xs font-semibold text-muted">
                        {prod.unit}
                      </span>

                      {hasChanged ? (
                        <span
                          className={`ml-auto inline-flex items-center text-xs font-bold px-1.5 py-0.5 rounded ${delta > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                            }`}
                        >
                          {delta > 0 ? `+${delta}` : delta} {prod.unit}
                        </span>
                      ) : null}
                    </div>

                    {hasChanged ? (
                      <p className="mt-1.5 text-[11px] text-muted border-t border-line/60 pt-1.5">
                        Awal: <span className="font-semibold text-ink-800">{prod.central_stock.toLocaleString('id-ID')}</span> {prod.unit}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Input & Adjuster Section */}
                <div className="mt-4 border-t border-line pt-3">
                  <label
                    htmlFor={`central-stock-${prod.id}`}
                    className="block text-sm font-semibold text-ink-700"
                  >
                    Atur Jumlah Stok:
                  </label>

                  {/* Stepper Input Row */}
                  <div className="mt-1.5 flex items-stretch gap-1">
                    <button
                      type="button"
                      disabled={isBatchSaving || parsedDraft <= 0}
                      onClick={() => adjustStock(prod.id, -1, prod.central_stock)}
                      aria-label={`Kurangi 1 ${prod.name}`}
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-line bg-white text-ink-700 hover:bg-ink-100 disabled:opacity-40"
                    >
                      <Minus className="size-3.5" />
                    </button>

                    <input
                      id={`central-stock-${prod.id}`}
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={draft}
                      disabled={isBatchSaving}
                      onChange={(event) => {
                        dirtyCentralStockIds.current.add(prod.id)
                        setCentralStockDrafts((current) => ({
                          ...current,
                          [prod.id]: event.target.value,
                        }))
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void saveCentralStock(prod.id)
                        }
                      }}
                      aria-invalid={!isValid}
                      className="min-h-11 w-full min-w-0 rounded-md border border-line bg-white px-2 text-center text-base font-semibold tabular-nums text-ink-900 disabled:opacity-50"
                    />

                    <button
                      type="button"
                      disabled={isBatchSaving}
                      onClick={() => adjustStock(prod.id, 1, prod.central_stock)}
                      aria-label={`Tambah 1 ${prod.name}`}
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-line bg-white text-ink-700 hover:bg-ink-100 disabled:opacity-40"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>

                  {!isValid ? (
                    <p className="mt-1 text-[11px] text-crit-fg" role="alert">
                      Masukkan angka bulat ≥ 0.
                    </p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

      </section>

      <section
        className="dashboard-surface overflow-hidden"
        aria-labelledby="stocks-title"
      >
        <div className="border-b border-line p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2
              id="stocks-title"
              className="text-lg font-semibold text-ink-900"
            >
              Stok cabang mitra
            </h2>
            <span className="text-xs text-muted">
              {branchGroups.length} cabang · Diperbarui otomatis
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_180px]">
            <label className="relative">
              <span className="sr-only">Cari stok</span>
              <Search
                className="absolute left-3 top-3.5 size-4 text-muted"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(event) => onSearch(event.target.value)}
                placeholder="Cari cabang atau nama produk"
                className="min-h-11 w-full rounded-sm border border-line pl-9 pr-3 text-base md:text-sm"
              />
            </label>
            <select
              aria-label="Filter cabang"
              value={partner}
              onChange={(event) => onPartner(event.target.value)}
              className="min-h-11 rounded-sm border border-line bg-white px-3"
            >
              <option value="semua">Semua cabang</option>
              {partnerNames.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <select
              aria-label="Filter status"
              value={status}
              onChange={(event) =>
                onStatus(event.target.value as typeof status)
              }
              className="min-h-11 rounded-sm border border-line bg-white px-3"
            >
              <option value="semua">Semua status</option>
              <option value="kritis">Kritis</option>
              <option value="waspada">Waspada</option>
              <option value="aman">Aman</option>
              <option value="belum_update">Belum update</option>
            </select>
          </div>
        </div>
        {query.isLoading ? (
          <div className="p-4">
            <LoadingState label="Memuat stok cabang..." />
          </div>
        ) : null}
        {query.isError ? (
          <div className="p-4">
            <ErrorState
              message={getErrorMessage(query.error)}
              onRetry={() => void query.refetch()}
            />
          </div>
        ) : null}
        {!query.isLoading && !query.isError && branchGroups.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Stok tidak ditemukan"
              description="Ubah pencarian atau filter untuk melihat data lain."
            />
          </div>
        ) : null}
        <div className="space-y-2.5 p-4">
          {branchGroups.slice(0, visibleBranches).map((group, index) => (
            <article
              key={group.partner_id}
              className="overflow-hidden rounded-md border border-line bg-white"
            >
              <button
                type="button"
                onClick={() => setSelectedPartnerId(group.partner_id)}
                aria-haspopup="dialog"
                className="group flex min-h-16 w-full items-center justify-between gap-3 p-3.5 text-left hover:bg-ink-50 sm:p-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-ink-100 font-display text-xs font-bold tabular-nums text-ink-700">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900 group-hover:text-ink-700 truncate">
                      {group.partner_name}
                    </p>
                    <p className="text-xs capitalize text-muted">
                      {group.partner_type} · {group.items.length} produk
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <StockStatusBadge status={group.overall_status} />
                    {group.is_stale ? <StaleBadge /> : null}
                  </div>
                  <span className="hidden items-center gap-1 text-xs font-medium text-muted sm:flex">
                    Detail <ChevronRight className="size-4" aria-hidden="true" />
                  </span>
                </div>
              </button>
            </article>
          ))}
          {branchGroups.length > visibleBranches ? (
            <button
              type="button"
              onClick={() => setVisibleBranches((current) => current + 24)}
              className="min-h-11 w-full rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink-700 hover:bg-ink-50"
            >
              Tampilkan 24 cabang berikutnya
            </button>
          ) : null}
        </div>
      </section>

      <PartnerStockDetailModal
        group={selectedGroup}
        open={selectedPartnerId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPartnerId(null)
        }}
      />
    </div>
  )
}

function OrderPanel({
  query,
  stocks,
  approved,
  adminNotes,
  onAdminNoteChange,
  pending,
  onApprovedChange,
  onApprove,
  onReject,
  onShip,
  selectedOrderId: controlledSelectedOrderId,
  onSelectOrder,
  activeCategory: controlledCategory,
  onActiveCategoryChange,
}: {
  query: UseQueryResult<Order[]>
  stocks?: StockItem[]
  approved: Partial<Record<string, Partial<Record<string, number>>>>
  adminNotes: Partial<Record<string, string>>
  onAdminNoteChange: (orderId: string, note: string) => void
  pending: boolean
  onApprovedChange: (orderId: string, productId: string, qty: number) => void
  onApprove: (order: Order) => Promise<unknown>
  onReject: (id: string, reason: string) => Promise<unknown>
  onShip: (id: string) => Promise<unknown>
  selectedOrderId?: string | null
  onSelectOrder?: (orderId: string | null) => void
  activeCategory?: OrderCategoryTab
  onActiveCategoryChange?: (category: OrderCategoryTab) => void
}) {
  const [internalCategory, setInternalCategory] =
    useState<OrderCategoryTab>('menunggu')
  const [internalSelectedOrderId, setInternalSelectedOrderId] =
    useState<string | null>(null)
  const [visibleOrders, setVisibleOrders] = useState(30)

  const activeCategory = controlledCategory ?? internalCategory
  const setActiveCategory = onActiveCategoryChange ?? setInternalCategory
  useEffect(() => {
    setVisibleOrders(30)
  }, [activeCategory])
  const selectedOrderId =
    controlledSelectedOrderId !== undefined
      ? controlledSelectedOrderId
      : internalSelectedOrderId
  const setSelectedOrderId = onSelectOrder ?? setInternalSelectedOrderId

  const orderTriggerRefs = useRef<
    Partial<Record<string, HTMLElement | null>>
  >({})

  const allOrders = query.data ?? []

  const pendingCount = useMemo(
    () => allOrders.filter((order) => order.status === 'diproses').length,
    [allOrders],
  )
  const completedCount = useMemo(
    () =>
      allOrders.filter((order) =>
        ['disetujui', 'dalam_pengiriman', 'selesai'].includes(order.status),
      ).length,
    [allOrders],
  )
  const rejectedCount = useMemo(
    () =>
      allOrders.filter((order) =>
        ['ditolak', 'dibatalkan'].includes(order.status),
      ).length,
    [allOrders],
  )

  const filteredOrders = useMemo(() => {
    if (activeCategory === 'menunggu') {
      return allOrders.filter((order) => order.status === 'diproses')
    }
    if (activeCategory === 'selesai') {
      return allOrders.filter((order) =>
        ['disetujui', 'dalam_pengiriman', 'selesai'].includes(order.status),
      )
    }
    return allOrders.filter((order) =>
      ['ditolak', 'dibatalkan'].includes(order.status),
    )
  }, [activeCategory, allOrders])
  const selectedOrder = allOrders.find((order) => order.id === selectedOrderId)

  return (
    <section aria-labelledby="orders-title" className="dashboard-panel-enter space-y-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="dashboard-eyebrow">Pesanan mitra</p>
          <h1 id="orders-title" className="mt-1 text-2xl font-semibold text-ink-900 sm:text-3xl">
            Approval dan pengiriman
          </h1>
        </div>
      </div>

      <nav
        className="flex max-w-full items-center gap-1 overflow-x-auto border-b border-line pb-1"
        aria-label="Kategori status pesanan"
      >
        <button
          type="button"
          onClick={() => setActiveCategory('menunggu')}
          className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${activeCategory === 'menunggu'
              ? 'bg-ink-900 text-white'
              : 'text-muted hover:bg-ink-50 hover:text-ink-900'
            }`}
        >
          <Clock className="size-4" aria-hidden="true" />
          <span>Menunggu Persetujuan</span>
          {pendingCount > 0 ? (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${activeCategory === 'menunggu'
                  ? 'bg-ume text-white'
                  : 'bg-warn-bg text-warn'
                }`}
            >
              {pendingCount}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('selesai')}
          className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${activeCategory === 'selesai'
              ? 'bg-ink-900 text-white'
              : 'text-muted hover:bg-ink-50 hover:text-ink-900'
            }`}
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          <span>Setelah persetujuan</span>
          {completedCount > 0 ? (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${activeCategory === 'selesai'
                  ? 'bg-ok text-white'
                  : 'bg-ok-bg text-ok'
                }`}
            >
              {completedCount}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('ditolak')}
          className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${activeCategory === 'ditolak'
              ? 'bg-ink-900 text-white'
              : 'text-muted hover:bg-ink-50 hover:text-ink-900'
            }`}
        >
          <XCircle className="size-4" aria-hidden="true" />
          <span>Ditolak</span>
          {rejectedCount > 0 ? (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${activeCategory === 'ditolak'
                  ? 'bg-crit text-white'
                  : 'bg-crit-bg text-crit'
                }`}
            >
              {rejectedCount}
            </span>
          ) : null}
        </button>

      </nav>

      {query.isLoading ? <LoadingState label="Memuat pesanan..." /> : null}
      {query.isError ? (
        <div className="mt-4">
          <ErrorState
            message={getErrorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        </div>
      ) : null}
      {!query.isLoading && !query.isError && filteredOrders.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title={
              activeCategory === 'menunggu'
                ? 'Tidak ada pesanan menunggu persetujuan'
                : activeCategory === 'selesai'
                  ? 'Belum ada pesanan disetujui atau selesai'
                  : 'Tidak ada pesanan yang ditolak'
            }
            description={
              activeCategory === 'menunggu'
                ? 'Semua permintaan restock dari mitra cabang telah diproses.'
                : 'Ubah kategori tab di atas untuk memeriksa daftar pesanan lainnya.'
            }
          />
        </div>
      ) : null}
      <div className="space-y-2.5">
        {filteredOrders.slice(0, visibleOrders).map((order, index) => {
          const totalRequested = order.items.reduce(
            (sum, item) => sum + item.qty_requested,
            0,
          )
          const totalApproved = order.items.reduce(
            (sum, item) => sum + (item.qty_approved ?? item.qty_requested),
            0,
          )
          const partnerTypeLabel =
            order.partner_type === 'kafe'
              ? 'Kafe'
              : order.partner_type === 'hotel'
                ? 'Hotel'
                : order.partner_type === 'restoran'
                  ? 'Restoran'
                  : order.partner_type === 'minimarket'
                    ? 'Minimarket'
                    : order.partner_type

          return (
            <button
              key={order.id}
              ref={(element) => {
                orderTriggerRefs.current[order.id] = element
              }}
              type="button"
              onClick={() => setSelectedOrderId(order.id)}
              className="group flex w-full flex-col justify-between gap-2.5 rounded-lg border border-line bg-white p-3.5 shadow-2xs transition-all hover:border-ink-400 hover:shadow-xs cursor-pointer text-left sm:p-4 focus-visible:outline-2 focus-visible:outline-ink-700"
            >
              {/* Baris 1: Nomor Urut, Nama Mitra, Tipe, No PO, Status & Tanggal */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 pb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded bg-ink-100 font-display text-xs font-bold tabular-nums text-ink-700">
                    {index + 1}
                  </span>
                  <h3 className="truncate font-display text-sm sm:text-base font-bold text-ink-900 group-hover:text-ink-700">
                    {order.partner_name}
                  </h3>
                  {partnerTypeLabel ? (
                    <span className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted border border-line">
                      {partnerTypeLabel}
                    </span>
                  ) : null}
                  <span className="font-mono text-xs text-muted">
                    {order.order_no}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <OrderStatusBadge status={order.status} />
                  {order.status === 'selesai' && !order.receipt_photo_present ? (
                    <span className="rounded bg-warn-bg px-1.5 py-0.5 text-[10px] font-semibold text-warn-fg">
                      {order.receipt_proof_requested_at ? 'Bukti diminta' : 'Tanpa foto'}
                    </span>
                  ) : null}
                  <span className="hidden text-xs text-muted sm:inline">
                    {formatDetailedDateTime(order.created_at)}
                  </span>
                </div>
              </div>

              {/* Baris 2: Rincian Produk Singkat, Catatan Inline & Kuantitas */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                {/* Rincian Produk & Catatan Mitra */}
                <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                  <span className="font-medium text-ink-700 shrink-0">
                    {order.items.length} Macam:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {order.items.map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-1 rounded bg-paper px-2 py-0.5 text-[11px] font-medium text-ink-800 border border-line/70"
                      >
                        <span>{item.product_name}</span>
                        <strong className="font-bold tabular-nums text-ink-900">
                          ({item.qty_requested})
                        </strong>
                      </span>
                    ))}
                  </div>

                  {order.note ? (
                    <span className="inline-flex items-center gap-1 rounded bg-ink-50/80 px-2 py-0.5 text-[11px] text-ink-700 border border-line/50">
                      <MessageSquare className="size-3 text-muted shrink-0" aria-hidden="true" />
                      <span className="italic truncate max-w-[200px] sm:max-w-xs">"{order.note}"</span>
                    </span>
                  ) : null}
                </div>

                {/* Ringkasan Jumlah Diminta/Disetujui & Tanda Detail */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-baseline gap-2 tabular-nums">
                    <span className="text-muted">
                      Diminta: <strong className="font-bold text-ink-900">{totalRequested}</strong> pcs
                    </span>
                    {order.status !== 'diproses' && order.status !== 'ditolak' && order.status !== 'dibatalkan' ? (
                      <span className="text-muted">
                        · Disetujui: <strong className="font-bold text-ok-fg">{totalApproved}</strong> pcs
                      </span>
                    ) : null}
                  </div>

                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-ink-700 group-hover:text-ink-900 group-hover:translate-x-0.5 transition-all">
                    <span className="hidden sm:inline">Detail</span>
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </span>
                </div>
              </div>
            </button>
          )
        })}
        {filteredOrders.length > visibleOrders ? (
          <button
            type="button"
            onClick={() => setVisibleOrders((current) => current + 30)}
            className="min-h-11 w-full rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink-700 hover:bg-ink-50 shadow-2xs"
          >
            Tampilkan 30 pesanan berikutnya
          </button>
        ) : null}
      </div>

      <ApprovalDialog
        order={selectedOrder ?? null}
        open={selectedOrderId !== null}
        stocks={stocks}
        approved={approved}
        adminNotes={adminNotes}
        pending={pending}
        onOpenChange={(open) => {
          if (!open) {
            const trigger = selectedOrderId
              ? orderTriggerRefs.current[selectedOrderId]
              : null
            setSelectedOrderId(null)
            window.requestAnimationFrame(() => trigger?.focus())
          }
        }}
        onApprovedChange={onApprovedChange}
        onAdminNoteChange={onAdminNoteChange}
        onApprove={onApprove}
        onReject={onReject}
        onShip={onShip}
      />
    </section>
  )
}

function ApprovalDialog({
  order,
  open,
  stocks,
  approved,
  adminNotes,
  pending,
  onOpenChange,
  onApprovedChange,
  onAdminNoteChange,
  onApprove,
  onReject,
  onShip,
}: {
  order: Order | null
  open: boolean
  stocks?: StockItem[]
  approved: Partial<Record<string, Partial<Record<string, number>>>>
  adminNotes: Partial<Record<string, string>>
  pending: boolean
  onOpenChange: (open: boolean) => void
  onApprovedChange: (orderId: string, productId: string, qty: number) => void
  onAdminNoteChange: (orderId: string, note: string) => void
  onApprove: (order: Order) => Promise<unknown>
  onReject: (id: string, reason: string) => Promise<unknown>
  onShip: (id: string) => Promise<unknown>
}) {
  const [rejectionMode, setRejectionMode] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionError, setActionError] = useState('')
  const queryClient = useQueryClient()
  const receiptProof = useQuery<{ photo_data_url: string | null }>({
    queryKey: ['admin-receipt-proof', order?.id],
    queryFn: async () => {
      const response = await api.orders({ id: order!.id })['receipt-proof'].get()
      return unwrapData<{ photo_data_url: string | null }>(response, 'Foto bukti belum dapat dimuat')
    },
    enabled: open && Boolean(order?.receipt_photo_present),
    staleTime: 60_000,
  })
  const requestReceiptProof = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await api.orders({ id: orderId })['request-receipt-proof'].patch()
      if (response.error) throw apiError(response.error, 'Permintaan bukti belum terkirim')
    },
    onSuccess: async () => {
      toast.success('Permintaan foto bukti dikirim ke mitra')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
      ])
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  })

  useEffect(() => {
    setRejectionMode(false)
    setRejectionReason('')
    setActionError('')
  }, [order?.id])

  if (!order) return null

  const editable = order.status === 'diproses' || order.status === 'disetujui'
  const values = order.items.map((item) => {
    const matchingStock = stocks?.find(
      (s) => s.partner_id === order.partner_id && s.product_id === item.product_id,
    )
    const currentQty = item.partner_current_stock ?? matchingStock?.current_qty ?? 0
    const parLevel = item.partner_par_level ?? matchingStock?.par_level ?? 40
    const stockPercentage =
      parLevel > 0 ? Math.round((currentQty / parLevel) * 100) : 0
    const stockStatus: StockStatus =
      matchingStock?.status ?? getStockStatus(currentQty, parLevel)

    const qty =
      approved[order.id]?.[item.product_id] ??
      item.qty_approved ??
      item.qty_requested
    const max = Math.min(item.qty_requested, item.central_stock)

    const projectedQty = currentQty + qty
    const projectedPercent =
      parLevel > 0 ? Math.round((projectedQty / parLevel) * 100) : 0
    const projectedStatus = getStockStatus(projectedQty, parLevel)

    return {
      item,
      qty,
      max,
      currentQty,
      parLevel,
      stockPercentage,
      stockStatus,
      projectedQty,
      projectedPercent,
      projectedStatus,
    }
  })

  const totalRequested = order.items.reduce(
    (total, item) => total + item.qty_requested,
    0,
  )
  const totalApproved = values.reduce((total, entry) => total + entry.qty, 0)
  const hasInvalidQuantity = values.some(
    ({ qty, max }) => !Number.isInteger(qty) || qty < 0 || qty > max,
  )
  const hasAdjustment = values.some(
    ({ item, qty }) => qty !== item.qty_requested,
  )
  const currentNote = adminNotes[order.id] ?? order.admin_note ?? ''
  const noteRequired = hasAdjustment && !currentNote.trim()
  const hasChanges =
    values.some(
      ({ item, qty }) => qty !== (item.qty_approved ?? item.qty_requested),
    ) || currentNote !== (order.admin_note ?? '')
  const approvalDisabled =
    pending || hasInvalidQuantity || totalApproved < 1 || noteRequired

  const partnerTypeLabel =
    order.partner_type === 'kafe'
      ? 'Kafe'
      : order.partner_type === 'hotel'
        ? 'Hotel'
        : order.partner_type === 'restoran'
          ? 'Restoran'
          : order.partner_type === 'minimarket'
            ? 'Minimarket'
            : order.partner_type

  const quickNoteTemplates = [
    'Stok gudang pusat dialokasikan sebagian',
    'Penyesuaian kuota kapasitas rak cabang',
    'Pengiriman batch berikutnya dalam 3 hari',
  ]

  const runAction = async (action: () => Promise<unknown>, close = true) => {
    setActionError('')
    try {
      await action()
      if (close) onOpenChange(false)
    } catch (error) {
      setActionError(getErrorMessage(error))
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/45 backdrop-blur-xs" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-1.5rem)] max-w-4xl xl:max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-white shadow-2xl focus:outline-none">
          {/* Header Dialog */}
          <div className="sticky top-0 z-10 border-b border-line bg-white/95 px-5 py-4 backdrop-blur-md sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Dialog.Title className="font-display text-xl font-bold text-ink-900 sm:text-2xl">
                    {order.partner_name}
                  </Dialog.Title>
                  {partnerTypeLabel ? (
                    <span className="inline-flex items-center rounded-full bg-ink-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-ink-700">
                      {partnerTypeLabel}
                    </span>
                  ) : null}
                </div>
                <Dialog.Description className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted sm:text-sm">
                  <span className="font-semibold text-ink-700">{order.order_no}</span>
                  <span>•</span>
                  <span>
                    Diajukan{' '}
                    {new Date(order.created_at).toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                  <span>•</span>
                  <span className="font-medium text-ink-800">
                    {order.items.length} Jenis Produk
                  </span>
                </Dialog.Description>
              </div>

              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Tutup detail permintaan"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>

            {/* Sub-bar Status & Ringkasan Alokasi */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <OrderStatusBadge status={order.status} />
                {order.status === 'dalam_pengiriman' ? (
                  <span className="text-xs font-semibold text-order-pengiriman">
                    Barang sedang dalam perjalanan ekspedisi ke cabang
                  </span>
                ) : null}
                {order.status === 'selesai' ? (
                  <span className="text-xs font-semibold text-ok-fg">
                    Pesanan selesai · Barang telah diterima mitra & stok cabang bertambah
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-3 text-xs sm:text-sm">
                <span className="text-muted">
                  Total Diminta:{' '}
                  <strong className="font-bold tabular-nums text-ink-900">
                    {totalRequested} pcs
                  </strong>
                </span>
                {editable ? (
                  <span className="text-muted">
                    Total Disetujui:{' '}
                    <strong
                      className={`font-bold tabular-nums ${totalApproved > 0 ? 'text-ok-fg' : 'text-crit'
                        }`}
                    >
                      {totalApproved} pcs
                    </strong>
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            {/* Banner Informasi Pengiriman */}
            {order.status === 'dalam_pengiriman' ? (
              <div className="rounded-lg border border-order-pengiriman-bg bg-order-pengiriman-bg/40 p-3.5 text-sm text-ink-900">
                <p className="font-semibold text-order-pengiriman">
                  🚚 Dalam Pengiriman
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Barang kiriman sedang dalam perjalanan. Menunggu konfirmasi penerimaan fisik dari PIC cabang mitra.
                </p>
              </div>
            ) : null}

            {order.status === 'selesai' ? (
              <section className={`rounded-lg border p-4 ${order.receipt_photo_present ? 'border-line bg-paper/40' : 'border-warn bg-warn-bg/30'}`} aria-label="Bukti penerimaan barang">
                <h3 className="text-sm font-semibold text-ink-900">Bukti penerimaan barang</h3>
                {order.receipt_photo_present ? (
                  <div className="mt-3">
                    {receiptProof.isLoading ? <LoadingState label="Memuat foto bukti..." /> : null}
                    {receiptProof.isError ? (
                      <ErrorState message={getErrorMessage(receiptProof.error)} onRetry={() => void receiptProof.refetch()} />
                    ) : null}
                    {receiptProof.data?.photo_data_url ? (
                      <img src={resolveImageUrl(receiptProof.data.photo_data_url) ?? ''} alt={`Foto bukti penerimaan pesanan ${order.order_no}`} className="max-h-96 w-full rounded-md border border-line bg-white object-contain" />
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2">
                    <p className="text-sm text-warn-fg">Barang ditandai diterima, tetapi Mitra belum mengunggah foto bukti.</p>
                    {order.receipt_proof_requested_at ? (
                      <p className="mt-2 text-xs font-semibold text-warn-fg">Permintaan foto bukti sudah dikirim ke Mitra.</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => requestReceiptProof.mutate(order.id)}
                        disabled={requestReceiptProof.isPending}
                        className="mt-3 inline-flex min-h-11 items-center rounded-md bg-ink-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {requestReceiptProof.isPending ? 'Mengirim permintaan...' : 'Minta foto bukti ke Mitra'}
                      </button>
                    )}
                  </div>
                )}
              </section>
            ) : null}

            {/* Catatan dari Mitra */}
            {order.note ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-line bg-paper/60 px-3.5 py-2.5 text-xs text-ink-900">
                <MessageSquare className="size-4 shrink-0 text-muted mt-0.5" aria-hidden="true" />
                <div>
                  <span className="font-semibold text-ink-900">Catatan dari Mitra:</span>{' '}
                  <span className="italic text-ink-700">"{order.note}"</span>
                </div>
              </div>
            ) : null}

            {/* Daftar Produk Permintaan Restock */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-ink-900">
                  Rincian Permintaan Restock ({order.items.length} Produk)
                </h3>
                <span className="text-xs text-muted">
                  Bandingkan stok cabang & gudang pusat untuk persetujuan alokasi
                </span>
              </div>

              <div className="space-y-3">
                {values.map(
                  (
                    {
                      item,
                      qty,
                      max,
                      currentQty,
                      parLevel,
                      stockPercentage,
                      stockStatus,
                      projectedQty,
                      projectedPercent,
                      projectedStatus,
                    },
                    index,
                  ) => {
                    const invalid =
                      !Number.isInteger(qty) || qty < 0 || qty > max
                    const isFull = qty === item.qty_requested
                    const isPartial = qty > 0 && qty < item.qty_requested
                    const isZero = qty === 0

                    return (
                      <div
                        key={item.id}
                        className="overflow-hidden rounded-lg border border-line bg-white shadow-2xs transition hover:border-ink-300"
                      >
                        {/* Header Item: Nomor, Nama Produk, Satuan & Status Kondisi Cabang */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper/60 px-3.5 py-2.5 sm:px-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded bg-ink-100 font-display text-xs font-bold tabular-nums text-ink-700">
                              {index + 1}
                            </span>
                            <h4 className="truncate font-display text-sm sm:text-base font-bold text-ink-900">
                              {item.product_name}
                            </h4>
                            <span className="rounded bg-line/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">
                              {item.product_unit}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted">Kondisi Cabang:</span>
                            <StockStatusBadge status={stockStatus} />
                          </div>
                        </div>

                        {/* 4 Kolom Perbandingan: Sisa Cabang | Stok Pusat | Diminta Mitra | Persetujuan Admin */}
                        <div className="grid grid-cols-2 gap-2.5 p-3.5 sm:gap-3 sm:p-4 lg:grid-cols-4 items-stretch">
                          {/* 1. Sisa di Cabang Mitra */}
                          <div className="rounded-lg border border-line/70 bg-paper/40 p-3">
                            <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
                              Sisa di Mitra
                            </span>
                            <div className="mt-1 flex items-baseline gap-1">
                              <span className="font-display text-xl font-bold tabular-nums text-ink-900">
                                {currentQty}
                              </span>
                              <span className="text-xs text-muted">
                                / {parLevel} {item.product_unit}
                              </span>
                              <span className="ml-auto text-xs font-semibold tabular-nums text-muted">
                                ({stockPercentage}%)
                              </span>
                            </div>
                            {/* Visual Bar Kapasitas Rak */}
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line/80">
                              <div
                                className={`h-full transition-all ${
                                  stockStatus === 'kritis'
                                    ? 'bg-crit'
                                    : stockStatus === 'waspada'
                                      ? 'bg-warn'
                                      : 'bg-ok'
                                }`}
                                style={{
                                  width: `${Math.min(100, Math.max(5, stockPercentage))}%`,
                                }}
                              />
                            </div>
                          </div>

                          {/* 2. Stok Gudang Pusat */}
                          <div className="rounded-lg border border-line/70 bg-paper/40 p-3">
                            <div className="flex items-center justify-between">
                              <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
                                Stok Pusat
                              </span>
                              <span
                                className={`text-[10px] font-bold ${
                                  item.central_stock >= item.qty_requested
                                    ? 'text-ok-fg'
                                    : 'text-crit'
                                }`}
                              >
                                {item.central_stock >= item.qty_requested
                                  ? '✓ Cukup'
                                  : '⚠️ Terbatas'}
                              </span>
                            </div>
                            <div className="mt-1 flex items-baseline gap-1">
                              <span className="font-display text-xl font-bold tabular-nums text-ink-900">
                                {item.central_stock.toLocaleString('id-ID')}
                              </span>
                              <span className="text-xs text-muted">{item.product_unit}</span>
                            </div>
                            <p className="mt-1 truncate text-[11px] text-muted">
                              {item.central_stock >= item.qty_requested
                                ? 'Tersedia di gudang'
                                : `Hanya ada ${item.central_stock} ${item.product_unit}`}
                            </p>
                          </div>

                          {/* 3. Permintaan Mitra */}
                          <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-3">
                            <div className="flex items-center justify-between">
                              <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-800">
                                Diminta Mitra
                              </span>
                              <span className="rounded bg-ink-700/10 px-1 py-0.2 text-[9px] font-bold text-ink-700">
                                PO
                              </span>
                            </div>
                            <div className="mt-1 flex items-baseline gap-1">
                              <span className="font-display text-xl font-bold tabular-nums text-ink-900">
                                +{item.qty_requested}
                              </span>
                              <span className="text-xs font-semibold text-ink-700">
                                {item.product_unit}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-[11px] text-muted">
                              Jumlah diajukan cabang
                            </p>
                          </div>

                          {/* 4. Persetujuan Admin */}
                          <div className="col-span-2 lg:col-span-1 flex flex-col justify-between rounded-lg border border-line bg-white p-3 shadow-2xs">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-900">
                                Disetujui Admin
                              </span>
                              {editable ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onApprovedChange(order.id, item.product_id, max)
                                    }
                                    title={`Setujui penuh (${max} ${item.product_unit})`}
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase transition-colors ${
                                      isFull
                                        ? 'bg-ink-900 text-white'
                                        : 'border border-line bg-paper text-ink-700 hover:bg-ink-100'
                                    }`}
                                  >
                                    Penuh
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onApprovedChange(order.id, item.product_id, 0)
                                    }
                                    title="Tolak item ini (0)"
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase transition-colors ${
                                      isZero
                                        ? 'bg-crit text-white'
                                        : 'border border-line bg-paper text-crit hover:bg-crit-bg/20'
                                    }`}
                                  >
                                    0
                                  </button>
                                </div>
                              ) : null}
                            </div>

                            {editable ? (
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center gap-2">
                                  {/* Stepper Input */}
                                  <div className="inline-flex shrink-0 items-center rounded-md border border-line bg-white shadow-2xs">
                                    <button
                                      type="button"
                                      aria-label="Kurangi kuantitas"
                                      disabled={qty <= 0}
                                      onClick={() =>
                                        onApprovedChange(
                                          order.id,
                                          item.product_id,
                                          Math.max(0, qty - 1),
                                        )
                                      }
                                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-l-md text-ink-700 hover:bg-ink-100 disabled:opacity-30"
                                    >
                                      <Minus className="size-3.5" />
                                    </button>
                                    <input
                                      id={`approval-${order.id}-${item.product_id}`}
                                      type="number"
                                      min={0}
                                      max={max}
                                      step={1}
                                      value={qty}
                                      aria-invalid={invalid}
                                      onChange={(event) =>
                                        onApprovedChange(
                                          order.id,
                                          item.product_id,
                                          Number.parseInt(event.target.value, 10) || 0,
                                        )
                                      }
                                      className="h-8 w-14 shrink-0 border-x border-line bg-white px-1 text-center font-display text-sm font-bold tabular-nums text-ink-900 focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      aria-label="Tambah kuantitas"
                                      disabled={qty >= max}
                                      onClick={() =>
                                        onApprovedChange(
                                          order.id,
                                          item.product_id,
                                          Math.min(max, qty + 1),
                                        )
                                      }
                                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-r-md text-ink-700 hover:bg-ink-100 disabled:opacity-30"
                                    >
                                      <Plus className="size-3.5" />
                                    </button>
                                  </div>

                                  <span className="text-xs font-semibold text-muted">
                                    {item.product_unit}
                                  </span>
                                </div>

                                {invalid ? (
                                  <p className="text-[10px] font-bold text-crit" role="alert">
                                    0 - {max} {item.product_unit}
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <div className="mt-1 flex items-baseline gap-1">
                                <span className="font-display text-xl font-bold tabular-nums text-ink-900">
                                  {item.qty_approved ?? 0}
                                </span>
                                <span className="text-xs text-muted">{item.product_unit}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Baris 3: Status Alokasi & Proyeksi Dampak Setelah Barang Tiba (Clean Micro-Footer) */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 bg-paper/40 px-3.5 py-2 sm:px-4 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-muted">Status Alokasi:</span>
                            {isFull ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-ok-fg">
                                <CheckCircle2 className="size-3.5 text-ok" /> Disetujui Penuh ({qty} {item.product_unit})
                              </span>
                            ) : isPartial ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-warn-fg">
                                <AlertTriangle className="size-3.5 text-warn" /> Disetujui Sebagian ({qty}/{item.qty_requested} {item.product_unit})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-crit-fg">
                                <XCircle className="size-3.5 text-crit" /> Ditolak (0 {item.product_unit})
                              </span>
                            )}
                          </div>

                          <div className="text-muted">
                            Estimasi sisa rak setelah tiba:{' '}
                            <strong className="font-bold tabular-nums text-ink-900">
                              {projectedQty} / {parLevel} {item.product_unit}
                            </strong>{' '}
                            ({projectedPercent}% ·{' '}
                            <span
                              className={`font-semibold ${
                                projectedStatus === 'kritis'
                                  ? 'text-crit'
                                  : projectedStatus === 'waspada'
                                    ? 'text-warn-fg'
                                    : 'text-ok-fg'
                              }`}
                            >
                              {projectedStatus === 'aman'
                                ? 'Aman'
                                : projectedStatus === 'waspada'
                                  ? 'Waspada'
                                  : 'Kritis'}
                            </span>)
                          </div>
                        </div>
                      </div>
                    )
                  },
                )}
              </div>
            </div>

            {/* Input Catatan Admin & Template Cepat */}
            {editable ? (
              <div className="rounded-xl border border-line bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor={`approval-note-${order.id}`}
                    className="text-sm font-bold text-ink-900"
                  >
                    Catatan Admin{' '}
                    {hasAdjustment ? (
                      <span className="text-crit">(Wajib Diisi Karena Kuantitas Disesuaikan)</span>
                    ) : (
                      <span className="font-normal text-muted">(Opsional)</span>
                    )}
                  </label>
                  {hasAdjustment ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-warn-bg px-2 py-0.5 text-xs font-bold text-warn-fg">
                      <AlertTriangle className="size-3" /> Ada penyesuaian kuantitas
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted">
                  Jelaskan alasan penyesuaian jika kuantitas barang yang disetujui berbeda dari permintaan mitra agar PIC cabang memahaminya.
                </p>

                {/* Template Cepat */}
                {hasAdjustment ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-muted">
                      Template cepat:
                    </span>
                    {quickNoteTemplates.map((template) => (
                      <button
                        key={template}
                        type="button"
                        onClick={() => onAdminNoteChange(order.id, template)}
                        className="rounded-md border border-line bg-ink-50 px-2 py-1 text-xs font-medium text-ink-800 transition-colors hover:border-ink-700 hover:bg-white"
                      >
                        {template}
                      </button>
                    ))}
                  </div>
                ) : null}

                <textarea
                  id={`approval-note-${order.id}`}
                  rows={3}
                  maxLength={1000}
                  value={currentNote}
                  aria-invalid={noteRequired}
                  onChange={(event) =>
                    onAdminNoteChange(order.id, event.target.value)
                  }
                  className={`mt-2.5 w-full rounded-lg border p-3 text-sm text-ink-900 focus:outline-none focus:ring-1 ${noteRequired
                      ? 'border-crit focus:border-crit focus:ring-crit'
                      : 'border-line focus:border-ink-700 focus:ring-ink-700'
                    }`}
                  placeholder="Contoh: Stok gudang pusat dialokasikan sebagian, sisa akan dikirim batch berikutnya..."
                />
                {noteRequired ? (
                  <p
                    className="mt-1.5 text-xs font-bold text-crit"
                    role="alert"
                  >
                    Catatan admin wajib diisi karena terdapat penyesuaian kuantitas dari permintaan mitra.
                  </p>
                ) : null}
              </div>
            ) : order.admin_note ? (
              <div className="rounded-xl border border-line bg-ink-50 p-4 text-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  Catatan Admin
                </p>
                <p className="mt-1.5 font-medium text-ink-900">{order.admin_note}</p>
              </div>
            ) : null}

            {order.status === 'ditolak' && order.rejected_reason ? (
              <div className="rounded-xl border border-crit/30 bg-crit-bg/30 p-4 text-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-crit">
                  Alasan Penolakan
                </p>
                <p className="mt-1.5 font-medium text-ink-900">{order.rejected_reason}</p>
              </div>
            ) : null}

            {rejectionMode && order.status === 'diproses' ? (
              <div className="rounded-xl border border-crit/40 bg-crit-bg/10 p-4 sm:p-5">
                <label
                  htmlFor={`rejection-reason-${order.id}`}
                  className="text-sm font-bold text-ink-900"
                >
                  Alasan Penolakan Permintaan Restock
                </label>
                <textarea
                  id={`rejection-reason-${order.id}`}
                  rows={3}
                  maxLength={1000}
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  className="mt-2 w-full rounded-md border border-line p-3 text-sm text-ink-900 focus:border-crit focus:outline-none focus:ring-1 focus:ring-crit"
                  placeholder="Tuliskan alasan yang akan dibaca mitra"
                />
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setRejectionMode(false)}
                    className="min-h-11 rounded-md border border-line px-4 text-sm font-semibold text-ink-800"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={pending || !rejectionReason.trim()}
                    onClick={() =>
                      void runAction(() =>
                        onReject(order.id, rejectionReason.trim()),
                      )
                    }
                    className="min-h-11 rounded-md border border-crit px-4 text-sm font-semibold text-crit disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Konfirmasi penolakan
                  </button>
                </div>
              </div>
            ) : null}

            {totalApproved < 1 && editable ? (
              <p className="text-sm font-medium text-crit" role="alert">
                Minimal satu barang harus disetujui.
              </p>
            ) : null}
            {actionError ? (
              <p
                className="rounded-md border border-crit/30 bg-crit-bg/30 p-3 text-sm text-crit-fg"
                role="alert"
              >
                {actionError}
              </p>
            ) : null}
          </div>

          <div className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-white p-4 sm:flex-row sm:justify-end sm:p-5">
            {order.status === 'diproses' && !rejectionMode ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => setRejectionMode(true)}
                className="min-h-11 rounded-md border border-crit/50 px-4 text-sm font-semibold text-crit disabled:opacity-50"
              >
                Tolak permintaan
              </button>
            ) : null}
            {order.status === 'diproses' && !rejectionMode ? (
              <button
                type="button"
                disabled={approvalDisabled}
                onClick={() => void runAction(() => onApprove(order))}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Setujui jumlah
              </button>
            ) : null}
            {order.status === 'disetujui' ? (
              <>
                {hasChanges ? (
                  <button
                    type="button"
                    disabled={approvalDisabled}
                    onClick={() =>
                      void runAction(() => onApprove(order), false)
                    }
                    className="min-h-11 rounded-md bg-ink-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Simpan revisi
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={pending || hasChanges}
                  onClick={() => void runAction(() => onShip(order.id))}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-order-pengiriman px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Truck className="size-4" aria-hidden="true" />
                  Mulai kirim
                </button>
              </>
            ) : null}
            {!editable ? (
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="min-h-11 rounded-md border border-line px-4 text-sm font-semibold text-ink-900"
                >
                  Tutup
                </button>
              </Dialog.Close>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

interface ParsedAlertInfo {
  title: string
  body: string
  partnerName: string
  productName?: string
  type: 'new_order' | 'order_received' | 'low_stock' | 'receipt_missing_proof' | 'receipt_proof_uploaded' | 'other'
  typeLabel: string
  typeBadgeColor: string
  relatedOrderId: string | null
  matchedOrder: Order | null
}

function formatSelectedDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const [year, month, day] = dateStr.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d)
  } catch {
    return dateStr
  }
}

interface AlertOrderLookup {
  byNumber: Map<string, Order>
  byPartner: Map<string, Order>
}

function parseAndFormatAlert(
  item: NotificationItem,
  orderLookup: AlertOrderLookup,
): ParsedAlertInfo {
  const rawTitle = item.title || ''
  const rawBody = item.body || ''
  const partnerName = item.partner_name || 'Mitra'

  // Extract any PO code from title or body (e.g. PO-261019-1521E500)
  const poMatch = `${rawTitle} ${rawBody}`.match(/PO-[A-Za-z0-9-]+/i)
  const poCode = poMatch ? poMatch[0].toUpperCase() : null

  let matchedOrder: Order | null = null
  if (poCode) {
    matchedOrder = orderLookup.byNumber.get(poCode) ?? null
  }
  if (!matchedOrder && item.partner_id) {
    matchedOrder = orderLookup.byPartner.get(item.partner_id) ?? null
  }

  if (item.type === 'receipt_missing_proof' || item.type === 'receipt_proof_uploaded') {
    const missing = item.type === 'receipt_missing_proof'
    return {
      title: missing ? `Foto bukti ${poCode ?? 'penerimaan'} belum ada` : `Foto bukti ${poCode ?? 'penerimaan'} telah diunggah`,
      body: rawBody,
      partnerName,
      type: item.type,
      typeLabel: missing ? 'Bukti belum ada' : 'Bukti diterima',
      typeBadgeColor: missing ? 'bg-warn-bg text-warn-fg border-warn/30' : 'bg-ok-bg text-ok-fg border-ok/30',
      relatedOrderId: matchedOrder?.id ?? null,
      matchedOrder,
    }
  }

  const isNewOrder =
    item.type === 'new_order' ||
    rawTitle.toLowerCase().includes('pesanan restock') ||
    rawBody.toLowerCase().includes('mengajukan restock')

  const isOrderReceived =
    rawTitle.toLowerCase().includes('barang diterima') ||
    rawBody.toLowerCase().includes('penerimaan barang') ||
    rawBody.toLowerCase().includes('mengonfirmasi penerimaan')

  const isLowStock =
    item.type === 'low_stock' ||
    rawTitle.toLowerCase().includes('stok kritis') ||
    rawBody.toLowerCase().includes('stok kritis')

  if (isNewOrder) {
    let cleanBody = rawBody
      .replace(/:\s*PO-[A-Za-z0-9-]+/gi, '')
      .replace(/PO-[A-Za-z0-9-]+/gi, '')
      .trim()

    if (matchedOrder && matchedOrder.items.length > 0) {
      const itemSummaries = matchedOrder.items
        .map(
          (i) =>
            `${i.product_name} (${i.qty_requested} ${i.product_unit || 'pcs'})`,
        )
        .join(', ')
      cleanBody = `Mitra mengajukan restock untuk ${matchedOrder.items.length} jenis item: ${itemSummaries}. Pesanan sedang menunggu persetujuan admin pusat.`
    } else if (!cleanBody) {
      cleanBody = `Mitra ${partnerName} mengajukan permohonan restock barang untuk cabang. Pesanan menunggu persetujuan pusat.`
    }

    return {
      title: `Mitra ${partnerName} mau restok barang nih`,
      body: cleanBody,
      partnerName,
      type: 'new_order',
      typeLabel: 'Permohonan Restok',
      typeBadgeColor: 'bg-amber-50 text-amber-700 border-amber-200/80',
      relatedOrderId: matchedOrder?.id ?? null,
      matchedOrder,
    }
  }

  if (isOrderReceived) {
    return {
      title: `Mitra ${partnerName} sudah menerima kiriman barang`,
      body: `Mitra telah mengonfirmasi bahwa kiriman paket barang restok telah tiba di cabang. Stok cabang telah otomatis bertambah.`,
      partnerName,
      type: 'order_received',
      typeLabel: 'Barang Diterima',
      typeBadgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      relatedOrderId: matchedOrder?.id ?? null,
      matchedOrder,
    }
  }

  if (isLowStock) {
    const cleanBody = rawBody.replace(/PO-[A-Za-z0-9-]+/gi, '').trim()
    let productName = ''
    const titleMatch = rawTitle.match(/Stok Kritis:\s*(.+)/i)
    if (titleMatch) {
      productName = titleMatch[1].trim()
    } else {
      const bodyMatch = rawBody.match(/Stok\s+(.+?)\s+di\s+/i)
      if (bodyMatch) {
        productName = bodyMatch[1].trim()
      }
    }

    const title = productName
      ? `Stok ${productName} di ${partnerName} menipis`
      : `Stok barang di Mitra ${partnerName} menipis`

    return {
      title,
      body:
        cleanBody ||
        `Sisa stok ${productName || 'barang'} di cabang ${partnerName} berada di bawah batas aman (20% par level). Segera siapkan restok.`,
      partnerName,
      productName,
      type: 'low_stock',
      typeLabel: 'Stok Kritis',
      typeBadgeColor: 'bg-rose-50 text-rose-700 border-rose-200/80',
      relatedOrderId: null,
      matchedOrder: null,
    }
  }

  const cleanTitle = rawTitle
    .replace(/:\s*PO-[A-Za-z0-9-]+/gi, '')
    .replace(/PO-[A-Za-z0-9-]+/gi, '')
    .trim()
  const cleanBody = rawBody
    .replace(/untuk\s*PO-[A-Za-z0-9-]+/gi, 'cabang')
    .replace(/PO-[A-Za-z0-9-]+/gi, '')
    .trim()

  return {
    title: cleanTitle || `Alert dari Mitra ${partnerName}`,
    body: cleanBody,
    partnerName,
    type: 'other',
    typeLabel: 'Informasi',
    typeBadgeColor: 'bg-ink-50 text-ink-700 border-line',
    relatedOrderId: matchedOrder?.id ?? null,
    matchedOrder,
  }
}

const EMPTY_NOTIFICATIONS: NotificationItem[] = []

function AlertPanel({
  query,
  orders,
  marking,
  isMarkingAll,
  onRead,
  onReadAll,
  onViewOrderDetail,
  onNavigateToStock,
}: {
  query: UseQueryResult<NotificationItem[]>
  orders: Order[]
  marking: boolean
  isMarkingAll?: boolean
  onRead: (id: string) => void
  onReadAll?: (ids: string[]) => void
  onViewOrderDetail: (orderId: string, category?: OrderCategoryTab) => void
  onNavigateToStock: (partnerName?: string) => void
}) {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [visibleAlerts, setVisibleAlerts] = useState(30)
  const [timePreset, setTimePreset] = useState<
    'semua' | 'hari_ini' | 'kemarin' | '7_hari' | '30_hari'
  >('semua')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<
    'semua' | 'new_order' | 'order_received' | 'low_stock' | 'receipt_missing_proof' | 'receipt_proof_uploaded'
  >('semua')
  const [readFilter, setReadFilter] = useState<'semua' | 'unread' | 'read'>(
    'semua',
  )

  const allAlerts = query.data ?? EMPTY_NOTIFICATIONS
  const orderLookup = useMemo<AlertOrderLookup>(() => {
    const byNumber = new Map<string, Order>()
    const byPartner = new Map<string, Order>()
    for (const order of orders) {
      byNumber.set(order.order_no.toUpperCase(), order)
      if (!byPartner.has(order.partner_id)) byPartner.set(order.partner_id, order)
    }
    return { byNumber, byPartner }
  }, [orders])
  const parsedAlerts = useMemo(
    () => allAlerts.map((item) => ({ item, parsed: parseAndFormatAlert(item, orderLookup) })),
    [allAlerts, orderLookup],
  )
  useEffect(() => {
    setVisibleAlerts(30)
  }, [search, timePreset, selectedDate, typeFilter, readFilter])
  const unreadCount = useMemo(
    () => allAlerts.filter((item) => !item.read_at).length,
    [allAlerts],
  )

  const filteredNotifications = useMemo(() => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

    return parsedAlerts.filter(({ item, parsed }) => {

      if (deferredSearch.trim()) {
        const q = deferredSearch.toLowerCase()
        const matchTitle = parsed.title.toLowerCase().includes(q)
        const matchBody = parsed.body.toLowerCase().includes(q)
        const matchPartner = (item.partner_name ?? '').toLowerCase().includes(q)
        const matchProduct = (parsed.productName ?? '').toLowerCase().includes(q)
        if (!matchTitle && !matchBody && !matchPartner && !matchProduct)
          return false
      }

      if (readFilter === 'unread' && item.read_at) return false
      if (readFilter === 'read' && !item.read_at) return false

      if (typeFilter !== 'semua' && parsed.type !== typeFilter) return false

      const itemDate = new Date(item.created_at)
      if (Number.isNaN(itemDate.getTime())) return true
      const itemDateStr = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-${String(itemDate.getDate()).padStart(2, '0')}`

      if (selectedDate) {
        if (itemDateStr !== selectedDate) return false
      } else if (timePreset === 'hari_ini') {
        if (itemDateStr !== todayStr) return false
      } else if (timePreset === 'kemarin') {
        if (itemDateStr !== yesterdayStr) return false
      } else if (timePreset === '7_hari') {
        const diffMs = now.getTime() - itemDate.getTime()
        if (diffMs > 7 * 86_400_000) return false
      } else if (timePreset === '30_hari') {
        const diffMs = now.getTime() - itemDate.getTime()
        if (diffMs > 30 * 86_400_000) return false
      }

      return true
    })
  }, [parsedAlerts, deferredSearch, timePreset, selectedDate, typeFilter, readFilter])

  const hasActiveFilters =
    Boolean(search) ||
    timePreset !== 'semua' ||
    Boolean(selectedDate) ||
    typeFilter !== 'semua' ||
    readFilter !== 'semua'

  const resetFilters = () => {
    setSearch('')
    setTimePreset('semua')
    setSelectedDate('')
    setTypeFilter('semua')
    setReadFilter('semua')
  }

  return (
    <section
      aria-labelledby="alerts-title"
      className="dashboard-panel-enter space-y-5"
    >
      {/* Header Halaman */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="dashboard-eyebrow">Aktivitas cabang</p>
          <h1 id="alerts-title" className="mt-1 text-2xl font-semibold text-ink-900 sm:text-3xl">
            Alert dan notifikasi
          </h1>
          <p className="mt-1 text-sm text-muted">
            Permohonan restock cabang, barang diterima, dan peringatan stok
            kritis tercatat di sini.
          </p>
        </div>

        {allAlerts.length > 0 ? (
          <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
            <span className="font-medium text-muted">
              Menampilkan <span className="font-bold text-ink-900">{Math.min(visibleAlerts, filteredNotifications.length)}</span> dari {filteredNotifications.length} alert
            </span>
          </div>
        ) : null}
      </div>

      {/* Filter Toolbar: Smooth, Clean, & Compact */}
      <div className="dashboard-surface space-y-3.5 p-4">
        {/* Baris 1: Pencarian & Segmented Status Pills */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Input Pencarian dengan Smooth Clear Button */}
          <div className="relative flex-1 min-w-[240px]">
            <Search
              className="size-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama mitra, produk, atau alert..."
              className="min-h-11 w-full rounded-md border border-line bg-white pl-9.5 pr-10 text-sm text-ink-900 placeholder:text-muted"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-ink-50 hover:text-ink-900"
                aria-label="Hapus pencarian"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          {/* Segmented Control Status Baca */}
          <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-md border border-line bg-ink-50 p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setReadFilter('semua')}
              className={`min-h-11 shrink-0 rounded-md px-3 text-xs font-semibold ${readFilter === 'semua'
                  ? 'bg-white text-ink-900'
                  : 'text-muted hover:text-ink-900'
                }`}
            >
              Semua ({allAlerts.length})
            </button>
            <button
              type="button"
              onClick={() => setReadFilter('unread')}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-semibold ${readFilter === 'unread'
                  ? 'bg-white text-ink-900'
                  : 'text-muted hover:text-ink-900'
                }`}
            >
              <span>Belum Dibaca</span>
              {unreadCount > 0 ? (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${readFilter === 'unread'
                      ? 'bg-ume text-white'
                      : 'bg-ume/15 text-ume'
                    }`}
                >
                  {unreadCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setReadFilter('read')}
              className={`min-h-11 shrink-0 rounded-md px-3 text-xs font-semibold ${readFilter === 'read'
                  ? 'bg-white text-ink-900'
                  : 'text-muted hover:text-ink-900'
                }`}
            >
              Sudah Dibaca
            </button>
          </div>
        </div>

        {/* Baris 2: Filter Waktu (Pill Presets + Elegant Date Picker) & Jenis Alert */}
        <div className="flex flex-col gap-3 pt-3 border-t border-line/60 lg:flex-row lg:items-center lg:justify-between">
          {/* Quick Time Pills + Smooth Date Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 flex items-center gap-1 text-xs font-semibold text-muted">
              <Clock className="size-3 text-muted" aria-hidden="true" />
              <span>Waktu:</span>
            </span>

            {(
              [
                { id: 'semua', label: 'Semua' },
                { id: 'hari_ini', label: 'Hari Ini' },
                { id: 'kemarin', label: 'Kemarin' },
                { id: '7_hari', label: '7 Hari' },
                { id: '30_hari', label: '30 Hari' },
              ] as const
            ).map((preset) => {
              const isActive = timePreset === preset.id && !selectedDate
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setTimePreset(preset.id)
                    setSelectedDate('')
                  }}
                  className={`min-h-11 rounded-md px-3 text-xs font-semibold ${isActive
                      ? 'bg-ink-900 text-white'
                      : 'border border-line bg-white text-muted hover:bg-ink-50 hover:text-ink-900'
                    }`}
                >
                  {preset.label}
                </button>
              )
            })}

            {/* Smooth Custom Date Trigger (Disguised Native Picker) */}
            <div className="relative inline-flex items-center">
              {selectedDate ? (
                <div className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-line bg-white pl-3 text-xs font-semibold text-ink-900">
                  <Calendar className="size-3 text-ume" aria-hidden="true" />
                  <span>{formatSelectedDate(selectedDate)}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDate('')}
                    className="grid size-10 place-items-center rounded-md text-muted hover:bg-ink-50"
                    aria-label="Hapus filter tanggal"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ) : (
                <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-white px-3 text-xs font-semibold text-muted hover:bg-ink-50 hover:text-ink-900">
                  <Calendar className="size-3 text-muted" aria-hidden="true" />
                  <span>Pilih Tanggal</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value)
                      if (e.target.value) setTimePreset('semua')
                    }}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                    title="Pilih tanggal spesifik (hari, bulan, tahun)"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Jenis Alert Dropdown & Tombol Aksi Tambahan */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {/* Filter Jenis Alert Dropdown */}
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as typeof typeFilter)
                }
                className="min-h-11 rounded-md border border-line bg-white px-3 pr-8 text-xs font-semibold text-ink-900"
                aria-label="Filter kategori jenis alert"
              >
                <option value="semua">Semua Kategori</option>
                <option value="low_stock">Stok Kritis</option>
                <option value="new_order">Permohonan Restok</option>
                <option value="order_received">Barang Diterima</option>
                <option value="receipt_missing_proof">Bukti Belum Ada</option>
                <option value="receipt_proof_uploaded">Bukti Diterima</option>
              </select>
              <ChevronDown
                className="size-3 text-muted absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
            </div>

            {/* Tombol Reset Filter */}
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 text-xs font-semibold text-warn-fg hover:bg-warn-bg"
                title="Reset semua filter ke kondisi awal"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                <span>Reset</span>
              </button>
            ) : null}

            {/* Tombol Batch "Tandai Semua Dibaca" */}
            {unreadCount > 0 && onReadAll ? (
              <button
                type="button"
                disabled={isMarkingAll || marking}
                onClick={() => {
                  const unreadIds = allAlerts
                    .filter((a) => !a.read_at)
                    .map((a) => a.id)
                  if (unreadIds.length > 0) onReadAll(unreadIds)
                }}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-xs font-semibold text-ink-900 hover:bg-ink-50 disabled:opacity-50"
                title="Tandai semua alert yang belum dibaca menjadi sudah dibaca"
              >
                {isMarkingAll ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCheck className="size-3.5 text-ok" aria-hidden="true" />
                )}
                <span>Tandai Semua Dibaca</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {query.isLoading ? <LoadingState label="Memuat notifikasi..." /> : null}
      {query.isError ? (
        <div className="mt-4">
          <ErrorState
            message={getErrorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        </div>
      ) : null}
      {!query.isLoading && allAlerts.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Belum ada alert"
            description="Alert dan permohonan baru dari mitra akan muncul di sini."
          />
        </div>
      ) : null}
      {!query.isLoading && allAlerts.length > 0 && filteredNotifications.length === 0 ? (
        <div className="rounded-xl border border-line bg-white p-8 text-center shadow-2xs">
          <Filter className="size-8 mx-auto text-muted/60" aria-hidden="true" />
          <h3 className="mt-2 text-sm font-semibold text-ink-900">
            Tidak ada alert yang cocok
          </h3>
          <p className="mt-1 text-xs text-muted">
            Tidak ditemukan alert yang sesuai dengan filter waktu atau kata kunci yang dipilih.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-3 inline-flex min-h-9 items-center rounded-md border border-line bg-white px-3 text-xs font-semibold text-ink-900 hover:bg-paper transition-colors"
          >
            Bersihkan Filter
          </button>
        </div>
      ) : null}

      {/* Daftar Kartu Alert yang Bersih, Rapi, & Selaras */}
      <div className="space-y-3">
        {filteredNotifications.slice(0, visibleAlerts).map(({ item, parsed }) => {
          const isUnread = !item.read_at

          return (
            <article
              key={item.id}
              className={`group relative rounded-xl border p-4 sm:p-4.5 transition-all duration-200 ${isUnread
                  ? 'border-line/90 bg-white shadow-2xs hover:border-ink-300 hover:shadow-xs'
                  : 'border-line/60 bg-white/60 hover:bg-white hover:border-line hover:shadow-2xs text-muted'
                }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* Bagian Kiri: Ikon Visual + Teks Notifikasi */}
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  {/* Ikon Kategori Alert dengan Background Halus */}
                  <div className="shrink-0 mt-0.5">
                    {parsed.type === 'new_order' ? (
                      <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 shadow-2xs">
                        <Clock className="size-4.5" aria-hidden="true" />
                      </span>
                    ) : parsed.type === 'receipt_missing_proof' ? (
                      <span className="grid size-10 place-items-center rounded-xl border border-warn/30 bg-warn-bg text-warn-fg">
                        <AlertTriangle className="size-4.5" aria-hidden="true" />
                      </span>
                    ) : parsed.type === 'order_received' || parsed.type === 'receipt_proof_uploaded' ? (
                      <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 shadow-2xs">
                        <CheckCircle2 className="size-4.5" aria-hidden="true" />
                      </span>
                    ) : parsed.type === 'low_stock' ? (
                      <span className="grid size-10 place-items-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200/80 shadow-2xs">
                        <AlertOctagon className="size-4.5" aria-hidden="true" />
                      </span>
                    ) : (
                      <span className="grid size-10 place-items-center rounded-xl bg-ink-50 text-ink-600 border border-line shadow-2xs">
                        <Bell className="size-4.5" aria-hidden="true" />
                      </span>
                    )}
                  </div>

                  {/* Konten Judul, Body, & Metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-ink-900 text-sm sm:text-base leading-snug group-hover:text-ink-950 transition-colors">
                        {parsed.title}
                      </h3>

                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${parsed.typeBadgeColor}`}
                      >
                        {parsed.typeLabel}
                      </span>

                      {isUnread ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ume/10 px-2 py-0.5 text-[10px] font-bold text-ume">
                          <span className="size-1.5 rounded-full bg-ume animate-pulse" />
                          Baru
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-xs sm:text-sm text-ink-700 leading-relaxed font-normal">
                      {parsed.body}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                      {parsed.partnerName ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-paper border border-line/70 px-2.5 py-0.5 text-[11px] font-semibold text-ink-800">
                          <Store className="size-3 text-muted" aria-hidden="true" />
                          <span>Cabang: {parsed.partnerName}</span>
                        </span>
                      ) : null}

                      {/* Detail Waktu, Hari, Tanggal, Jam */}
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted font-medium">
                        <Clock className="size-3 text-muted" aria-hidden="true" />
                        <span>{formatDetailedDateTime(item.created_at)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bagian Kanan: Tombol Aksi yang Selaras dan Berjajar Rapi */}
                <div className="flex items-center gap-2 self-start sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/60">
                  {/* Status Sudah Dibaca / Tombol Tandai Dibaca */}
                  {isUnread ? (
                    <button
                      type="button"
                      disabled={marking}
                      onClick={() => onRead(item.id)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-md border border-line/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-paper hover:text-ink-900 transition-colors disabled:opacity-40"
                      title="Tandai sudah dibaca"
                    >
                      <Check className="size-3.5 text-ok" aria-hidden="true" />
                      <span>Tandai dibaca</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted font-medium px-2 py-1">
                      <Check className="size-3 text-ok/70" aria-hidden="true" />
                      <span>Sudah dibaca</span>
                    </span>
                  )}

                  {/* Tombol Aksi Utama Berdasarkan Tipe Alert */}
                  {parsed.type === 'new_order' ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (parsed.relatedOrderId) {
                          onViewOrderDetail(parsed.relatedOrderId, 'menunggu')
                        } else {
                          onViewOrderDetail('', 'menunggu')
                        }
                      }}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-ink-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-ink-700 transition-colors focus-visible:outline-2 focus-visible:outline-ink-700"
                    >
                      <ClipboardCheck className="size-3.5 text-emerald-400" aria-hidden="true" />
                      <span>Detail Pesan</span>
                      <ChevronRight className="size-3.5 opacity-60" aria-hidden="true" />
                    </button>
                  ) : parsed.type === 'order_received' || parsed.type === 'receipt_missing_proof' || parsed.type === 'receipt_proof_uploaded' ? (
                    <button
                      type="button"
                      onClick={() =>
                        onViewOrderDetail(parsed.relatedOrderId || '', 'selesai')
                      }
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink-900 hover:bg-ink-100 transition-colors"
                    >
                      <ClipboardCheck className="size-3.5 text-muted" aria-hidden="true" />
                      <span>{parsed.type === 'receipt_missing_proof' ? 'Minta Bukti' : 'Detail Pesan'}</span>
                      <ChevronRight className="size-3.5 opacity-60" aria-hidden="true" />
                    </button>
                  ) : parsed.type === 'low_stock' ? (
                    <button
                      type="button"
                      onClick={() =>
                        onNavigateToStock(parsed.partnerName || undefined)
                      }
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink-900 hover:bg-ink-100 transition-colors"
                    >
                      <Boxes className="size-3.5 text-muted" aria-hidden="true" />
                      <span>Periksa Stok</span>
                      <ChevronRight className="size-3.5 opacity-60" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          )
        })}
        {filteredNotifications.length > visibleAlerts ? (
          <button
            type="button"
            onClick={() => setVisibleAlerts((current) => current + 30)}
            className="min-h-11 w-full rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            Tampilkan 30 notifikasi berikutnya
          </button>
        ) : null}
      </div>
    </section>
  )
}
