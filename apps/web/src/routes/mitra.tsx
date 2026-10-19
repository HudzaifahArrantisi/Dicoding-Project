import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Boxes,
  CheckCircle2,
  ClipboardList,
  Loader2,
  LogOut,
  MessageSquare,
  Minus,
  PackagePlus,
  Plus,
  Save,
  Store,
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
import { useAuth } from '@/lib/auth'
import type { Order, Product, StockItem } from '@/lib/inventory-types'

export const Route = createFileRoute('/mitra')({ component: MitraPortal })

type MitraTab = 'stocks' | 'order' | 'history'
type DraftOrderItem = { product_id: string; qty: number }

const tabItems: Array<{
  id: MitraTab
  label: string
  Icon: typeof Store
}> = [
  { id: 'stocks', label: 'Stok', Icon: Store },
  { id: 'order', label: 'Pesan', Icon: PackagePlus },
  { id: 'history', label: 'Riwayat pesanan', Icon: ClipboardList },
]

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
      await queryClient.invalidateQueries({ queryKey: ['mitra-stocks'] })
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
            <p className="truncate font-display text-lg font-semibold text-ink-900">
              {user.partner_name ?? 'Portal mitra'}
            </p>
            <p className="truncate text-sm text-muted">PIC {user.full_name}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted hover:bg-ink-50 hover:text-crit-fg"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Keluar
          </button>
        </div>
        <nav
          className="mx-auto hidden max-w-4xl gap-1 px-6 md:flex"
          aria-label="Menu mitra"
        >
          {tabItems.map(({ id, label, Icon }) => (
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
            centralProducts={centralProductsQuery.data ?? []}
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
            note={orderNote}
            onNoteChange={setOrderNote}
            onAdd={addOrderItem}
            onAddAll={(stocks) => {
              setOrderItems(
                stocks.map((stock) => ({
                  product_id: stock.product_id,
                  qty: Math.max(
                    10,
                    stock.par_level - stock.current_qty > 0
                      ? stock.par_level - stock.current_qty
                      : 40,
                  ),
                })),
              )
            }}
            onRemove={(productId) =>
              setOrderItems((current) =>
                current.filter((item) => item.product_id !== productId),
              )
            }
            onQtyChange={setOrderQty}
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
          />
        ) : null}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 md:hidden"
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
  centralProducts: Product[]
  editedStocks: Record<string, number>
  changedIds: Set<string>
  onQtyChange: (stock: StockItem, qty: number) => void
  onSave: () => void
  isSaving: boolean
}

