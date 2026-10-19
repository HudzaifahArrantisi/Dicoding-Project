import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { OrderStatus, StockStatus } from '@daisuki/shared'
import { Dialog } from 'radix-ui'
import {
  AlertOctagon,
  Bell,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Loader2,
  LogOut,
  Save,
  Search,
  Store,
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
  const [adminNotes, setAdminNotes] = useState<Partial<Record<string, string>>>(
    {},
  )
  const dirtyApprovalOrderIds = useRef(new Set<string>())

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
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
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
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
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
                Dashboard Admin Inventory
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
              label="Jumlah mitra"
              value={metrics.data?.totalBranches}
              Icon={Building2}
            />
            <Metric
              label="Mitra yang Kurang barang"
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
  const [expandedPartners, setExpandedPartners] = useState<
    Record<string, boolean>
  >({})
  const [centralStockDrafts, setCentralStockDrafts] = useState<
    Record<string, string>
  >({})
  const dirtyCentralStockIds = useRef(new Set<string>())

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

  const updateCentralStock = useMutation({
    mutationFn: async ({
      productId,
      centralStock,
    }: {
      productId: string
      centralStock: number
    }) => {
      const response = await api
        .products({ id: productId })
        ['central-stock'].put({ central_stock: centralStock })

      if (response.error || 'error' in response.data) {
        throw apiError(
          response.error ?? response.data,
          'Stok pusat belum diperbarui',
        )
      }
    },
    onSuccess: async (_data, variables) => {
      toast.success('Stok pusat diperbarui')
      dirtyCentralStockIds.current.delete(variables.productId)
      setCentralStockDrafts((current) => ({
        ...current,
        [variables.productId]: String(variables.centralStock),
      }))
      await queryClient.invalidateQueries({
        queryKey: ['admin-central-products'],
      })
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error)),
  })

  const saveCentralStock = (product: Product) => {
    const value = Number(centralStockDrafts[product.id])
    if (!Number.isInteger(value) || value < 0) {
      toast.error('Stok harus berupa bilangan bulat, minimal 0')
      return
    }

    updateCentralStock.mutate({
      productId: product.id,
      centralStock: value,
    })
  }

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
              Ubah jumlah ready stock. Nilai terbaru dibaca otomatis oleh
              dashboard mitra.
            </p>
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
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {centralProductsQuery.data?.map((prod) => {
            const draft =
              centralStockDrafts[prod.id] ?? String(prod.central_stock)
            const parsedDraft = Number(draft)
            const isValid = Number.isInteger(parsedDraft) && parsedDraft >= 0
            const hasChanged = isValid && parsedDraft !== prod.central_stock
            const isSaving =
              updateCentralStock.isPending &&
              updateCentralStock.variables.productId === prod.id

            return (
              <div
                key={prod.id}
                className="rounded border border-line bg-paper/60 p-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-ink-900 text-sm">
                      {prod.name}
                    </p>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                      prod.central_stock > 0
                        ? 'bg-ok-bg text-ok'
                        : 'bg-crit-bg text-crit-fg'
                    }`}
                  >
                    {prod.central_stock > 0 ? 'Siap Kirim' : 'Stok Habis'}
                  </span>
                </div>
                <div className="mt-3 border-t border-line/60 pt-3">
                  <label
                    htmlFor={`central-stock-${prod.id}`}
                    className="text-xs font-medium text-muted"
                  >
                    Stok pusat ({prod.unit})
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id={`central-stock-${prod.id}`}
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={draft}
                      onChange={(event) => {
                        dirtyCentralStockIds.current.add(prod.id)
                        setCentralStockDrafts((current) => ({
                          ...current,
                          [prod.id]: event.target.value,
                        }))
                      }}
                      aria-invalid={!isValid}
                      className="min-h-11 min-w-0 flex-1 rounded-sm border border-line bg-white px-3 text-base font-semibold tabular-nums text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
                    />
                    <button
                      type="button"
                      onClick={() => saveCentralStock(prod)}
                      disabled={!hasChanged || updateCentralStock.isPending}
                      aria-label={`Simpan stok pusat ${prod.name}`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm bg-ink-700 px-3 text-white hover:bg-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isSaving ? (
                        <Loader2
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Save className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {!isValid ? (
                    <p className="mt-1 text-xs text-crit-fg" role="alert">
                      Masukkan bilangan bulat minimal 0.
                    </p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section
        className="overflow-hidden rounded-md border border-line bg-white"
        aria-labelledby="stocks-title"
      >
        <div className="border-b border-line p-4">
          <div className="flex items-center justify-between">
            <h2
              id="stocks-title"
              className="text-lg font-semibold text-ink-900"
            >
              Stok Seluruh Cabang Mitra
            </h2>
            <span className="text-xs text-muted">
              {branchGroups.length} cabang · Diperbarui otomatis setiap 5 detik
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
                        Cabang {group.partner_type} • Klik untuk{' '}
                        {isExpanded ? 'tutup' : 'lihat'} detail (
                        {group.items.length} produk)
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

type OrderCategoryTab = 'menunggu' | 'selesai' | 'ditolak' | 'semua'

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
  adminNotes: Partial<Record<string, string>>
  onAdminNoteChange: (orderId: string, note: string) => void
  pending: boolean
  onApprovedChange: (orderId: string, productId: string, qty: number) => void
  onApprove: (order: Order) => Promise<unknown>
  onReject: (id: string, reason: string) => Promise<unknown>
  onShip: (id: string) => Promise<unknown>
}) {
  const [activeCategory, setActiveCategory] =
    useState<OrderCategoryTab>('menunggu')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const orderTriggerRefs = useRef<
    Partial<Record<string, HTMLButtonElement | null>>
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
    if (activeCategory === 'ditolak') {
      return allOrders.filter((order) =>
        ['ditolak', 'dibatalkan'].includes(order.status),
      )
    }
    return allOrders
  }, [activeCategory, allOrders])
  const selectedOrder = allOrders.find((order) => order.id === selectedOrderId)

  return (
    <section aria-labelledby="orders-title" className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="orders-title" className="text-xl font-semibold text-ink-900">
            Approval dan pengiriman
          </h2>
          <p className="mt-1 text-sm text-muted">
            Kelola permohonan restock dari mitra cabang, setujui kuantitas, dan
            pantau pengiriman.
          </p>
        </div>
      </div>

      <nav
        className="flex flex-wrap items-center gap-2 border-b border-line pb-3"
        aria-label="Kategori status pesanan"
      >
        <button
          type="button"
          onClick={() => setActiveCategory('menunggu')}
          className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${
            activeCategory === 'menunggu'
              ? 'bg-ink-900 text-white shadow-sm'
              : 'border border-line bg-white text-muted hover:bg-ink-50 hover:text-ink-900'
          }`}
        >
          <Clock className="size-4" aria-hidden="true" />
          <span>Menunggu Persetujuan</span>
          {pendingCount > 0 ? (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeCategory === 'menunggu'
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
          className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${
            activeCategory === 'selesai'
              ? 'bg-ink-900 text-white shadow-sm'
              : 'border border-line bg-white text-muted hover:bg-ink-50 hover:text-ink-900'
          }`}
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          <span>Selesai / Disetujui</span>
          {completedCount > 0 ? (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeCategory === 'selesai'
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
          className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${
            activeCategory === 'ditolak'
              ? 'bg-ink-900 text-white shadow-sm'
              : 'border border-line bg-white text-muted hover:bg-ink-50 hover:text-ink-900'
          }`}
        >
          <XCircle className="size-4" aria-hidden="true" />
          <span>Ditolak</span>
          {rejectedCount > 0 ? (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeCategory === 'ditolak'
                  ? 'bg-crit text-white'
                  : 'bg-crit-bg text-crit'
              }`}
            >
              {rejectedCount}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('semua')}
          className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-semibold transition ${
            activeCategory === 'semua'
              ? 'bg-ink-900 text-white shadow-sm'
              : 'border border-line bg-white text-muted hover:bg-ink-50 hover:text-ink-900'
          }`}
        >
          <span>Semua ({allOrders.length})</span>
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
                  : activeCategory === 'ditolak'
                    ? 'Tidak ada pesanan yang ditolak'
                    : 'Belum ada pesanan masuk'
            }
            description={
              activeCategory === 'menunggu'
                ? 'Semua permintaan restock dari mitra cabang telah diproses.'
                : 'Ubah kategori tab di atas untuk memeriksa daftar pesanan lainnya.'
            }
          />
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {filteredOrders.map((order) => (
          <button
            key={order.id}
            ref={(element) => {
              orderTriggerRefs.current[order.id] = element
            }}
            type="button"
            onClick={() => setSelectedOrderId(order.id)}
            className="min-h-24 rounded-md border border-line bg-white p-4 text-left text-sm font-semibold text-ink-900 transition-colors hover:border-ink-500 hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
          >
            {order.partner_name} meminta restock barang
          </button>
        ))}
      </div>

      <ApprovalDialog
        order={selectedOrder ?? null}
        open={selectedOrderId !== null}
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

  useEffect(() => {
    setRejectionMode(false)
    setRejectionReason('')
    setActionError('')
  }, [order?.id])

  if (!order) return null

  const editable = order.status === 'diproses' || order.status === 'disetujui'
  const values = order.items.map((item) => ({
    item,
    qty:
      approved[order.id]?.[item.product_id] ??
      item.qty_approved ??
      item.qty_requested,
    max: Math.min(item.qty_requested, item.central_stock),
  }))
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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/45" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border border-line bg-white shadow-xl focus:outline-none">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-white p-4 sm:p-5">
            <div>
              <Dialog.Title className="text-lg font-semibold text-ink-900">
                {order.partner_name} meminta restock barang
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                {order.order_no} ·{' '}
                {new Date(order.created_at).toLocaleString('id-ID', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Tutup detail permintaan"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-line text-muted hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            <OrderStatusBadge status={order.status} />

            {order.note ? (
              <div className="rounded-md bg-ink-50 p-3 text-sm text-ink-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Catatan mitra
                </p>
                <p className="mt-1">{order.note}</p>
              </div>
            ) : null}

            <div className="divide-y divide-line rounded-md border border-line">
              {values.map(({ item, qty, max }) => {
                const invalid = !Number.isInteger(qty) || qty < 0 || qty > max
                return (
                  <div
                    key={item.id}
                    className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink-900">
                        {item.product_name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {item.product_sku} · Diminta {item.qty_requested}{' '}
                        {item.product_unit} · Stok pusat {item.central_stock}{' '}
                        {item.product_unit}
                      </p>
                      {invalid ? (
                        <p
                          className="mt-1 text-xs font-medium text-crit"
                          role="alert"
                        >
                          Isi 0 sampai {max} {item.product_unit}.
                        </p>
                      ) : null}
                    </div>
                    {editable ? (
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={`approval-${order.id}-${item.product_id}`}
                          className="text-xs font-medium text-muted"
                        >
                          Disetujui
                        </label>
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
                          className="h-11 w-24 rounded-md border border-line px-3 text-right font-semibold tabular-nums text-ink-900 focus:border-ink-700 focus:outline-none focus:ring-1 focus:ring-ink-700"
                        />
                      </div>
                    ) : (
                      <p className="text-sm font-semibold tabular-nums text-ink-900">
                        Disetujui {item.qty_approved ?? 0} {item.product_unit}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {editable ? (
              <div>
                <label
                  htmlFor={`approval-note-${order.id}`}
                  className="text-sm font-semibold text-ink-900"
                >
                  Catatan admin {hasAdjustment ? '(wajib)' : '(opsional)'}
                </label>
                <p className="mt-1 text-xs text-muted">
                  Jelaskan penyesuaian jika jumlah yang disetujui berbeda dari
                  permintaan mitra.
                </p>
                <textarea
                  id={`approval-note-${order.id}`}
                  rows={3}
                  maxLength={1000}
                  value={currentNote}
                  aria-invalid={noteRequired}
                  onChange={(event) =>
                    onAdminNoteChange(order.id, event.target.value)
                  }
                  className="mt-2 w-full rounded-md border border-line p-3 text-sm text-ink-900 focus:border-ink-700 focus:outline-none focus:ring-1 focus:ring-ink-700"
                  placeholder="Contoh: stok gudang tersedia sebagian"
                />
                {noteRequired ? (
                  <p
                    className="mt-1 text-xs font-medium text-crit"
                    role="alert"
                  >
                    Catatan wajib diisi karena jumlah disesuaikan.
                  </p>
                ) : null}
              </div>
            ) : order.admin_note ? (
              <div className="rounded-md border border-line bg-ink-50 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Catatan admin
                </p>
                <p className="mt-1 text-ink-800">{order.admin_note}</p>
              </div>
            ) : null}

            {order.status === 'ditolak' && order.rejected_reason ? (
              <div className="rounded-md border border-crit/30 bg-crit-bg/30 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-crit">
                  Alasan penolakan
                </p>
                <p className="mt-1 text-ink-800">{order.rejected_reason}</p>
              </div>
            ) : null}

            {rejectionMode && order.status === 'diproses' ? (
              <div className="rounded-md border border-crit/30 p-3">
                <label
                  htmlFor={`rejection-reason-${order.id}`}
                  className="text-sm font-semibold text-ink-900"
                >
                  Alasan penolakan
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
