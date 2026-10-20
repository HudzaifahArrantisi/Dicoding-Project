import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog } from 'radix-ui'
import {
  AlertTriangle,
  Boxes,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  History,
  Loader2,
  LogOut,
  MessageSquare,
  Minus,
  PackagePlus,
  Plus,
  Save,
  Search,
  Store,
  Truck,
  UserRound,
  X,
} from 'lucide-react'
import { getStockStatus, stockPercent } from '@daisuki/shared'
import { toast } from 'sonner'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/inventory/query-state'
import { RakBar } from '@/components/inventory/rak-bar'
import {
  BatchDetailModal,
  type StockLogBatch,
} from '@/components/inventory/batch-detail-modal'
import {
  OrderStatusBadge,
  StaleBadge,
  StockStatusBadge,
} from '@/components/inventory/status-badge'
import { api } from '@/lib/api'
import { apiError, unwrapData } from '@/lib/api-response'
import { useAuth, type User } from '@/lib/auth'
import type { Order, Product, StockItem, StockLog } from '@/lib/inventory-types'

export const Route = createFileRoute('/mitra')({ component: MitraPortal })

type MitraTab = 'stocks' | 'order' | 'history' | 'logs' | 'profile'
type DraftOrderItem = { product_id: string; qty: number }

const tabItems: Array<{
  id: MitraTab
  label: string
  Icon: typeof Store
}> = [
  { id: 'stocks', label: 'Stok', Icon: Store },
  { id: 'order', label: 'Pesan', Icon: PackagePlus },
  { id: 'history', label: 'Riwayat', Icon: ClipboardList },
  { id: 'logs', label: 'Log', Icon: History },
  { id: 'profile', label: 'Profil', Icon: UserRound },
]

const desktopTabItems = tabItems.filter((tab) => tab.id !== 'profile')

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Periksa koneksi, lalu coba lagi.'
}