function StocksPanel({
  query,
  centralProducts,
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

      {/* Kartu Informasi Stok Gudang Daisuki Pusat (Realtime) */}
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
                Ketersediaan stok siap kirim dari kantor pusat untuk seluruh cabang mitra
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-ok/10 px-3 py-1 text-xs font-semibold text-ok-fg">
            <span
              className="size-2 rounded-full bg-ok animate-pulse"
              aria-hidden="true"
            />
            Live Gudang Pusat
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-5">
          {(centralProducts.length > 0
            ? centralProducts
            : [
                {
                  id: '1',
                  sku: 'DSK-SB-001',
                  name: 'Seblak Jadul Instan',
                  unit: 'pcs',
                  central_stock: 1000,
                },
                {
                  id: '2',
                  sku: 'DSK-BR-002',
                  name: 'Basreng Daun Jeruk',
                  unit: 'pcs',
                  central_stock: 1000,
                },
                {
                  id: '3',
                  sku: 'DSK-MK-003',
                  name: 'Makaroni Daun Jeruk',
                  unit: 'pcs',
                  central_stock: 1000,
                },
                {
                  id: '4',
                  sku: 'DSK-KP-004',
                  name: 'Keripik Pisang Rasa Coklat',
                  unit: 'pcs',
                  central_stock: 1000,
                },
              ]
          ).map((product) => (
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
                {(product.central_stock ?? 1000).toLocaleString('id-ID')}{' '}
                <span className="text-xs font-normal text-muted">
                  {product.unit}
                </span>
              </p>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-ok-fg">
                <span>✓</span> Stok pusat siap
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
                    {stock.product_sku} · Kapasitas {stock.par_level}{' '}
                    {stock.product_unit}
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
  note: string
  onNoteChange: (value: string) => void
  onAdd: (stock: StockItem) => void
  onAddAll: (stocks: StockItem[]) => void
  onRemove: (productId: string) => void
  onQtyChange: (productId: string, qty: number) => void
  onSubmit: () => void
  isSubmitting: boolean
}

function OrderForm({
  stocksQuery,
  centralProducts,
  orderItems,
  note,
  onNoteChange,
  onAdd,
  onAddAll,
  onRemove,
  onQtyChange,
  onSubmit,
  isSubmitting,
}: OrderFormProps) {
  return (
    <section aria-labelledby="order-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ume">Restock cabang</p>
          <h1
            id="order-heading"
            className="mt-1 text-2xl font-semibold text-ink-900"
          >
            Ajukan kebutuhan barang
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Pilih produk dan tentukan jumlah yang dibutuhkan cabang. Ketersediaan
            stok gudang pusat dapat dipantau langsung di bawah ini.
          </p>
        </div>
        {stocksQuery.data && stocksQuery.data.length > 0 ? (
          <button
            type="button"
            onClick={() => onAddAll(stocksQuery.data ?? [])}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-700"
          >
            <PackagePlus className="size-4 text-ume" aria-hidden="true" />
            Pilih Semua ({stocksQuery.data.length} Produk)
          </button>
        ) : null}
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

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {stocksQuery.data?.map((stock) => {
          const selected = orderItems.some(
            (item) => item.product_id === stock.product_id,
          )
          const centralItem = centralProducts.find(
            (p) => p.id === stock.product_id,
          )
          const centralQty =
            centralItem?.central_stock ?? stock.central_stock ?? 1000

          return (
            <article
              key={stock.product_id}
              className={`flex items-center justify-between gap-3 rounded-md border p-4 transition-all ${selected ? 'border-ink-500 bg-ink-50' : 'border-line bg-white'}`}
            >
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-ink-900">
                  {stock.product_name}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                  <span>
                    Sisa Toko:{' '}
                    <strong className="tabular-nums text-ink-900">
                      {stock.current_qty}/{stock.par_level}
                    </strong>{' '}
                    {stock.product_unit}
                  </span>
                  <span>•</span>
                  <span>
                    Gudang Pusat:{' '}
                    <strong className="tabular-nums text-ok-fg">
                      {centralQty.toLocaleString('id-ID')}
                    </strong>{' '}
                    {stock.product_unit}
                  </span>
                </div>
              </div>
              {selected ? (
                <button
                  type="button"
                  onClick={() => onRemove(stock.product_id)}
                  className="min-h-11 shrink-0 rounded-md px-3 text-sm font-semibold text-crit-fg hover:bg-crit-bg"
                >
                  Hapus
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onAdd(stock)}
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-ink-700 px-3 text-sm font-semibold text-ink-700 hover:bg-ink-100"
                >
                  <Plus className="size-4" aria-hidden="true" /> Pilih
                </button>
              )}
            </article>
          )
        })}
      </div>

      <div className="mt-6 rounded-md border border-line bg-white p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-ink-900">
          Rincian pengajuan
        </h2>
        {orderItems.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Belum ada produk dipilih"
              description="Pilih produk di atas untuk menyiapkan pengajuan restock."
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {orderItems.map((item) => {
              const stock = stocksQuery.data?.find(
                (entry) => entry.product_id === item.product_id,
              )
              return (
                <div
                  key={item.product_id}
                  className="flex flex-col gap-3 border-b border-line pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-ink-900">
                      {stock?.product_name ?? 'Produk'}
                    </p>
                    <p className="text-xs text-muted">
                      {stock?.product_sku} · Sisa toko {stock?.current_qty ?? 0}{' '}
                      {stock?.product_unit}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onQtyChange(item.product_id, item.qty - 1)}
                      className="grid size-11 place-items-center rounded-md border border-line bg-ink-50 text-ink-900 hover:bg-ink-100"
                      aria-label={`Kurangi jumlah ${stock?.product_name ?? 'produk'}`}
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </button>
                    <label
                      className="sr-only"
                      htmlFor={`order-${item.product_id}`}
                    >
                      Jumlah {stock?.product_name ?? 'produk'}
                    </label>
                    <input
                      id={`order-${item.product_id}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={item.qty}
                      onChange={(event) =>
                        onQtyChange(
                          item.product_id,
                          Number.parseInt(event.target.value, 10) || 1,
                        )
                      }
                      className="h-11 w-20 rounded-sm border border-line text-center text-base font-semibold tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => onQtyChange(item.product_id, item.qty + 1)}
                      className="grid size-11 place-items-center rounded-md border border-line bg-ink-50 text-ink-900 hover:bg-ink-100"
                      aria-label={`Tambah jumlah ${stock?.product_name ?? 'produk'}`}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

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
          className="mt-1.5 min-h-24 w-full resize-y rounded-sm border border-line p-3 text-base"
          maxLength={500}
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={orderItems.length === 0 || isSubmitting}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-ink-700 px-5 text-sm font-semibold text-white hover:bg-ink-900 disabled:opacity-50 sm:w-auto"
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <PackagePlus className="size-4" aria-hidden="true" />
          )}
          Ajukan restock ({orderItems.length} produk)
        </button>
      </div>
    </section>
  )
}

function OrderHistory({
  query,
  onOpenOrder,
  onConfirm,
  confirming,
}: {
  query: ReturnType<typeof useQuery<Order[]>>
  onOpenOrder: () => void
  onConfirm: (orderId: string) => void
  confirming: boolean
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
                    <span className="ml-2 text-xs text-muted">
                      ({item.product_sku})
                    </span>
                  </div>
                  <div className="text-right">
                    {item.qty_approved !== null &&
                    item.qty_approved !== undefined ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted line-through">
                          Diminta {item.qty_requested} {item.product_unit}
                        </span>
                        <span className="font-bold tabular-nums text-ok-fg">
                          Disetujui: {item.qty_approved} {item.product_unit}
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

            {order.note ? (
              <p className="mt-2 text-xs text-muted">
                Catatan cabang: {order.note}
              </p>
            ) : null}

            {order.status === 'disetujui' ? (
              <div className="mt-3 rounded-md bg-ok/10 p-3 text-xs text-ok-fg">
                ✓ Pesanan telah disetujui pusat dengan rincian kuantitas di atas.
                Menunggu pengiriman kurir.
              </div>
            ) : null}

            {order.status === 'dalam_pengiriman' ? (
              <button
                type="button"
                onClick={() => onConfirm(order.id)}
                disabled={confirming}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-ok px-4 text-sm font-semibold text-white hover:bg-ok-fg disabled:opacity-50 sm:w-auto"
              >
                {confirming ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                )}
                Konfirmasi barang diterima
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
