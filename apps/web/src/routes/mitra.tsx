import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Boxes,
  CheckCircle2,
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
  UserRound,
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
                Stok Gudang Daisuki Pusat (Realtime)
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

          return (
            <article
              key={stock.product_id}
              className={`rounded-md border p-4 sm:p-5 ${selected ? 'border-ink-700 bg-ink-50/70' : skipped ? 'border-line bg-ink-50/50' : 'border-line bg-white'}`}
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
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted">
                      Stok pusat:{' '}
                      {centralQty === undefined
                        ? 'data belum tersedia'
                        : `${centralQty.toLocaleString('id-ID')} ${stock.product_unit}`}
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
                          className="h-11 w-16 rounded-sm border border-line bg-white text-center text-base font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
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
              return (
                <li
                  key={item.product_id}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <span className="min-w-0 font-medium text-ink-900">
                    {stock?.product_name ?? 'Produk'}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-ink-900">
                    {item.qty} {stock?.product_unit}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
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
  return (
    <section aria-labelledby="history-heading">
      <p className="text-sm font-semibold text-ume">Riwayat restock</p>
      <h1
        id="history-heading"
        className="mt-1 text-2xl font-semibold text-ink-900"
      >
        Status pesanan
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Pantau status persetujuan kuantitas dari admin pusat dan konfirmasikan
        penerimaan saat barang tiba.
      </p>
      {query.isLoading ? (
        <LoadingState label="Memuat pesanan cabang..." />
      ) : null}
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
      <div className="mt-6 space-y-4">
        {query.data?.map((order) => (
          <article
            key={order.id}
            className="rounded-md border border-line bg-white p-4 sm:p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-display text-lg font-semibold tabular-nums text-ink-900">
                  {order.order_no}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Diajukan{' '}
                  {new Date(order.created_at).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>

            <ul className="mt-4 divide-y divide-line border-y border-line">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-4 py-2.5 text-sm"
                >
                  <div>
                    <span className="font-medium text-ink-900">
                      {item.product_name}
                    </span>
                  </div>
                  <div className="text-right">
                    {item.qty_approved !== null ? (
                      <div className="flex flex-wrap justify-end gap-x-2 gap-y-1">
                        {item.qty_approved !== item.qty_requested ? (
                          <span className="text-xs text-muted line-through">
                            Diminta {item.qty_requested} {item.product_unit}
                          </span>
                        ) : null}
                        <span className="font-bold tabular-nums text-ok-fg">
                          Disetujui {item.qty_approved} {item.product_unit}
                        </span>
                      </div>
                    ) : (
                      <span className="font-semibold tabular-nums text-ink-700">
                        Diminta {item.qty_requested} {item.product_unit}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {order.admin_note ? (
              <div className="mt-3 rounded-md border border-line bg-ink-50/70 p-3.5 text-sm">
                <div className="flex items-center gap-2 font-semibold text-ink-900">
                  <MessageSquare
                    className="size-4 text-ume"
                    aria-hidden="true"
                  />
                  <span>Penjelasan / Catatan Admin Pusat:</span>
                </div>
                <p className="mt-1 text-ink-800">{order.admin_note}</p>
              </div>
            ) : null}

            {order.status === 'ditolak' && order.rejected_reason ? (
              <div className="mt-3 rounded-md border border-crit/30 bg-crit-bg/30 p-3.5 text-sm">
                <p className="font-semibold text-crit">
                  Alasan penolakan admin
                </p>
                <p className="mt-1 text-ink-800">{order.rejected_reason}</p>
              </div>
            ) : null}

            {order.note ? (
              <p className="mt-2 text-xs text-muted">
                Catatan cabang: {order.note}
              </p>
            ) : null}

            {order.status === 'disetujui' ? (
              <div className="mt-3 rounded-md bg-ok/10 p-3 text-sm text-ok-fg">
                Jumlah barang disetujui admin pusat. Pesanan menunggu
                pengiriman.
              </div>
            ) : null}

            {order.status === 'dalam_pengiriman' ? (
              <div className="mt-4 rounded-md border border-line bg-ink-50 p-4">
                <p className="text-sm font-semibold text-ink-900">
                  Pesanan dalam pengiriman
                </p>
                <p className="mt-1 text-sm text-muted">
                  Setelah barang tiba dan jumlahnya sesuai, tandai pesanan sudah
                  diterima.
                </p>
                <button
                  type="button"
                  onClick={() => onConfirm(order.id)}
                  disabled={confirming}
                  className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-ok px-4 text-sm font-semibold text-white hover:bg-ok-fg disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700 sm:w-auto"
                >
                  {confirming && confirmingOrderId === order.id ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  )}
                  Pesanan sudah diterima
                </button>
              </div>
            ) : null}

            {order.status === 'selesai' ? (
              <p className="mt-4 rounded-md bg-ok/10 p-3 text-sm font-medium text-ok-fg">
                Pesanan selesai. Barang diterima mitra dan stok cabang sudah
                bertambah.
              </p>
            ) : null}
          </article>
        ))}
      </div>
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

      <p className="-mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
        <Clock className="size-3.5" aria-hidden="true" />
        Riwayat mutasi stok cabang · otomatis tersinkronisasi khusus cabang Anda
      </p>

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

      <div className="overflow-hidden rounded-md border border-line bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-line bg-ink-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-ink-900">
                Riwayat Perubahan Stok
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

        {query.isLoading ? (
          <div className="p-8">
            <LoadingState label="Memuat riwayat log perubahan..." />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Belum ada riwayat perubahan"
              description="Catatan perubahan stok fisik harian dan konfirmasi penerimaan pesanan restock akan otomatis tercatat di sini."
            />
          </div>
        ) : filteredLogs.length === 0 ? (
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
    </section>
  )
}

