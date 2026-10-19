import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { OrderStatus, StockStatus } from '@daisuki/shared'
import {
  AlertOctagon,
  Bell,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Loader2,
  LogOut,
  Search,
  Store,
  Truck,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/inventory/query-state'
import { RakBar } from '@/components/inventory/rak-bar'
import {
  OrderStatusBadge,
  StaleBadge,
  StockStatusBadge,
} from '@/components/inventory/status-badge'
import { api } from '@/lib/api'
import { apiError, unwrapData } from '@/lib/api-response'
import { useAuth } from '@/lib/auth'
import type {
  NotificationItem,
  Order,
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

type AdminTab = 'stocks' | 'orders' | 'alerts'

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Periksa koneksi, lalu coba lagi.'

function AdminDashboard() {
  const { user, logout, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<AdminTab>('stocks')
  const [search, setSearch] = useState('')
  const [partner, setPartner] = useState('semua')
  const [status, setStatus] = useState<StockStatus | 'semua' | 'belum_update'>(
    'semua',
  )
  const [approved, setApproved] = useState<
    Partial<Record<string, Partial<Record<string, number>>>>
  >({})
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})

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
    refetchInterval: 15_000,
  })
  const stocks = useQuery<StockItem[]>({
    queryKey: ['admin-stocks'],
    queryFn: async () =>
      unwrapData(
        await api.stocks.get({ query: {} }),
        'Stok cabang belum dimuat',
      ),
    enabled: user?.role === 'admin',
  })
  const centralProducts = useQuery<Product[]>({
    queryKey: ['admin-central-products'],
    queryFn: async () =>
      unwrapData(await api.products.get(), 'Stok pusat belum dimuat'),
    enabled: user?.role === 'admin',
    refetchInterval: 10_000,
  })
  const orders = useQuery<Order[]>({
    queryKey: ['admin-orders'],
    queryFn: async () =>
      unwrapData(await api.orders.get({ query: {} }), 'Pesanan belum dimuat'),
    enabled: user?.role === 'admin',
  })
  const notifications = useQuery<NotificationItem[]>({
    queryKey: ['admin-notifications'],
    queryFn: async () =>
      unwrapData(await api.notifications.get(), 'Notifikasi belum dimuat'),
    enabled: user?.role === 'admin',
    refetchInterval: 15_000,
  })

  useEffect(() => {
    if (!orders.data) return
    setApproved(
      Object.fromEntries(
        orders.data.map((order) => [
          order.id,
          Object.fromEntries(
            order.items.map((item) => [
              item.product_id,
              item.qty_approved ?? item.qty_requested,
            ]),
          ),
        ]),
      ),
    )
  }, [orders.data])

  const updateOrder = useMutation({
    mutationFn: async (input: {
      id: string
      status: OrderStatus
      admin_note?: string
      items?: Array<{ product_id: string; qty_approved: number }>
    }) => {
      const response = await api.orders({ id: input.id }).status.patch({
        status: input.status,
        admin_note: input.admin_note,
        items: input.items,
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

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.notifications({ id }).read.patch()
      if (response.error)
        throw apiError(response.error, 'Notifikasi belum ditandai')
    },
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
  })

  const partnerNames = useMemo(
    () =>
      Array.from(new Set((stocks.data ?? []).map((item) => item.partner_name))),
    [stocks.data],
  )
  const filteredStocks = useMemo(() => {
    const keyword = search.trim().toLowerCase()
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
  }, [partner, search, status, stocks.data])
  const unread = (notifications.data ?? []).filter(
    (item) => !item.read_at,
  ).length

  if (authLoading || !user || user.role !== 'admin') {
    return (
      <main className="grid min-h-screen place-items-center bg-paper">
        <p className="text-sm text-muted" role="status">
          Memeriksa akses admin...
        </p>
      </main>
    )
  }

  const approveOrder = (order: Order) =>
    updateOrder.mutate({
      id: order.id,
      status: 'disetujui',
      admin_note: adminNotes[order.id]?.trim() || undefined,
      items: order.items.map((item) => ({
        product_id: item.product_id,
        qty_approved:
          approved[order.id]?.[item.product_id] ?? item.qty_requested,
      })),
    })

  return (
    <div className="min-h-screen bg-paper text-text">
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-ink-900 text-ume">
              <Boxes className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold text-ink-900">
                Inventory
              </p>
              <p className="truncate text-xs text-muted">
                Admin · {user.full_name}
              </p>
            </div>
          </div>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setTab('alerts')}
              className="relative grid size-11 place-items-center rounded-md text-muted hover:bg-ink-50"
              aria-label={`${unread} notifikasi belum dibaca`}
            >
              <Bell className="size-5" aria-hidden="true" />
              {unread ? (
                <span className="absolute right-1 top-1 rounded-sm bg-crit px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              aria-label="Keluar"
              onClick={() => {
                logout()
                void navigate({ to: '/login' })
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted hover:bg-ink-50"
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
        <nav
          className="mx-auto grid max-w-7xl grid-cols-3 px-2 sm:flex sm:px-6 lg:px-8"
          aria-label="Menu admin"
        >
          <TabButton
            label="Stok"
            Icon={Boxes}
            active={tab === 'stocks'}
            onClick={() => setTab('stocks')}
          />
          <TabButton
            label="Approval"
            Icon={ClipboardCheck}
            active={tab === 'orders'}
            count={metrics.data?.pendingOrders}
            onClick={() => setTab('orders')}
          />
          <TabButton
            label="Alert"
            Icon={AlertOctagon}
            active={tab === 'alerts'}
            count={unread}
            critical
            onClick={() => setTab('alerts')}
          />
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section aria-labelledby="summary-title">
          <p className="text-sm font-semibold text-ume">Ringkasan hari ini</p>
          <h1
            id="summary-title"
            className="mt-1 text-2xl font-semibold text-ink-900"
          >
            Prioritas operasional
          </h1>
          {metrics.isError ? (
            <div className="mt-4">
              <ErrorState
                message={getErrorMessage(metrics.error)}
                onRetry={() => void metrics.refetch()}
              />
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric
              label="Cabang aktif"
              value={metrics.data?.totalBranches}
              Icon={Building2}
            />
            <Metric
              label="Cabang kritis"
              value={metrics.data?.criticalBranches}
              detail={`${metrics.data?.criticalItemsCount ?? 0} produk di bawah 20%`}
              Icon={AlertOctagon}
              critical
            />
            <Metric
              label="Perlu approval"
              value={metrics.data?.pendingOrders}
              detail="Pesanan menunggu keputusan"
              Icon={ClipboardCheck}
            />
          </div>
        </section>

        {tab === 'stocks' ? (
          <StockPanel
            query={stocks}
            centralProducts={centralProducts.data ?? []}
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
            approved={approved}
            adminNotes={adminNotes}
            onAdminNoteChange={(orderId, note) =>
              setAdminNotes((current) => ({
                ...current,
                [orderId]: note,
              }))
            }
            pending={updateOrder.isPending}
            onApprovedChange={(orderId, productId, qty) =>
              setApproved((current) => ({
                ...current,
                [orderId]: {
                  ...current[orderId],
                  [productId]: Math.max(0, qty),
                },
              }))
            }
            onApprove={approveOrder}
            onReject={(id) => updateOrder.mutate({ id, status: 'ditolak' })}
            onShip={(id) =>
              updateOrder.mutate({ id, status: 'dalam_pengiriman' })
            }
          />
        ) : null}
        {tab === 'alerts' ? (
          <AlertPanel
            query={notifications}
            marking={markRead.isPending}
            onRead={(id) => markRead.mutate(id)}
          />
        ) : null}
      </main>
    </div>
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
      className={`flex min-h-12 items-center justify-center gap-2 border-b-2 px-3 text-sm font-semibold ${active ? 'border-ink-700 text-ink-700' : 'border-transparent text-muted'}`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
      {count ? (
        <span
          className={`rounded-sm px-1.5 py-0.5 text-xs ${critical ? 'bg-crit-bg text-crit-fg' : 'bg-ink-100 text-ink-700'}`}
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
    <article
      className={`rounded-md border p-4 ${critical && value ? 'border-crit/30 bg-crit-bg' : 'border-line bg-white'}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted">{label}</p>
        <Icon
          className={critical ? 'size-5 text-crit' : 'size-5 text-ink-500'}
          aria-hidden="true"
        />
      </div>
      <p className="mt-2 font-display text-4xl font-semibold tabular-nums text-ink-900">
        {value ?? '–'}
      </p>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
    </article>
  )
}

interface PartnerStockGroup {
  partner_id: string
  partner_name: string
  partner_type: string
  overall_status: StockStatus
  is_stale: boolean
  items: StockItem[]
}

function StockPanel({
  query,
  centralProducts,
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
  centralProducts: Product[]
  rows: StockItem[]
  search: string
  partner: string
  status: StockStatus | 'semua' | 'belum_update'
  partnerNames: string[]
  onSearch: (value: string) => void
  onPartner: (value: string) => void
  onStatus: (value: StockStatus | 'semua' | 'belum_update') => void
}) {
  const [expandedPartners, setExpandedPartners] = useState<
    Record<string, boolean>
  >({})

  const toggleExpand = (partnerId: string) => {
    setExpandedPartners((prev) => ({
      ...prev,
      [partnerId]: !prev[partnerId],
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

  return (
    <div className="space-y-6">
      <section
        className="rounded-md border border-line bg-white p-5"
        aria-labelledby="central-stock-admin-title"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded bg-ink-900 text-ume">
                <Store className="size-4" aria-hidden="true" />
              </span>
              <h2
                id="central-stock-admin-title"
                className="text-base font-semibold text-ink-900"
              >
                Stok Gudang Daisuki Pusat (Ready Stock)
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted">
              Ketersediaan 4 produk resmi di gudang pusat untuk pemenuhan restock seluruh cabang mitra.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {centralProducts.map((prod) => (
            <div
              key={prod.id}
              className="rounded border border-line bg-paper/60 p-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-ink-900 text-sm">{prod.name}</p>
                  <p className="text-[11px] text-muted">{prod.sku}</p>
                </div>
                <span className="rounded bg-ok-bg px-2 py-0.5 text-[11px] font-bold text-ok">
                  Siap Kirim
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between border-t border-line/60 pt-2">
                <span className="text-xs text-muted">Stok Pusat:</span>
                <span className="font-display text-lg font-bold tabular-nums text-ink-900">
                  {prod.central_stock.toLocaleString('id-ID')}{' '}
                  <span className="text-xs font-normal text-muted">{prod.unit}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        className="overflow-hidden rounded-md border border-line bg-white"
        aria-labelledby="stocks-title"
      >
        <div className="border-b border-line p-4">
          <div className="flex items-center justify-between">
            <h2 id="stocks-title" className="text-lg font-semibold text-ink-900">
              Stok Seluruh Cabang Mitra
            </h2>
            <span className="text-xs text-muted">
              {branchGroups.length} Cabang terdaftar
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
                placeholder="Cari cabang, produk, atau SKU"
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
              onChange={(event) => onStatus(event.target.value as typeof status)}
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
        <div className="divide-y divide-line">
          {branchGroups.map((group) => {
            const isExpanded = !!expandedPartners[group.partner_id]
            return (
              <article
                key={group.partner_id}
                className={`transition-colors ${
                  group.overall_status === 'kritis'
                    ? 'border-l-[3px] border-l-crit bg-crit-bg/15'
                    : group.overall_status === 'waspada'
                      ? 'border-l-[3px] border-l-warn bg-warn-bg/15'
                      : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(group.partner_id)}
                  aria-expanded={isExpanded}
                  className="flex w-full items-center justify-between p-4 text-left transition hover:bg-ink-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-700"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-md ${
                        group.overall_status === 'kritis'
                          ? 'bg-crit-bg text-crit'
                          : group.overall_status === 'waspada'
                            ? 'bg-warn-bg text-warn'
                            : 'bg-ok-bg text-ok'
                      }`}
                    >
                      <Building2 className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-semibold text-ink-900">
                        {group.partner_name}
                      </p>
                      <p className="text-xs capitalize text-muted">
                        Cabang {group.partner_type} • Klik untuk {isExpanded ? 'tutup' : 'lihat'} detail ({group.items.length} produk)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StockStatusBadge status={group.overall_status} />
                      {group.is_stale ? <StaleBadge /> : null}
                    </div>
                    <span className="grid size-8 place-items-center text-muted">
                      {isExpanded ? (
                        <ChevronUp className="size-5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="size-5" aria-hidden="true" />
                      )}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-line bg-paper/60 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                      Rincian Stok 4 Produk di {group.partner_name}
                    </p>
                    <div className="divide-y divide-line rounded-md border border-line bg-white">
                      {group.items.map((stock) => (
                        <div
                          key={stock.product_id}
                          className="grid gap-3 p-3.5 sm:grid-cols-[1.5fr_1.5fr_130px] sm:items-center"
                        >
                          <div>
                            <p className="text-sm font-medium text-ink-900">
                              {stock.product_name}
                            </p>
                            <p className="text-xs text-muted">{stock.product_sku}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <RakBar
                              compact
                              percentage={stock.percentage}
                              status={stock.status}
                              label={`${stock.percentage} persen`}
                            />
                            <span className="text-sm font-semibold tabular-nums text-ink-800">
                              {stock.current_qty}/{stock.par_level}
                            </span>
                          </div>
                          <div className="flex items-center justify-start gap-1 sm:justify-end">
                            <StockStatusBadge status={stock.status} />
                            {stock.is_stale ? <StaleBadge /> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function OrderPanel({
  query,
  approved,
  adminNotes,
  onAdminNoteChange,
  pending,
  onApprovedChange,
  onApprove,
  onReject,
  onShip,
}: {
  query: UseQueryResult<Order[]>
  approved: Partial<Record<string, Partial<Record<string, number>>>>
  adminNotes: Record<string, string>
  onAdminNoteChange: (orderId: string, note: string) => void
  pending: boolean
  onApprovedChange: (orderId: string, productId: string, qty: number) => void
  onApprove: (order: Order) => void
  onReject: (id: string) => void
  onShip: (id: string) => void
}) {
  return (
    <section aria-labelledby="orders-title">
      <h2 id="orders-title" className="text-xl font-semibold text-ink-900">
        Approval dan pengiriman
      </h2>
      <p className="mt-1 text-sm text-muted">
        Periksa jumlah, setujui, lalu tandai saat barang mulai dikirim.
      </p>
      {query.isLoading ? <LoadingState label="Memuat pesanan..." /> : null}
      {query.isError ? (
        <div className="mt-4">
          <ErrorState
            message={getErrorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        </div>
      ) : null}
      {query.data?.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Belum ada pesanan masuk"
            description="Pesanan mitra akan muncul di sini."
          />
        </div>
      ) : null}
      <div className="mt-4 space-y-4">
        {query.data?.map((order) => (
          <article
            key={order.id}
            className="rounded-md border border-line bg-white p-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <div>
                <p className="font-display text-lg font-semibold tabular-nums text-ink-900">
                  {order.order_no}
                </p>
                <p className="text-sm font-medium text-ink-700">
                  {order.partner_name}
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>
            <div className="mt-4 space-y-2">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-line pt-2"
                >
                  <div>
                    <p className="text-sm font-medium text-ink-900">
                      {item.product_name}
                    </p>
                    <p className="text-xs text-muted">
                      Diminta {item.qty_requested} {item.product_unit}
                    </p>
                  </div>
                  {order.status === 'diproses' ? (
                    <>
                      <label
                        className="sr-only"
                        htmlFor={`qty-${order.id}-${item.id}`}
                      >
                        Jumlah disetujui {item.product_name}
                      </label>
                      <input
                        id={`qty-${order.id}-${item.id}`}
                        type="number"
                        min={0}
                        value={
                          approved[order.id]?.[item.product_id] ??
                          item.qty_requested
                        }
                        onChange={(event) =>
                          onApprovedChange(
                            order.id,
                            item.product_id,
                            Number.parseInt(event.target.value, 10) || 0,
                          )
                        }
                        className="h-11 w-20 rounded-sm border border-line text-center font-semibold tabular-nums"
                      />
                    </>
                  ) : (
                    <span className="text-sm font-semibold tabular-nums text-ink-700">
                      {item.qty_approved ?? item.qty_requested}{' '}
                      {item.product_unit}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {order.note ? (
              <p className="mt-3 rounded-sm bg-ink-50 p-3 text-sm text-muted">
                Catatan mitra: {order.note}
              </p>
            ) : null}

            {order.status === 'diproses' ? (
              <div className="mt-3 rounded-md border border-line bg-paper/60 p-3">
                <label
                  htmlFor={`admin-note-${order.id}`}
                  className="block text-xs font-semibold uppercase tracking-wide text-ink-700"
                >
                  Catatan & Alasan Penyesuaian Jumlah (Admin Pusat)
                </label>
                <p className="mt-0.5 text-xs text-muted">
                  Wajib diisi jika jumlah disetujui lebih sedikit dari yang diminta (misal: stok gudang sedang dialokasikan untuk cabang lain).
                </p>
                <textarea
                  id={`admin-note-${order.id}`}
                  rows={2}
                  value={adminNotes[order.id] ?? ''}
                  onChange={(event) =>
                    onAdminNoteChange(order.id, event.target.value)
                  }
                  placeholder="Tuliskan alasan penyesuaian jika kuantitas disetujui berbeda..."
                  className="mt-2 w-full rounded border border-line bg-white p-2.5 text-sm text-ink-900 placeholder:text-muted focus:border-ink-700 focus:outline-none focus:ring-1 focus:ring-ink-700"
                />
              </div>
            ) : null}

            {order.admin_note ? (
              <div className="mt-3 rounded-md border border-ume/20 bg-ume/5 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-ume">
                  Catatan & Penjelasan Admin Pusat:
                </p>
                <p className="mt-1 text-ink-800">{order.admin_note}</p>
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              {order.status === 'diproses' ? (
                <>
                  <button
                    type="button"
                    onClick={() => onReject(order.id)}
                    disabled={pending}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-crit/40 px-4 text-sm font-semibold text-crit-fg"
                  >
                    <X className="size-4" aria-hidden="true" />
                    Tolak
                  </button>
                  <button
                    type="button"
                    onClick={() => onApprove(order)}
                    disabled={pending}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink-700 px-4 text-sm font-semibold text-white"
                  >
                    {pending ? (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Check className="size-4" aria-hidden="true" />
                    )}
                    Setujui jumlah
                  </button>
                </>
              ) : null}
              {order.status === 'disetujui' ? (
                <button
                  type="button"
                  onClick={() => onShip(order.id)}
                  disabled={pending}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-order-pengiriman px-4 text-sm font-semibold text-white"
                >
                  <Truck className="size-4" aria-hidden="true" />
                  Tandai dalam pengiriman
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function AlertPanel({
  query,
  marking,
  onRead,
}: {
  query: UseQueryResult<NotificationItem[]>
  marking: boolean
  onRead: (id: string) => void
}) {
  return (
    <section aria-labelledby="alerts-title">
      <h2 id="alerts-title" className="text-xl font-semibold text-ink-900">
        Alert dan notifikasi
      </h2>
      <p className="mt-1 text-sm text-muted">
        Stok kritis dan pesanan baru tercatat di sini.
      </p>
      {query.isLoading ? <LoadingState label="Memuat notifikasi..." /> : null}
      {query.isError ? (
        <div className="mt-4">
          <ErrorState
            message={getErrorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        </div>
      ) : null}
      {query.data?.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Belum ada alert"
            description="Alert baru akan muncul di bagian ini."
          />
        </div>
      ) : null}
      <div className="mt-4 space-y-3">
        {query.data?.map((item) => (
          <article
            key={item.id}
            className={`rounded-md border p-4 ${item.type === 'low_stock' ? 'border-crit/30 bg-crit-bg' : 'border-line bg-white'}`}
          >
            <div className="flex gap-3">
              <AlertOctagon
                className={`size-5 shrink-0 ${item.type === 'low_stock' ? 'text-crit' : 'text-ink-500'}`}
                aria-hidden="true"
              />
              <div>
                <h3 className="font-semibold text-ink-900">{item.title}</h3>
                {item.body ? (
                  <p className="mt-1 text-sm text-muted">{item.body}</p>
                ) : null}
                {item.partner_name ? (
                  <p className="mt-2 text-xs font-semibold text-ink-700">
                    Cabang: {item.partner_name}
                  </p>
                ) : null}
                {item.read_at ? (
                  <p className="mt-3 text-xs text-muted">Sudah dibaca</p>
                ) : (
                  <button
                    type="button"
                    disabled={marking}
                    onClick={() => onRead(item.id)}
                    className="mt-3 min-h-11 rounded-md border border-ink-700 px-3 text-sm font-semibold text-ink-700"
                  >
                    Tandai dibaca
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