function MitraPortal() {
  const { user, logout, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<MitraTab>('stocks')
  const [editedStocks, setEditedStocks] = useState<Record<string, number>>({})
  const [orderItems, setOrderItems] = useState<DraftOrderItem[]>([])
  const [skippedProductIds, setSkippedProductIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [orderNote, setOrderNote] = useState('')

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'mitra')) {
      void navigate({ to: '/login' })
    }
  }, [authLoading, navigate, user])

  const stocksQuery = useQuery<StockItem[]>({
    queryKey: ['mitra-stocks'],
    queryFn: async () => {
      const response = await api.stocks.get({ query: {} })
      return unwrapData<StockItem[]>(response, 'Stok cabang belum dapat dimuat')
    },
    enabled: user?.role === 'mitra',
  })

  const ordersQuery = useQuery<Order[]>({
    queryKey: ['mitra-orders'],
    queryFn: async () => {
      const response = await api.orders.get({ query: {} })
      return unwrapData<Order[]>(response, 'Pesanan belum dapat dimuat')
    },
    enabled: user?.role === 'mitra',
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  })

  const centralProductsQuery = useQuery<Product[]>({
    queryKey: ['central-products'],
    queryFn: async () => {
      const response = await api.products.get()
      return unwrapData<Product[]>(
        response,
        'Stok gudang pusat belum dapat dimuat',
      )
    },
    enabled: user?.role === 'mitra',
    refetchInterval: 10_000,
  })

  const logsQuery = useQuery<StockLog[]>({
    queryKey: ['mitra-stock-logs'],
    queryFn: async () => {
      const response = await api.stocks.logs.get({ query: {} })
      return unwrapData<StockLog[]>(response, 'Log stok belum dapat dimuat')
    },
    enabled: user?.role === 'mitra',
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  })

  useEffect(() => {
    if (!stocksQuery.data) return
    setEditedStocks(
      Object.fromEntries(
        stocksQuery.data.map((stock) => [stock.product_id, stock.current_qty]),
      ),
    )
  }, [stocksQuery.data])

  const changedStocks = useMemo(
    () =>
      (stocksQuery.data ?? []).filter(
        (stock) => editedStocks[stock.product_id] !== stock.current_qty,
      ),
    [editedStocks, stocksQuery.data],
  )

  const updateStocks = useMutation({
    mutationFn: async () => {
      const response = await api.stocks.put({
        items: changedStocks.map((stock) => ({
          product_id: stock.product_id,
          current_qty: editedStocks[stock.product_id],
        })),
      })
      if (response.error) throw apiError(response.error, 'Stok belum tersimpan')
      return response.data
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mitra-stocks'] }),
        queryClient.invalidateQueries({ queryKey: ['mitra-stock-logs'] }),
      ])
      toast.success('Stok tersimpan')
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })

  const createOrder = useMutation({
    mutationFn: async () => {
      const response = await api.orders.post({
        note: orderNote.trim() || undefined,
        items: orderItems.map((item) => ({
          product_id: item.product_id,
          qty_requested: item.qty,
        })),
      })
      if (response.error) {
        throw apiError(response.error, 'Pesanan belum dapat diajukan')
      }
      return response.data
    },
    onSuccess: async () => {
      toast.success('Restock diajukan')
      setOrderItems([])
      setSkippedProductIds(new Set())
      setOrderNote('')
      setActiveTab('history')
      await queryClient.invalidateQueries({ queryKey: ['mitra-orders'] })
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })

  const confirmReceived = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await api.orders({ id: orderId }).status.patch({
        status: 'selesai',
      })
      if (response.error) {
        throw apiError(response.error, 'Penerimaan barang belum tercatat')
      }
      return response.data
    },
    onSuccess: async () => {
      toast.success('Barang diterima dan stok ditambahkan')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mitra-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['mitra-stocks'] }),
        queryClient.invalidateQueries({ queryKey: ['mitra-stock-logs'] }),
      ])
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })

  function setStockQty(stock: StockItem, qty: number) {
    setEditedStocks((current) => ({
      ...current,
      [stock.product_id]: Math.max(0, Math.min(stock.par_level, qty)),
    }))
  }

  function addOrderItem(stock: StockItem) {
    setOrderItems((current) => {
      const existing = current.find(
        (item) => item.product_id === stock.product_id,
      )
      if (existing) return current
      return [
        ...current,
        {
          product_id: stock.product_id,
          qty: Math.max(1, stock.par_level - stock.current_qty),
        },
      ]
    })
  }

  function setOrderQty(productId: string, qty: number) {
    setOrderItems((current) =>
      current.map((item) =>
        item.product_id === productId
          ? { ...item, qty: Math.max(1, qty) }
          : item,
      ),
    )
  }

  function setOrderSkipped(productId: string, skipped: boolean) {
    setSkippedProductIds((current) => {
      const next = new Set(current)
      if (skipped) next.add(productId)
      else next.delete(productId)
      return next
    })
    if (skipped) {
      setOrderItems((current) =>
        current.filter((item) => item.product_id !== productId),
      )
    }
  }

  function handleLogout() {
    logout()
    void navigate({ to: '/login' })
  }

  if (authLoading || !user || user.role !== 'mitra') {
    return (
      <main className="grid min-h-screen place-items-center bg-paper">
        <p className="text-sm text-muted" role="status">
          Memeriksa akses mitra...
        </p>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-paper pb-24 text-text md:pb-8">
      <header className="sticky top-0 z-20 border-b border-line bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {user.partner_photo ? (
                <img
                  src={user.partner_photo}
                  alt=""
                  className="size-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-700">
                  <Store className="size-5" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold text-ink-900">
                  {user.partner_name ?? 'Portal mitra'}
                </p>
                <p className="truncate text-sm text-muted">
                  PIC {user.partner_pic_name || user.full_name}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              aria-current={activeTab === 'profile' ? 'page' : undefined}
              className={`hidden min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition md:inline-flex ${
                activeTab === 'profile'
                  ? 'bg-ink-100 text-ink-900 ring-1 ring-ink-200'
                  : 'text-muted hover:bg-ink-50 hover:text-ink-900'
              }`}
            >
              <UserRound className="size-4" aria-hidden="true" />
              <span>Profil</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted hover:bg-ink-50 hover:text-crit-fg"
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
        <nav
          className="mx-auto hidden max-w-4xl gap-1 px-6 md:flex"
          aria-label="Menu mitra"
        >
          {desktopTabItems.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              aria-current={activeTab === id ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${
                activeTab === id
                  ? 'border-ink-700 text-ink-700'
                  : 'border-transparent text-muted hover:text-ink-900'
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {activeTab === 'stocks' ? (
          <StocksPanel
            query={stocksQuery}
            centralProductsQuery={centralProductsQuery}
            editedStocks={editedStocks}
            changedIds={new Set(changedStocks.map((stock) => stock.product_id))}
            onQtyChange={setStockQty}
            onSave={() => updateStocks.mutate()}
            isSaving={updateStocks.isPending}
          />
        ) : null}

        {activeTab === 'order' ? (
          <OrderForm
            stocksQuery={stocksQuery}
            centralProducts={centralProductsQuery.data ?? []}
            orderItems={orderItems}
            skippedProductIds={skippedProductIds}
            note={orderNote}
            onNoteChange={setOrderNote}
            onAdd={addOrderItem}
            onRemove={(productId) =>
              setOrderItems((current) =>
                current.filter((item) => item.product_id !== productId),
              )
            }
            onQtyChange={setOrderQty}
            onSkipChange={setOrderSkipped}
            onSubmit={() => createOrder.mutate()}
            isSubmitting={createOrder.isPending}
          />
        ) : null}

        {activeTab === 'history' ? (
          <OrderHistory
            query={ordersQuery}
            onOpenOrder={() => setActiveTab('order')}
            onConfirm={(orderId) => confirmReceived.mutate(orderId)}
            confirming={confirmReceived.isPending}
            confirmingOrderId={confirmReceived.variables}
          />
        ) : null}

        {activeTab === 'logs' ? (
          <MitraLogsPanel
            query={logsQuery}
            partnerName={user.partner_name ?? 'Mitra Cabang'}
          />
        ) : null}

        {activeTab === 'profile' ? <ProfilePanel user={user} /> : null}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 md:hidden"
        aria-label="Menu mitra"
      >
        {tabItems.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            aria-current={activeTab === id ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-sm text-xs font-semibold ${
              activeTab === id ? 'bg-ink-100 text-ink-700' : 'text-muted'
            }`}
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

interface StocksPanelProps {
  query: ReturnType<typeof useQuery<StockItem[]>>
  centralProductsQuery: ReturnType<typeof useQuery<Product[]>>
  editedStocks: Record<string, number>
  changedIds: Set<string>
  onQtyChange: (stock: StockItem, qty: number) => void
  onSave: () => void
  isSaving: boolean
}

function StocksPanel({
  query,
  centralProductsQuery,
  editedStocks,
  changedIds,
  onQtyChange,
  onSave,
  isSaving,
}: StocksPanelProps) {
  return (
    <section aria-labelledby="stock-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ume">Laporan harian</p>
          <h1
            id="stock-heading"
            className="mt-1 text-2xl font-semibold text-ink-900"
          >
            Sisa stok fisik
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Sesuaikan jumlah dengan stok yang ada di rak, lalu simpan perubahan.
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={changedIds.size === 0 || isSaving}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-ink-700 px-5 text-sm font-semibold text-white hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {changedIds.size > 0
            ? `Simpan ${changedIds.size} perubahan`
            : 'Stok sudah sesuai'}
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-md border border-line bg-white shadow-xs">
        <div className="flex flex-col gap-2 border-b border-line bg-ink-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-ink-900 text-white">
              <Boxes className="size-5 text-ume" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink-900 sm:text-base">
                Stok barang Pusat Daisuki
              </h2>
              <p className="text-xs text-muted">
                Ketersediaan stok siap kirim yang dikelola admin pusat
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center rounded bg-ok/10 px-3 py-1 text-xs font-semibold text-ok-fg">
            Diperbarui otomatis
          </span>
        </div>

        {centralProductsQuery.isLoading ? (
          <div className="p-4 sm:p-5">
            <LoadingState label="Memuat stok gudang pusat..." />
          </div>
        ) : null}
        {centralProductsQuery.isError ? (
          <div className="p-4 sm:p-5">
            <ErrorState
              message={errorMessage(centralProductsQuery.error)}
              onRetry={() => void centralProductsQuery.refetch()}
            />
          </div>
        ) : null}
        {centralProductsQuery.data?.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              title="Stok pusat belum tersedia"
              description="Admin belum mengaktifkan produk untuk gudang pusat."
            />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-5">
          {centralProductsQuery.data?.map((product) => (
            <div
              key={product.id}
              className="rounded-md border border-line bg-paper/50 p-3.5 transition-colors hover:border-ink-400"
            >
              <p
                className="truncate text-xs font-medium text-muted"
                title={product.name}
              >
                {product.name}
              </p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums text-ink-900">
                {product.central_stock.toLocaleString('id-ID')}{' '}
                <span className="text-xs font-normal text-muted">
                  {product.unit}
                </span>
              </p>
              <p
                className={`mt-1 text-[11px] font-semibold ${
                  product.central_stock > 0 ? 'text-ok-fg' : 'text-crit-fg'
                }`}
              >
                {product.central_stock > 0
                  ? 'Stok pusat siap'
                  : 'Stok pusat habis'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {query.isLoading ? <LoadingState label="Memuat stok cabang..." /> : null}
      {query.isError ? (
        <div className="mt-6">
          <ErrorState
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        </div>
      ) : null}
      {query.data?.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Belum ada stok cabang"
            description="Admin perlu menambahkan produk dan kapasitas rak untuk cabang ini."
          />
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {query.data?.map((stock) => {
          const qty = editedStocks[stock.product_id] ?? stock.current_qty
          const percentage = stockPercent(qty, stock.par_level)
          const status = getStockStatus(qty, stock.par_level)
          const changed = changedIds.has(stock.product_id)
          return (
            <article
              key={stock.product_id}
              className="rounded-md border border-line bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-ink-900">
                      {stock.product_name}
                    </h2>
                    {changed ? (
                      <span
                        className="size-2 shrink-0 rounded-full bg-ink-500"
                        aria-label="Jumlah diubah"
                      />
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    Kapasitas {stock.par_level} {stock.product_unit}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StockStatusBadge status={status} />
                  {stock.is_stale ? <StaleBadge /> : null}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <RakBar
                  percentage={percentage}
                  status={status}
                  label={`${stock.product_name}, sisa ${qty} dari ${stock.par_level}, status ${status}`}
                />
                <span className="w-12 text-right text-sm font-semibold tabular-nums text-ink-900">
                  {Math.round(percentage)}%
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
                <label
                  htmlFor={`stock-${stock.product_id}`}
                  className="text-sm font-medium text-muted"
                >
                  Stok sisa
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onQtyChange(stock, qty - 1)}
                    className="grid size-11 place-items-center rounded-md border border-line bg-ink-50 text-ink-900 hover:bg-ink-100"
                    aria-label={`Kurangi ${stock.product_name}`}
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <input
                    id={`stock-${stock.product_id}`}
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={0}
                    max={stock.par_level}
                    value={qty}
                    onChange={(event) =>
                      onQtyChange(
                        stock,
                        Number.parseInt(event.target.value, 10) || 0,
                      )
                    }
                    className="h-11 w-16 rounded-sm border border-line text-center text-lg font-semibold tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => onQtyChange(stock, qty + 1)}
                    className="grid size-11 place-items-center rounded-md border border-line bg-ink-50 text-ink-900 hover:bg-ink-100"
                    aria-label={`Tambah ${stock.product_name}`}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

interface OrderFormProps {
  stocksQuery: ReturnType<typeof useQuery<StockItem[]>>
  centralProducts: Product[]
  orderItems: DraftOrderItem[]
  skippedProductIds: Set<string>
  note: string
  onNoteChange: (value: string) => void
  onAdd: (stock: StockItem) => void
  onRemove: (productId: string) => void
  onQtyChange: (productId: string, qty: number) => void
  onSkipChange: (productId: string, skipped: boolean) => void
  onSubmit: () => void
  isSubmitting: boolean
}

function OrderForm({
  stocksQuery,
  centralProducts,
  orderItems,
  skippedProductIds,
  note,
  onNoteChange,
  onAdd,
  onRemove,
  onQtyChange,
  onSkipChange,
  onSubmit,
  isSubmitting,
}: OrderFormProps) {
  const products = [...(stocksQuery.data ?? [])].sort(
    (a, b) =>
      stockPercent(a.current_qty, a.par_level) -
      stockPercent(b.current_qty, b.par_level),
  )
  const skippedCount = products.filter((stock) =>
    skippedProductIds.has(stock.product_id),
  ).length

  const hasAnyExceeded = orderItems.some((item) => {
    const centralItem = centralProducts.find((p) => p.id === item.product_id)
    const stock = stocksQuery.data?.find((s) => s.product_id === item.product_id)
    const centralQty = centralItem?.central_stock ?? stock?.central_stock
    return centralQty !== undefined && item.qty > centralQty
  })

  return (
    <section aria-labelledby="order-heading">
      <div>
        <p className="text-sm font-semibold text-ume">Restock cabang</p>
        <h1
          id="order-heading"
          className="mt-1 text-2xl font-semibold text-ink-900"
        >
          Ajukan restock barang
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Pilih barang yang diperlukan dan atur jumlahnya. Centang “Tidak perlu
          restock” untuk barang yang ingin dilewati.
        </p>
      </div>

      {stocksQuery.isLoading ? (
        <LoadingState label="Memuat produk cabang..." />
      ) : null}
      {stocksQuery.isError ? (
        <div className="mt-6">
          <ErrorState
            message={errorMessage(stocksQuery.error)}
            onRetry={() => void stocksQuery.refetch()}
          />
        </div>
      ) : null}
      {stocksQuery.data?.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Belum ada produk untuk dipesan"
            description="Produk akan muncul setelah admin menambahkan stok untuk cabang Anda."
          />
        </div>
      ) : null}

      {products.length > 0 ? (
        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-ink-900">Pilih barang</h2>
          <p className="text-xs text-muted">
            Persentase stok terendah ditampilkan lebih dulu
          </p>
        </div>
      ) : null}
      <div className="mt-3 space-y-3">
        {products.map((stock) => {
          const selected = orderItems.find(
            (item) => item.product_id === stock.product_id,
          )
          const centralItem = centralProducts.find(
            (p) => p.id === stock.product_id,
          )
          const centralQty = centralItem?.central_stock ?? stock.central_stock
          const status = getStockStatus(stock.current_qty, stock.par_level)
          const suggestedQty = Math.max(1, stock.par_level - stock.current_qty)
          const skipped = skippedProductIds.has(stock.product_id)
          const isExceeded = Boolean(
            selected &&
              centralQty !== undefined &&
              selected.qty > centralQty,
          )

          return (
            <article
              key={stock.product_id}
              className={`rounded-md border p-4 sm:p-5 transition-colors ${
                isExceeded
                  ? 'border-amber-300 bg-amber-50/25 shadow-2xs'
                  : selected
                    ? 'border-ink-700 bg-ink-50/70'
                    : skipped
                      ? 'border-line bg-ink-50/50'
                      : 'border-line bg-white'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-ink-900">
                    {stock.product_name}
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    Sisa yang Tersedia di toko saya{' '}
                    <strong className="tabular-nums text-ink-900">
                      {stock.current_qty} {stock.product_unit}
                    </strong>
                    <span className="mx-1.5" aria-hidden="true">
                      /
                    </span>
                    target {stock.par_level} {stock.product_unit}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StockStatusBadge status={status} />
                  {selected ? (
                    <button
                      type="button"
                      onClick={() => onRemove(stock.product_id)}
                      className="min-h-11 rounded-md px-3 text-sm font-semibold text-crit-fg hover:bg-crit-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
                      aria-label={`Hapus ${stock.product_name} dari pengajuan`}
                    >
                      Hapus
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 border-t border-line pt-2">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-ink-900">
                  <input
                    type="checkbox"
                    checked={skipped}
                    onChange={(event) =>
                      onSkipChange(stock.product_id, event.target.checked)
                    }
                    className="size-5 shrink-0 accent-ink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
                  />
                  Tidak perlu restock barang ini
                </label>
                {skipped ? (
                  <p className="pb-1 text-xs text-muted">
                    Barang ini dilewati dan tidak masuk pengajuan.
                  </p>
                ) : (
                  <div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-muted">
                        Stok pusat:{' '}
                        {centralQty === undefined ? (
                          'data belum tersedia'
                        ) : (
                          <span
                            className={`tabular-nums ${
                              isExceeded
                                ? 'font-bold text-amber-700'
                                : 'font-semibold text-ink-900'
                            }`}
                          >
                            {centralQty.toLocaleString('id-ID')} {stock.product_unit}
                          </span>
                        )}
                      </p>
                      {selected ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <label
                            htmlFor={`order-${stock.product_id}`}
                            className="text-sm font-medium text-ink-900"
                          >
                            Jumlah diajukan
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              onQtyChange(stock.product_id, selected.qty - 1)
                            }
                            disabled={selected.qty <= 1}
                            className="grid size-11 place-items-center rounded-md border border-line bg-white text-ink-900 hover:bg-ink-100 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
                            aria-label={`Kurangi jumlah ${stock.product_name}`}
                          >
                            <Minus className="size-4" aria-hidden="true" />
                          </button>
                          <input
                            id={`order-${stock.product_id}`}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={selected.qty}
                            onChange={(event) =>
                              onQtyChange(
                                stock.product_id,
                                Number.parseInt(event.target.value, 10) || 1,
                              )
                            }
                            className={`h-11 w-16 rounded-sm border text-center text-base font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 ${
                              isExceeded
                                ? 'border-amber-400 bg-amber-50/70 text-amber-950 ring-1 ring-amber-300 focus-visible:outline-amber-600'
                                : 'border-line bg-white text-ink-900 focus-visible:outline-ink-700'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              onQtyChange(stock.product_id, selected.qty + 1)
                            }
                            className="grid size-11 place-items-center rounded-md border border-line bg-white text-ink-900 hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
                            aria-label={`Tambah jumlah ${stock.product_name}`}
                          >
                            <Plus className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAdd(stock)}
                          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-ink-700 px-3 text-sm font-semibold text-ink-700 hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
                        >
                          <Plus className="size-4" aria-hidden="true" /> Tambah ke
                          pengajuan
                        </button>
                      )}
                    </div>

                    {selected && isExceeded && centralQty !== undefined ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertTriangle
                            className="size-4 shrink-0 text-amber-600"
                            aria-hidden="true"
                          />
                          <span>
                            <strong>Jumlah melebihi stok pusat</strong> (tersedia{' '}
                            <strong>
                              {centralQty} {stock.product_unit}
                            </strong>
                            , diminta{' '}
                            <strong>
                              {selected.qty} {stock.product_unit}
                            </strong>
                            ). Admin dapat menyetujui sebagian.
                          </span>
                        </div>
                        {centralQty > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              onQtyChange(stock.product_id, centralQty)
                            }
                            className="shrink-0 rounded bg-amber-200/90 px-2.5 py-1 text-xs font-bold text-amber-900 hover:bg-amber-300 transition-colors"
                          >
                            Sesuaikan ke {centralQty} {stock.product_unit}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              {!selected && !skipped && stock.par_level > stock.current_qty ? (
                <p className="mt-2 text-xs text-muted">
                  Saran jumlah: {suggestedQty} {stock.product_unit} untuk
                  mencapai target cabang.
                </p>
              ) : null}
            </article>
          )
        })}
      </div>

      <div className="mt-6 rounded-md border border-line bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-ink-900">
          Periksa pengajuan
        </h2>
        {orderItems.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            {skippedCount === products.length && products.length > 0
              ? 'Semua barang dilewati. Tidak ada restock yang perlu diajukan.'
              : 'Belum ada barang dipilih. Tambahkan barang dari daftar di atas untuk mulai mengajukan restock.'}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {orderItems.map((item) => {
              const stock = stocksQuery.data?.find(
                (entry) => entry.product_id === item.product_id,
              )
              const centralItem = centralProducts.find(
                (p) => p.id === item.product_id,
              )
              const centralQty =
                centralItem?.central_stock ?? stock?.central_stock
              const itemExceeded =
                centralQty !== undefined && item.qty > centralQty

              return (
                <li
                  key={item.product_id}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-ink-900">
                      {stock?.product_name ?? 'Produk'}
                    </span>
                    {itemExceeded ? (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                        <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
                        Melebihi stok pusat (sisa {centralQty} {stock?.product_unit})
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 font-semibold tabular-nums ${
                      itemExceeded ? 'text-amber-800 font-bold' : 'text-ink-900'
                    }`}
                  >
                    {item.qty} {stock?.product_unit}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        {hasAnyExceeded ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 animate-in fade-in duration-200">
            <AlertTriangle
              className="size-4 shrink-0 text-amber-600 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <p className="font-bold text-amber-900">
                Peringatan: Kuantitas melebihi stok gudang pusat
              </p>
              <p className="mt-0.5 text-amber-800 leading-relaxed">
                Pengajuan tetap dapat dikirim, namun Admin Daisuki Pusat dapat
                menyetujui kuantitas sebagian sesuai ready stock yang tersedia di
                gudang pusat.
              </p>
            </div>
          </div>
        ) : null}
        {skippedCount > 0 ? (
          <p className="mt-3 text-sm text-muted">
            {skippedCount} barang dilewati dan tidak dikirim dalam pengajuan
            ini.
          </p>
        ) : null}

        <label
          htmlFor="order-note"
          className="mt-5 block text-sm font-semibold text-ink-900"
        >
          Catatan untuk admin{' '}
          <span className="font-normal text-muted">(opsional)</span>
        </label>
        <textarea
          id="order-note"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Contoh: barang dibutuhkan sebelum hari Jumat untuk event"
          className="mt-1.5 min-h-24 w-full resize-y rounded-sm border border-line p-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
          maxLength={500}
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={orderItems.length === 0 || isSubmitting}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-ink-700 px-5 text-sm font-semibold text-white hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700 sm:w-auto"
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <PackagePlus className="size-4" aria-hidden="true" />
          )}
          Kirim pengajuan ({orderItems.length} barang)
        </button>
        <p className="mt-2 text-xs text-muted">
          Admin pusat akan meninjau jumlah yang diajukan. Statusnya dapat
          dilihat di Riwayat pesanan.
        </p>
      </div>
    </section>
  )
}

function OrderHistory({
  query,
  onOpenOrder,
  onConfirm,
  confirming,
  confirmingOrderId,
}: {
  query: ReturnType<typeof useQuery<Order[]>>
  onOpenOrder: () => void
  onConfirm: (orderId: string) => void
  confirming: boolean
  confirmingOrderId?: string
}) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [statusFilter, setStatusFilter] = useState<
    'semua' | 'diproses' | 'disetujui' | 'dalam_pengiriman' | 'selesai' | 'ditolak'
  >('semua')

  const allOrders = query.data ?? []

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'semua') return allOrders
    return allOrders.filter((o) => o.status === statusFilter)
  }, [allOrders, statusFilter])

  return (
    <section aria-labelledby="history-heading" className="animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ume">Riwayat restock</p>
          <h1
            id="history-heading"
            className="mt-1 text-2xl font-semibold text-ink-900 font-display"
          >
            Status pesanan
          </h1>
          <p className="mt-1 text-sm text-muted">
            Pantau status persetujuan kuantitas dari admin pusat dan konfirmasikan
            penerimaan saat barang tiba.
          </p>
        </div>

        {allOrders.length > 0 ? (
          <button
            type="button"
            onClick={onOpenOrder}
            className="mt-2 sm:mt-0 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md bg-ink-900 px-4 text-xs font-semibold text-white shadow-xs hover:bg-ink-700 transition-colors self-start sm:self-auto"
          >
            <PackagePlus className="size-4 text-ume" />
            <span>Ajukan Restock Baru</span>
          </button>
        ) : null}
      </div>

      {query.isLoading ? (
        <div className="mt-6">
          <LoadingState label="Memuat pesanan cabang..." />
        </div>
      ) : null}

      {query.isError ? (
        <div className="mt-6">
          <ErrorState
            message={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        </div>
      ) : null}

      {!query.isLoading && allOrders.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Belum ada pesanan"
            description="Ajukan restock pertama untuk produk yang mulai menipis."
            action={
              <button
                type="button"
                onClick={onOpenOrder}
                className="min-h-11 rounded-md bg-ink-700 px-4 text-sm font-semibold text-white"
              >
                Ajukan restock
              </button>
            }
          />
        </div>
      ) : null}

      {/* Filter Tabs Status Pesanan */}
      {allOrders.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center gap-1.5 border-b border-line pb-3">
          <button
            type="button"
            onClick={() => setStatusFilter('semua')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              statusFilter === 'semua'
                ? 'bg-ink-900 text-white'
                : 'bg-white text-muted hover:bg-paper hover:text-ink-900 border border-line'
            }`}
          >
            Semua ({allOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('diproses')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              statusFilter === 'diproses'
                ? 'bg-ink-900 text-white'
                : 'bg-white text-muted hover:bg-paper hover:text-ink-900 border border-line'
            }`}
          >
            Menunggu Persetujuan (
            {allOrders.filter((o) => o.status === 'diproses').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('disetujui')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              statusFilter === 'disetujui'
                ? 'bg-ink-900 text-white'
                : 'bg-white text-muted hover:bg-paper hover:text-ink-900 border border-line'
            }`}
          >
            Disetujui ({allOrders.filter((o) => o.status === 'disetujui').length}
            )
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('dalam_pengiriman')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              statusFilter === 'dalam_pengiriman'
                ? 'bg-ink-900 text-white'
                : 'bg-white text-muted hover:bg-paper hover:text-ink-900 border border-line'
            }`}
          >
            Dalam Pengiriman (
            {allOrders.filter((o) => o.status === 'dalam_pengiriman').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('selesai')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              statusFilter === 'selesai'
                ? 'bg-ink-900 text-white'
                : 'bg-white text-muted hover:bg-paper hover:text-ink-900 border border-line'
            }`}
          >
            Selesai ({allOrders.filter((o) => o.status === 'selesai').length})
          </button>
        </div>
      ) : null}

      {/* List Riwayat Pesanan */}
      {filteredOrders.length > 0 ? (
        <div className="mt-4 space-y-3">
          {filteredOrders.map((order) => {
            const totalRequested = order.items.reduce(
              (acc, item) => acc + item.qty_requested,
              0,
            )
            const totalApproved = order.items.reduce(
              (acc, item) => acc + (item.qty_approved ?? 0),
              0,
            )
            const isApproved = [
              'disetujui',
              'dalam_pengiriman',
              'selesai',
            ].includes(order.status)

            return (
              <article
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="group relative flex flex-col justify-between gap-3 rounded-lg border border-line bg-white p-4 transition-all duration-200 hover:border-ink-400 hover:shadow-2xs cursor-pointer sm:p-5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base font-bold tabular-nums text-ink-900 group-hover:text-ume transition-colors sm:text-lg">
                        {order.order_no}
                      </span>
                      <OrderStatusBadge status={order.status} />
                      {order.admin_note ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ume/10 px-2 py-0.5 text-[11px] font-semibold text-ume">
                          <MessageSquare className="size-3" />
                          <span>Ada Catatan Admin</span>
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-xs text-muted">
                      Diajukan {formatDetailedDateTime(order.created_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className="inline-flex items-center gap-1 rounded-md border border-line/60 bg-paper px-3 py-1.5 text-xs font-semibold text-ink-800 transition-colors group-hover:bg-ink-100 group-hover:text-ume">
                      <span>Detail Pesanan</span>
                      <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>

                {/* Ringkasan Baris Produk */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5 text-ink-700">
                    <span className="font-semibold text-ink-900">
                      {order.items.length} macam produk:
                    </span>
                    <span className="max-w-[260px] truncate text-muted sm:max-w-md">
                      {order.items.map((i) => i.product_name).join(', ')}
                    </span>
                  </div>

                  <div className="font-medium text-ink-800">
                    {isApproved ? (
                      <span className="font-bold text-ok">
                        Disetujui: {totalApproved} pcs
                      </span>
                    ) : (
                      <span className="text-muted">
                        Diminta: {totalRequested} pcs
                      </span>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : allOrders.length > 0 ? (
        <div className="mt-6 rounded-lg border border-line bg-white p-8 text-center">
          <p className="text-sm font-semibold text-ink-900">
            Tidak ada pesanan dengan status ini
          </p>
          <button
            type="button"
            onClick={() => setStatusFilter('semua')}
            className="mt-3 inline-flex min-h-9 items-center rounded-md border border-line bg-white px-3 text-xs font-semibold text-ink-900 hover:bg-paper"
          >
            Tampilkan Semua Pesanan
          </button>
        </div>
      ) : null}

      {/* Modal Popup Detail Pesanan */}
      {selectedOrder ? (
        <Dialog.Root
          open={Boolean(selectedOrder)}
          onOpenChange={(open) => {
            if (!open) setSelectedOrder(null)
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-xs animate-in fade-in duration-200" />
            <Dialog.Content
              className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-white p-5 shadow-xl animate-in fade-in zoom-in-95 duration-200 focus:outline-hidden sm:p-6"
              aria-describedby="mitra-order-dialog-desc"
            >
              {/* Header Dialog */}
              <div className="flex items-start justify-between border-b border-line pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Dialog.Title className="font-display text-lg font-bold tabular-nums text-ink-900">
                      {selectedOrder.order_no}
                    </Dialog.Title>
                    <OrderStatusBadge status={selectedOrder.status} />
                  </div>
                  <Dialog.Description
                    id="mitra-order-dialog-desc"
                    className="mt-1 text-xs text-muted"
                  >
                    Diajukan pada {formatDetailedDateTime(selectedOrder.created_at)}
                  </Dialog.Description>
                </div>

                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-muted hover:bg-paper hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-ink-700"
                    aria-label="Tutup detail pesanan"
                  >
                    <X className="size-5" />
                  </button>
                </Dialog.Close>
              </div>

              {/* Rincian Produk yang Diminta & Disetujui */}
              <div className="mt-4">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                  Rincian Barang ({selectedOrder.items.length} Item)
                </h4>
                <div className="divide-y divide-line overflow-hidden rounded-md border border-line bg-paper/40">
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-ink-900">
                          {item.product_name}
                        </p>
                        <p className="text-xs font-mono text-muted">
                          {item.product_sku}
                        </p>
                      </div>

                      <div className="text-right">
                        {item.qty_approved !== null ? (
                          <div className="flex flex-col items-end">
                            {item.qty_approved !== item.qty_requested ? (
                              <span className="text-xs text-muted line-through">
                                Diminta {item.qty_requested} {item.product_unit}
                              </span>
                            ) : null}
                            <span className="font-bold tabular-nums text-ok">
                              Disetujui {item.qty_approved} {item.product_unit}
                            </span>
                          </div>
                        ) : (
                          <span className="font-semibold tabular-nums text-ink-700">
                            Diminta {item.qty_requested} {item.product_unit}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Penjelasan / Catatan Admin Pusat */}
              {selectedOrder.admin_note ? (
                <div className="mt-4 rounded-md border border-line bg-ink-50/80 p-3.5 text-sm">
                  <div className="flex items-center gap-2 font-semibold text-ink-900">
                    <MessageSquare className="size-4 text-ume" aria-hidden="true" />
                    <span>Penjelasan / Catatan Admin Pusat:</span>
                  </div>
                  <p className="mt-1.5 font-medium leading-relaxed text-ink-800">
                    "{selectedOrder.admin_note}"
                  </p>
                </div>
              ) : null}

              {/* Alasan Penolakan Admin jika ada */}
              {selectedOrder.status === 'ditolak' &&
              selectedOrder.rejected_reason ? (
                <div className="mt-4 rounded-md border border-crit/30 bg-crit-bg/30 p-3.5 text-sm">
                  <p className="font-semibold text-crit">
                    Alasan penolakan admin:
                  </p>
                  <p className="mt-1 text-ink-800">
                    {selectedOrder.rejected_reason}
                  </p>
                </div>
              ) : null}

              {/* Catatan Cabang saat memesan */}
              {selectedOrder.note ? (
                <p className="mt-3 text-xs text-muted">
                  Catatan dari cabang:{' '}
                  <span className="font-medium text-ink-800">
                    {selectedOrder.note}
                  </span>
                </p>
              ) : null}

              {/* Status Banner & Aksi Pengiriman */}
              <div className="mt-5 border-t border-line pt-4">
                {selectedOrder.status === 'disetujui' ? (
                  <div className="rounded-md bg-ok/10 p-3 text-sm font-medium text-ok-fg">
                    Jumlah barang disetujui admin pusat. Pesanan sedang dipersiapkan untuk pengiriman.
                  </div>
                ) : null}

                {selectedOrder.status === 'dalam_pengiriman' ? (
                  <div className="rounded-md border border-line bg-ink-50 p-4">
                    <div className="flex items-center gap-2 font-semibold text-ink-900 text-sm">
                      <Truck className="size-4 text-order-pengiriman" />
                      <span>Barang Dalam Pengiriman</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Setelah paket tiba di cabang dan kuantitas barang sesuai,
                      konfirmasikan penerimaan untuk menambahkan stok cabang secara otomatis.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onConfirm(selectedOrder.id)
                        setSelectedOrder(null)
                      }}
                      disabled={confirming}
                      className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-ok px-4 text-sm font-semibold text-white shadow-xs hover:bg-ok-fg disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {confirming &&
                      confirmingOrderId === selectedOrder.id ? (
                        <Loader2
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                      )}
                      <span>Konfirmasi Barang Diterima</span>
                    </button>
                  </div>
                ) : null}

                {selectedOrder.status === 'selesai' ? (
                  <div className="rounded-md bg-ok/10 p-3 text-sm font-medium text-ok-fg flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-ok shrink-0" />
                    <span>
                      Pesanan selesai. Barang diterima mitra dan stok cabang sudah bertambah.
                    </span>
                  </div>
                ) : null}

                <div className="mt-4 flex justify-end">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="min-h-10 rounded-md border border-line bg-white px-4 text-xs font-semibold text-ink-900 hover:bg-paper"
                    >
                      Tutup
                    </button>
                  </Dialog.Close>
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ) : null}
    </section>
  )
}

async function prepareProfilePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Pilih foto JPG, PNG, atau WebP.')
  }
  if (file.size > 5_000_000) {
    throw new Error('Ukuran foto asli maksimal 5 MB.')
  }

  let image: ImageBitmap
  try {
    image = await createImageBitmap(file)
  } catch {
    throw new Error('Foto tidak dapat dibuka. Pilih file gambar lain.')
  }
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 320
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Foto belum dapat diproses di perangkat ini.')

    const square = Math.min(image.width, image.height)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, 320, 320)
    context.drawImage(
      image,
      (image.width - square) / 2,
      (image.height - square) / 2,
      square,
      square,
      0,
      0,
      320,
      320,
    )
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
    if (dataUrl.length > 350_000) {
      throw new Error('Foto masih terlalu besar. Pilih foto lain.')
    }
    return dataUrl
  } finally {
    image.close()
  }
}

function ProfilePanel({ user }: { user: User }) {
  const { refreshUser } = useAuth()
  const [name, setName] = useState(user.partner_name ?? '')
  const [picName, setPicName] = useState(
    user.partner_pic_name ?? user.full_name,
  )
  const [phone, setPhone] = useState(user.partner_phone ?? '')
  const [address, setAddress] = useState(user.partner_address ?? '')
  const [photo, setPhoto] = useState<string | null>(user.partner_photo ?? null)
  const [photoError, setPhotoError] = useState('')
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false)

  useEffect(() => {
    setName(user.partner_name ?? '')
    setPicName(user.partner_pic_name ?? user.full_name)
    setPhone(user.partner_phone ?? '')
    setAddress(user.partner_address ?? '')
    setPhoto(user.partner_photo ?? null)
  }, [user])

  const saveProfile = useMutation({
    mutationFn: async () => {
      const response = await api.me.profile.patch({
        name: name.trim(),
        pic_name: picName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        photo_data_url: photo,
      })
      if (response.error) {
        throw apiError(response.error, 'Profil belum tersimpan')
      }
      await refreshUser()
    },
    onSuccess: () => toast.success('Profil mitra tersimpan'),
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })

  async function handlePhotoChange(file: File | undefined) {
    if (!file) return
    setIsProcessingPhoto(true)
    setPhotoError('')
    try {
      setPhoto(await prepareProfilePhoto(file))
    } catch (error) {
      setPhotoError(errorMessage(error))
    } finally {
      setIsProcessingPhoto(false)
    }
  }

  return (
    <section aria-labelledby="profile-heading">
      <p className="text-sm font-semibold text-ume">Data mitra</p>
      <h1
        id="profile-heading"
        className="mt-1 text-2xl font-semibold text-ink-900"
      >
        Profil mitra
      </h1>
      <p className="mt-2 text-sm text-muted">
        Perbarui data cabang yang digunakan untuk pengiriman barang.
      </p>

      <form
        className="mt-6 space-y-5 rounded-md border border-line bg-white p-4 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault()
          saveProfile.mutate()
        }}
      >
        <div className="flex flex-wrap items-center gap-4 border-b border-line pb-5">
          {photo ? (
            <img
              src={photo}
              alt="Foto profil mitra"
              className="size-24 shrink-0 rounded-full border border-line object-cover"
            />
          ) : (
            <span className="grid size-24 shrink-0 place-items-center rounded-full bg-ink-100 text-ink-700">
              <Store className="size-9" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <label
              htmlFor="profile-photo"
              className="block text-sm font-semibold text-ink-900"
            >
              Foto profil
            </label>
            <input
              id="profile-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-describedby={
                photoError ? 'profile-photo-error' : 'profile-photo-help'
              }
              onChange={(event) => {
                void handlePhotoChange(event.target.files?.[0])
                event.target.value = ''
              }}
              className="mt-2 block max-w-full text-sm text-muted file:mr-3 file:min-h-11 file:rounded-md file:border file:border-ink-700 file:bg-white file:px-3 file:text-sm file:font-semibold file:text-ink-700 hover:file:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
            />
            <p id="profile-photo-help" className="mt-2 text-xs text-muted">
              JPG, PNG, atau WebP. Foto akan dipotong persegi dan diperkecil
              otomatis.
            </p>
            {photoError ? (
              <p
                id="profile-photo-error"
                className="mt-2 text-sm text-crit-fg"
                role="alert"
              >
                {photoError}
              </p>
            ) : null}
            {photo ? (
              <button
                type="button"
                onClick={() => {
                  setPhoto(null)
                  setPhotoError('')
                }}
                className="mt-2 min-h-11 text-sm font-semibold text-crit-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
              >
                Hapus foto
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="profile-name"
              className="block text-sm font-semibold text-ink-900"
            >
              Nama mitra
            </label>
            <input
              id="profile-name"
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 h-12 w-full rounded-sm border border-line px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
            />
          </div>
          <div>
            <label
              htmlFor="profile-pic"
              className="block text-sm font-semibold text-ink-900"
            >
              Nama PIC
            </label>
            <input
              id="profile-pic"
              required
              minLength={2}
              maxLength={120}
              value={picName}
              onChange={(event) => setPicName(event.target.value)}
              className="mt-2 h-12 w-full rounded-sm border border-line px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
            />
          </div>
          <div>
            <label
              htmlFor="profile-phone"
              className="block text-sm font-semibold text-ink-900"
            >
              Nomor telepon
            </label>
            <input
              id="profile-phone"
              type="tel"
              inputMode="tel"
              required
              minLength={8}
              maxLength={24}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Contoh: 081234567890"
              className="mt-2 h-12 w-full rounded-sm border border-line px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
            />
          </div>
          <div className="sm:col-span-2">
            <label
              htmlFor="profile-address"
              className="block text-sm font-semibold text-ink-900"
            >
              Alamat
            </label>
            <textarea
              id="profile-address"
              required
              minLength={5}
              maxLength={500}
              rows={4}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="mt-2 w-full resize-y rounded-sm border border-line p-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saveProfile.isPending || isProcessingPhoto}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-ink-700 px-5 text-sm font-semibold text-white hover:bg-ink-900 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700 sm:w-auto"
        >
          {saveProfile.isPending || isProcessingPhoto ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          Simpan profil
        </button>
      </form>
    </section>
  )
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
        ? 'Laporan Fisik'
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

function MitraInsightMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail?: string
}) {
  return (
    <article className="min-w-[50%] flex-1 px-4 py-3 sm:min-w-[25%] sm:px-5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink-900">
        {value}
      </p>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
    </article>
  )
}

interface MitraLogsPanelProps {
  query: ReturnType<typeof useQuery<StockLog[]>>
  partnerName: string
}

function MitraLogsPanel({ query, partnerName }: MitraLogsPanelProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<StockLogBatch | null>(null)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [search, setSearch] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('all')
  const [selectedSource, setSelectedSource] = useState('all')

  const logs = useMemo(() => query.data ?? [], [query.data])

  const totalConsumed = useMemo(
    () => logs.reduce((sum, log) => (log.delta > 0 ? sum + log.delta : sum), 0),
    [logs],
  )

  const totalReceived = useMemo(
    () =>
      logs.reduce(
        (sum, log) => (log.delta < 0 ? sum + Math.abs(log.delta) : sum),
        0,
      ),
    [logs],
  )

  const latestUpdate = logs[0]?.created_at

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset])

  const logsByDate = useMemo(() => {
    const map = new Map<string, StockLog[]>()
    for (const log of logs) {
      const key = toLocalDateStr(log.created_at)
      const list = map.get(key)
      if (list) list.push(log)
      else map.set(key, [log])
    }
    return map
  }, [logs])

  const todayStr = useMemo(() => toLocalDateStr(new Date()), [])

  const activeDateStr = useMemo(() => {
    const currentWeekDates = weekDays.map((d) => toLocalDateStr(d))
    if (selectedDateStr && currentWeekDates.includes(selectedDateStr)) {
      return selectedDateStr
    }
    if (currentWeekDates.includes(todayStr)) {
      return todayStr
    }
    for (let i = currentWeekDates.length - 1; i >= 0; i--) {
      const dStr = currentWeekDates[i]
      if ((logsByDate.get(dStr)?.length ?? 0) > 0) {
        return dStr
      }
    }
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


  const productOptions = useMemo(() => {
    const names = new Set(logs.map((log) => log.product_name))
    return Array.from(names).sort()
  }, [logs])

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        search.trim() === '' ||
        log.product_name.toLowerCase().includes(search.toLowerCase())

      const matchesProduct =
        selectedProduct === 'all' || log.product_name === selectedProduct

      const matchesSource =
        selectedSource === 'all' || log.source === selectedSource

      return matchesSearch && matchesProduct && matchesSource
    })
  }, [logs, search, selectedProduct, selectedSource])

  function handleExportCsv() {
    if (!filteredLogs.length) {
      toast.error('Tidak ada catatan log untuk diekspor')
      return
    }

    const headers = [
      'ID',
      'Waktu',
      'Produk',
      'Tipe Aktivitas',
      'Stok Sebelum',
      'Stok Sesudah',
      'Perubahan (Delta)',
    ]

    const rows = filteredLogs.map((log) => {
      const sourceLabel =
        log.source === 'manual_update'
          ? 'Laporan stok mitra'
          : log.source === 'order_received'
            ? 'Pesanan diterima'
            : 'Penyesuaian'
      const deltaText =
        log.delta > 0
          ? `-${log.delta}`
          : log.delta < 0
            ? `+${Math.abs(log.delta)}`
            : '0'

      return [
        log.id,
        `"${formatDetailedDateTime(log.created_at)}"`,
        `"${log.product_name.replace(/"/g, '""')}"`,
        `"${sourceLabel}"`,
        log.qty_before,
        log.qty_after,
        deltaText,
      ]
    })

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const fileName = `log_stok_${partnerName.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`

    link.setAttribute('href', url)
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('File CSV berhasil diunduh')
  }

  const totalDayConsumed = activeDateLogs.reduce(
    (sum, l) => (l.delta > 0 ? sum + l.delta : sum),
    0,
  )
  const totalDayRestocked = activeDateLogs.reduce(
    (sum, l) => (l.delta < 0 ? sum + Math.abs(l.delta) : sum),
    0,
  )

  return (
    <section aria-labelledby="mitra-logs-title" className="space-y-6 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ume">Data Science & Log Stok</p>
          <h1
            id="mitra-logs-title"
            className="mt-1 font-display text-2xl font-semibold text-ink-900"
          >
            Riwayat Log Stok Cabang
          </h1>
          <p className="mt-1 text-sm text-muted">
            Perkembangan laporan stok fisik dan riwayat konsumsi cabang Anda.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filteredLogs.length === 0}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="size-4" aria-hidden="true" />
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 -mt-3">
        <p className="inline-flex items-center gap-1.5 text-xs text-muted">
          <Clock className="size-3.5" aria-hidden="true" />
          Riwayat mutasi stok cabang · otomatis tersinkronisasi khusus cabang Anda
        </p>

        {/* View Mode Toggle */}
        <div className="flex items-center rounded-md border border-line bg-white p-0.5 text-xs font-semibold shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors ${
              viewMode === 'calendar'
                ? 'bg-ink-900 text-white shadow-2xs'
                : 'text-muted hover:text-ink-900'
            }`}
          >
            <Calendar className="size-3.5" aria-hidden="true" />
            <span>Kalender & Jam</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 transition-colors ${
              viewMode === 'list'
                ? 'bg-ink-900 text-white shadow-2xs'
                : 'text-muted hover:text-ink-900'
            }`}
          >
            <Clock className="size-3.5" aria-hidden="true" />
            <span>Semua Log</span>
          </button>
        </div>
      </div>

      {query.isError ? (
        <ErrorState
          message={errorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      <div className="flex flex-wrap divide-y divide-line rounded-md border border-line bg-white shadow-xs sm:divide-x sm:divide-y-0">
        <MitraInsightMetric
          label="Total Log Tercatat"
          value={query.isLoading ? '…' : logs.length}
          detail="Seluruh riwayat perubahan stok"
        />
        <MitraInsightMetric
          label="Total Unit Terjual/Keluar"
          value={query.isLoading ? '…' : `${totalConsumed} pcs`}
          detail="Konsumsi dari laporan stok fisik"
        />
        <MitraInsightMetric
          label="Total Restock Masuk"
          value={query.isLoading ? '…' : `${totalReceived} pcs`}
          detail="Barang diterima dari pesanan selesai"
        />
        <MitraInsightMetric
          label="Laporan Terakhir"
          value={
            query.isLoading
              ? '…'
              : latestUpdate
                ? new Date(latestUpdate).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'
          }
          detail={latestUpdate ? formatDetailedDateTime(latestUpdate) : 'Belum ada data'}
        />
      </div>

      {query.isLoading ? (
        <div className="rounded-md border border-line bg-white p-12 shadow-xs">
          <LoadingState label="Memuat riwayat log perubahan..." />
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-md border border-line bg-white p-8 shadow-xs">
          <EmptyState
            title="Belum ada riwayat perubahan"
            description="Catatan perubahan stok fisik harian dan konfirmasi penerimaan pesanan restock akan otomatis tercatat di sini."
          />
        </div>
      ) : viewMode === 'calendar' ? (
        /* ALUR KALENDER MINGGUAN + 7 HARI + JAM-JAM PERUBAHAN */
        <div className="space-y-4">
          {/* Navigasi Minggu (< dan >) */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-white p-3 shadow-2xs">
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
                className="inline-flex items-center rounded-md border border-line bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100 hover:text-ink-900"
              >
                Kembali ke Minggu Ini
              </button>
            ) : null}
          </div>

          {/* Grid 7 Hari (Senin sampai Minggu) */}
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
                  className={`group relative flex flex-col items-center justify-between rounded-md border p-2 text-center transition-all focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink-700 sm:p-2.5 ${
                    isSelected
                      ? 'border-ink-900 bg-ink-900 text-white shadow-sm ring-2 ring-ink-900/20'
                      : count > 0
                        ? 'border-line bg-white text-ink-900 hover:border-ink-400 hover:bg-ink-50/80'
                        : 'border-line/70 bg-ink-50/40 text-muted hover:border-line hover:bg-ink-50'
                  }`}
                >
                  <span
                    className={`text-[11px] font-semibold sm:text-xs ${
                      isSelected ? 'text-white/90' : 'text-muted'
                    }`}
                  >
                    <span className="sm:hidden">{dayNameShort}</span>
                    <span className="hidden sm:inline">{dayNameFull}</span>
                  </span>

                  <span
                    className={`my-1 font-display text-base font-bold tabular-nums sm:text-lg ${
                      isSelected ? 'text-white' : 'text-ink-900'
                    }`}
                  >
                    {dayNumber}
                  </span>

                  <div className="flex items-center gap-1">
                    {count > 0 ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-ok-bg text-ok-fg'
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            isSelected ? 'bg-white' : 'bg-ok'
                          }`}
                        />
                        {count} log
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] ${
                          isSelected ? 'text-white/60' : 'text-muted/60'
                        }`}
                      >
                        —
                      </span>
                    )}
                  </div>

                  {isToday ? (
                    <span
                      className={`absolute -top-1.5 right-1 rounded-sm px-1 text-[8px] font-bold uppercase tracking-wider ${
                        isSelected
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

          {/* Panel Detail Hari Terpilih & Jam-Jam Perubahan */}
          <div className="rounded-md border border-line bg-white p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col gap-2 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-ink-700" aria-hidden="true" />
                  <h2 className="font-display text-base font-bold text-ink-900">
                    {formatDayDate(activeDateObj)}
                  </h2>
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
                  description={`Tidak ada perubahan stok fisik atau penerimaan barang pada ${formatDayDate(activeDateObj)}.`}
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
                            className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-[11px] font-semibold ${
                              batch.source === 'order_received'
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

          <BatchDetailModal
            batch={selectedBatch}
            partnerName={partnerName}
            dateLabel={formatDayDate(activeDateObj)}
            open={Boolean(selectedBatch)}
            onOpenChange={(isOpen) => {
              if (!isOpen) setSelectedBatch(null)
            }}
          />
        </div>
      ) : (
        /* SEMUA LOG: Flat list dengan filter dan pencarian */
        <div className="overflow-hidden rounded-md border border-line bg-white shadow-xs">
          <div className="flex flex-col gap-3 border-b border-line bg-ink-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-ink-900">
                  Daftar Semua Catatan Log
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-bg px-2 py-0.5 text-[11px] font-medium text-ok-fg">
                  <span className="size-1.5 animate-pulse rounded-full bg-ok" />
                  Live Sync
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Menampilkan {filteredLogs.length} dari {logs.length} catatan log
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-44 flex-1 sm:w-52 sm:flex-none">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari produk..."
                  className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-xs text-ink-900 placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink-700"
                />
              </div>

              {productOptions.length > 1 ? (
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="h-10 rounded-md border border-line bg-white px-3 text-xs text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink-700"
                  aria-label="Filter berdasarkan produk"
                >
                  <option value="all">Semua Produk</option>
                  {productOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : null}

              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="h-10 rounded-md border border-line bg-white px-3 text-xs text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink-700"
                aria-label="Filter berdasarkan tipe aktivitas"
              >
                <option value="all">Semua Tipe</option>
                <option value="manual_update">Laporan Stok Fisik</option>
                <option value="order_received">Pesanan Diterima (Restock)</option>
              </select>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="Tidak ada log yang cocok"
                description="Coba ubah kata kunci pencarian atau reset filter untuk melihat catatan log lainnya."
              />
            </div>
          ) : (
            <div className="divide-y divide-line">
              {filteredLogs.map((log) => {
                const isConsumption = log.delta > 0
                const isRestock = log.delta < 0
                const sourceLabel =
                  log.source === 'manual_update'
                    ? 'Laporan stok mitra'
                    : log.source === 'order_received'
                      ? 'Pesanan diterima'
                      : 'Penyesuaian stok'

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
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${
                            log.source === 'order_received'
                              ? 'bg-ok-bg text-ok-fg'
                              : 'bg-ink-100 text-ink-700'
                          }`}
                        >
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
                        className={`min-w-16 rounded px-2 py-1 text-center text-xs font-bold tabular-nums ${
                          isConsumption
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
          )}
        </div>
      )}
    </section>
  )
}


