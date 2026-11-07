import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getOrders, getProducts, getStockLogs, getStocks } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useInventoryEvents } from '@/lib/inventory-events'
import type { Order, Product, StockItem, StockLog } from '@/lib/inventory-types'

export const Route = createFileRoute('/mitra')({ component: MitraDashboard })

type MitraTab = 'stocks' | 'orders' | 'products' | 'logs'

const tabs: Array<{ id: MitraTab; label: string }> = [
  { id: 'stocks', label: 'Stok cabang' },
  { id: 'orders', label: 'Pesanan' },
  { id: 'products', label: 'Stok gudang pusat' },
  { id: 'logs', label: 'Riwayat stok' },
]

function QueryState({ query, empty }: { query: UseQueryResult<unknown>; empty: boolean }) {
  if (query.isPending) return <p role="status" className="text-sm text-muted-foreground">Memuat data...</p>
  if (query.isError) return <p role="alert" className="text-sm text-crit-fg">{query.error.message}</p>
  if (empty) return <p className="text-sm text-muted-foreground">Belum ada data.</p>
  return null
}

function MitraDashboard() {
  const { user, isLoading, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<MitraTab>('stocks')
  const enabled = Boolean(user && user.role === 'mitra')

  useInventoryEvents(Boolean(user && user.role === 'mitra'), 'mitra')

  useEffect(() => {
    if (!isLoading && !enabled) void navigate({ to: '/login' })
  }, [enabled, isLoading, navigate])

  const stocks = useQuery<StockItem[]>({
    queryKey: ['mitra-stocks'],
    queryFn: () => getStocks(),
    enabled: enabled && tab === 'stocks',
    staleTime: Infinity,
    refetchOnMount: false,
  })
  const orders = useQuery<Order[]>({
    queryKey: ['mitra-orders'],
    queryFn: () => getOrders(),
    enabled: enabled && tab === 'orders',
    staleTime: Infinity,
    refetchOnMount: false,
  })
  const products = useQuery<Product[]>({
    queryKey: ['central-products'],
    queryFn: () => getProducts(),
    enabled: enabled && tab === 'products',
    staleTime: Infinity,
    refetchOnMount: false,
  })
  const logs = useQuery<StockLog[]>({
    queryKey: ['mitra-stock-logs'],
    queryFn: () => getStockLogs(),
    enabled: enabled && tab === 'logs',
    staleTime: Infinity,
    refetchOnMount: false,
  })

  if (isLoading || !enabled) return <main className="grid min-h-dvh place-items-center bg-background" role="status">Memuat portal mitra...</main>

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Mitra Daisuki</p>
            <h1 className="font-display text-3xl font-bold">{user?.partner_name || 'Stok cabang'}</h1>
          </div>
          <button className="min-h-11 rounded-md border border-border px-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => { void logout().then(() => navigate({ to: '/login' })) }}>Keluar</button>
        </header>
        <nav aria-label="Portal mitra" className="mb-6 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={tab === item.id ? 'page' : undefined} className={`min-h-11 rounded-md px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${tab === item.id ? 'bg-primary text-primary-foreground' : 'border border-border bg-card'}`}>
              {item.label}
            </button>
          ))}
        </nav>
        <section className="rounded-lg border border-border bg-card p-4 sm:p-6" aria-live="polite">
          <h2 className="mb-4 font-display text-xl font-bold">{tabs.find((item) => item.id === tab)?.label}</h2>
          {tab === 'stocks' && <>
            <QueryState query={stocks} empty={stocks.data?.length === 0} />
            <ul className="grid gap-3 sm:grid-cols-2">
              {stocks.data?.map((stock) => <li key={stock.product_id} className="rounded-md border border-border p-4"><span className="block font-semibold">{stock.product_name}</span><span className="num text-2xl font-bold">{stock.current_qty} pcs</span><span className="mt-1 block text-sm text-muted-foreground">Buffer minimal {stock.par_level} pcs</span></li>)}
            </ul>
          </>}
          {tab === 'orders' && <>
            <QueryState query={orders} empty={orders.data?.length === 0} />
            <ul className="space-y-3">
              {orders.data?.map((order) => <li key={order.id} className="rounded-md border border-border p-4"><div className="flex flex-wrap justify-between gap-2"><strong className="num">{order.order_no}</strong><span>{order.status_label}</span></div><p className="mt-2 text-sm text-muted-foreground">{order.items.map((item) => `${item.product_name}: ${item.qty_approved ?? item.qty_requested} pcs`).join(', ')}</p></li>)}
            </ul>
          </>}
          {tab === 'products' && <>
            <QueryState query={products} empty={products.data?.length === 0} />
            <ul className="grid gap-3 sm:grid-cols-2">
              {products.data?.map((product) => <li key={product.id} className="rounded-md border border-border p-4"><span className="block font-semibold">{product.name}</span><span className="num text-2xl font-bold">{product.central_stock} pcs</span></li>)}
            </ul>
          </>}
          {tab === 'logs' && <>
            <QueryState query={logs} empty={logs.data?.length === 0} />
            <ul className="space-y-3">
              {logs.data?.map((log) => <li key={log.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-3"><span>{log.product_name}</span><span className="num">{log.qty_before} → {log.qty_after} pcs</span></li>)}
            </ul>
          </>}
        </section>
      </div>
    </main>
  )
}
