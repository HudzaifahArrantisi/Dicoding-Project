import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog } from 'radix-ui'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ImagePlus,
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
import { getStockStatus } from '@daisuki/shared'
import { toast } from 'sonner'
import {
  EmptyState, ErrorState,  LoadingState,
} from '@/components/inventory/query-state'
import { RegionPicker, emptyRegion } from '@/components/inventory/region-picker'
import { DeliveryScannerModal } from '@/components/inventory/delivery-scanner-modal'
import { MitraAiAssistant } from '@/components/inventory/mitra-ai-assistant'
import {
  MitraProductTour,
  type MitraTab,
} from '@/components/inventory/mitra-product-tour'
import {
  BatchDetailModal,
  type StockLogBatch,
} from '@/components/inventory/batch-detail-modal'
import {
  OrderStatusBadge,
  StaleBadge,
  StockStatusBadge,
} from '@/components/inventory/status-badge'
import {
  getStocks,
  getOrders,
  getProducts,
  getStockLogs,
  reportDailyStock,
  createOrder as apiCreateOrder,
  confirmOrderReceipt,
  updateOrder as apiUpdateOrder,
  cancelOrder as apiCancelOrder,
  uploadReceiptProof as apiUploadReceiptProof,
  updateProfile,
  resolveImageUrl,
} from '@/lib/api'
import { useInventoryEvents } from '@/lib/inventory-events'
import { useAuth, type User } from '@/lib/auth'
import type { MitraTour } from '@/lib/api/assistant'
import type { Order, Product, StockItem, StockLog } from '@/lib/inventory-types'

export const Route = createFileRoute('/mitra')({ component: MitraPortal })

type DraftOrderItem = { product_id: string; qty: string }

function validOrderQuantity(qty: string): boolean {
  const value = Number(qty)
  return (
    /^\d+$/.test(qty) &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 2_147_483_647
  )
}

const tabItems: Array<{
  id: MitraTab
  label: string
  Icon: typeof Store
}> = [
  { id: 'stocks', label: 'Stok saya', Icon: Store },
  { id: 'order', label: 'Pesan', Icon: PackagePlus },
  { id: 'history', label: 'Lacak', Icon: Truck },
  { id: 'logs', label: 'Log Stok', Icon: History },
  { id: 'profile', label: 'Profil', Icon: UserRound },
]

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    const msg = error.message.trim()
    if (msg && msg !== '[object Object]') return msg
  }
  return 'Periksa koneksi anda, lalu coba lagi'
}

function MitraProfileAvatar({ photo, name }: { photo: string | null | undefined; name: string }) {
  const [imageFailed, setImageFailed] = useState(false)
  const imageUrl = resolveImageUrl(photo)
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toLocaleUpperCase('id-ID') || 'M'

  if (imageUrl && !imageFailed) {
    return (
      <img
        src={imageUrl}
        alt=""
        onError={() => setImageFailed(true)}
        className="size-11 shrink-0 rounded-full border border-line object-cover"
      />
    )
  }

  return (
    <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-ume/10 font-display text-sm font-bold text-ume">
      {initials}
    </span>
  )
}

function MitraPortal() {
  const {
    user,
    logout,
    refreshUser,
    clearSession,
    isLoading: authLoading,
  } = useAuth()
  const refreshUserRef = useRef(refreshUser)
  refreshUserRef.current = refreshUser
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  useInventoryEvents(user?.role === 'mitra', 'mitra')
  const [activeTab, setActiveTab] = useState<MitraTab>('stocks')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const activeIndex = Math.max(
    0,
    tabItems.findIndex((item) => item.id === activeTab),
  )
  const [activeTour, setActiveTour] = useState<MitraTour | null>(null)
  const [deliveryTourStep, setDeliveryTourStep] = useState(-1)
  const [editedStocks, setEditedStocks] = useState<Record<string, number>>({})
  const [orderItems, setOrderItems] = useState<DraftOrderItem[]>([])
  const [skippedProductIds, setSkippedProductIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [orderNote, setOrderNote] = useState('')

  const openTab = useCallback((nextTab: MitraTab) => {
    setActiveTab(nextTab)
    setHoveredIndex(null)
    if (nextTab === 'profile') {
      void refreshUserRef
        .current()
        .catch(() => toast.error('Profil terbaru belum dapat dimuat'))
    }
  }, [])

  const closeTour = useCallback(() => {
    setActiveTour(null)
    setDeliveryTourStep(-1)
  }, [])

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'mitra')) {
      void navigate({ to: '/login' })
    }
  }, [authLoading, navigate, user])

  const stocksQuery = useQuery<StockItem[]>({
    queryKey: ['mitra-stocks'],
    queryFn: () => getStocks(),
    enabled: user?.role === 'mitra',
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  })

  const ordersQuery = useQuery<Order[]>({
    queryKey: ['mitra-orders'],
    queryFn: () => getOrders(),
    enabled: user?.role === 'mitra',
    refetchInterval: (query) => {
      // Jika ada pesanan aktif yang diproses atau dalam perjalanan kurir, polling cepat 4 detik
      const hasActiveOrders = query.state.data?.some(
        (o) => o.status === 'diproses' || o.status === 'dalam_pengiriman',
      )
      return hasActiveOrders ? 4_000 : 10_000
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

  const centralProductsQuery = useQuery<Product[]>({
    queryKey: ['central-products'],
    queryFn: () => getProducts(),
    enabled: user?.role === 'mitra',
  })

  const logsQuery = useQuery<StockLog[]>({
    queryKey: ['mitra-stock-logs'],
    queryFn: () => getStockLogs(),
    enabled: user?.role === 'mitra',
  })

  useEffect(() => {
    const isUnauthorized =
      (stocksQuery.error as { status?: number } | null)?.status === 401 ||
      (ordersQuery.error as { status?: number } | null)?.status === 401 ||
      stocksQuery.error?.message.includes('Unauthorized') ||
      ordersQuery.error?.message.includes('Unauthorized')

    if (isUnauthorized) {
      toast.error('Sesi login telah berakhir')
      clearSession()
      queryClient.clear()
      void navigate({ to: '/login' })
    }
  }, [
    stocksQuery.error,
    ordersQuery.error,
    navigate,
    clearSession,
    queryClient,
  ])

  const trackingNotificationCount = useMemo(
    () =>
      (ordersQuery.data ?? []).filter(
        (order) =>
          order.status === 'diproses' ||
          order.status === 'disetujui' ||
          order.status === 'dalam_pengiriman' ||
          (order.status === 'selesai' &&
            Boolean(order.receipt_proof_requested_at) &&
            !order.receipt_photo_present),
      ).length,
    [ordersQuery.data],
  )

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
      return reportDailyStock({
        items: changedStocks.map((stock) => ({
          product_id: stock.product_id,
          current_qty: editedStocks[stock.product_id],
        })),
      })
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
      return apiCreateOrder({
        note: orderNote.trim() || undefined,
        items: orderItems.map((item) => ({
          product_id: item.product_id,
          qty_requested: Number(item.qty),
        })),
      })
    },
    onSuccess: async () => {
      toast.success('Restock diajukan')
      setOrderItems([])
      setSkippedProductIds(new Set())
      setOrderNote('')
      setActiveTab('history')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mitra-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['central-products'] }),
      ])
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error))
      void queryClient.invalidateQueries({ queryKey: ['central-products'] })
    },
  })

  const verifyDelivery = useMutation({
    mutationFn: async ({
      orderId,
      code,
    }: {
      orderId: string
      code: string
    }) => {
      return confirmOrderReceipt(orderId, code)
    },
    onSuccess: async () => {
      toast.success('Barang diterima dan stok ditambahkan')
      setActiveTab('stocks')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mitra-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['mitra-stocks'] }),
        queryClient.invalidateQueries({ queryKey: ['mitra-stock-logs'] }),
      ])
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })

  const editOrder = useMutation({
    mutationFn: async ({
      orderId,
      note,
      items,
    }: {
      orderId: string
      note: string
      items: Array<{ product_id: string; qty_requested: number }>
    }) => {
      return apiUpdateOrder(orderId, { note, items })
    },
    onSuccess: async () => {
      toast.success('Pesanan diperbarui')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mitra-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['central-products'] }),
      ])
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })

  const cancelOrder = useMutation({
    mutationFn: async (orderId: string) => {
      return apiCancelOrder(orderId)
    },
    onSuccess: async () => {
      toast.success('Pesanan dibatalkan')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mitra-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['central-products'] }),
      ])
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })

  const uploadReceiptProof = useMutation({
    mutationFn: async ({
      orderId,
      photo,
    }: {
      orderId: string
      photo: string
    }) => {
      return apiUploadReceiptProof(orderId, photo)
    },
    onSuccess: async () => {
      toast.success('Foto bukti berhasil dikirim ke admin pusat')
      await queryClient.invalidateQueries({ queryKey: ['mitra-orders'] })
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  })

  function setStockQty(stock: StockItem, qty: number) {
    setEditedStocks((current) => ({
      ...current,
      [stock.product_id]: Math.max(0, qty),
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
          qty: '',
        },
      ]
    })
  }

  function setOrderQty(productId: string, qty: string) {
    if (!/^\d*$/.test(qty)) return
    setOrderItems((current) =>
      current.map((item) =>
        item.product_id === productId ? { ...item, qty } : item,
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
    void logout()
      .then(() => navigate({ to: '/login' }))
      .catch((error) => toast.error(errorMessage(error)))
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
    <div className="dashboard-page mitra-dashboard min-h-screen bg-[#f6f7f9] pb-44 sm:pb-48 font-sans text-text">
      <header className="sticky top-0 z-20 border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => openTab('profile')}
            aria-label={`Buka profil ${user.partner_name || 'mitra'}`}
            aria-current={activeTab === 'profile' ? 'page' : undefined}
            className="flex min-h-11 min-w-0 items-center gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
          >
            <MitraProfileAvatar
              key={user.partner_photo ?? ''}
              photo={user.partner_photo}
              name={user.partner_name || user.full_name}
            />
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold text-ink-900 sm:text-lg">
                {user.partner_name || 'Portal mitra'}
              </p>
              <p className="truncate text-xs text-muted sm:text-sm">
                Cabang mitra · PIC {user.partner_pic_name || user.full_name}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Keluar dari akun"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-md px-2 text-sm font-semibold text-muted transition-colors hover:bg-crit-bg hover:text-crit-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crit cursor-pointer sm:px-3"
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:pr-28">
        {activeTab === 'stocks' ? (
          <StocksPanel
            query={stocksQuery}
            centralProductsQuery={centralProductsQuery}
            editedStocks={editedStocks}
            changedIds={new Set(changedStocks.map((stock) => stock.product_id))}
            onQtyChange={setStockQty}
            onSave={() => updateStocks.mutate()}
            isSaving={updateStocks.isPending}
            onOpenLogs={() => setActiveTab('logs')}
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
            availableProducts={centralProductsQuery.data ?? []}
            deliveryTourStep={deliveryTourStep}
            onOpenOrder={() => setActiveTab('order')}
            onVerify={(orderId, code) =>
              verifyDelivery.mutateAsync({ orderId, code })
            }
            confirming={verifyDelivery.isPending}
            onEdit={(orderId, note, items) =>
              editOrder.mutateAsync({ orderId, note, items })
            }
            onCancel={(orderId) => cancelOrder.mutateAsync(orderId)}
            editing={editOrder.isPending}
            cancelling={cancelOrder.isPending}
            onUploadProof={(orderId, photo) =>
              uploadReceiptProof.mutateAsync({ orderId, photo })
            }
            uploadingProof={uploadReceiptProof.isPending}
          />
        ) : null}

        {activeTab === 'logs' ? (
          <MitraLogsPanel
            query={logsQuery}
            partnerName={user.partner_name ?? 'Mitra Cabang'}
          />
        ) : null}

        {activeTab === 'profile' ? (
          <ProfilePanel
            user={user}
            onLogout={handleLogout}
          />
        ) : null}
      </main>

      <MitraAiAssistant onStartTour={setActiveTour} />
      {activeTour ? (
        <MitraProductTour
          key={activeTour}
          tour={activeTour}
          onClose={closeTour}
          onTabChange={openTab}
          onDeliveryStepChange={setDeliveryTourStep}
        />
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 lg:pointer-events-none lg:inset-x-0 lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:p-0">
        <div className="mx-auto flex max-w-6xl justify-center lg:justify-end px-3 sm:px-6">
          <nav
            onMouseLeave={() => setHoveredIndex(null)}
            style={
              {
                '--active-index': activeIndex,
                '--hover-index': hoveredIndex ?? activeIndex,
              } as React.CSSProperties
            }
            className="pointer-events-auto relative mx-auto grid w-full max-w-[390px] grid-cols-5 items-center overflow-hidden rounded-full border border-ink-700/30 bg-white/70 p-1.5 shadow-[0_20px_50px_rgba(15,23,42,0.16),0_4px_16px_rgba(15,23,42,0.08),inset_0_1.5px_1px_rgba(255,255,255,0.9),inset_0_-1px_1px_rgba(0,0,0,0.04)] ring-1 ring-ink-700/10 backdrop-blur-2xl backdrop-saturate-150 sm:max-w-[430px] lg:mx-0 lg:flex lg:max-h-[calc(100dvh-2rem)] lg:w-[84px] lg:flex-col lg:gap-2 lg:overflow-y-auto lg:rounded-[2.2rem] lg:p-2"
            aria-label="Menu mitra"
          >
            {/* Liquid Glass Gliding Hover Pill */}
            <div
              aria-hidden="true"
              className={`liquid-pill-hover-mitra pointer-events-none absolute z-0 rounded-full lg:rounded-[1.4rem] border border-white/90 bg-white/80 shadow-[0_4px_16px_rgba(15,23,42,0.08),inset_0_1px_1px_rgba(255,255,255,0.95)] backdrop-blur-md
                top-1.5 bottom-1.5 left-1.5 w-[calc((100%-12px)/5)]
                lg:top-2 lg:bottom-auto lg:left-2 lg:h-[62px] lg:w-[calc(100%-16px)]
                ${
                  hoveredIndex !== null && hoveredIndex !== activeIndex
                    ? 'opacity-100 scale-100'
                    : 'pointer-events-none opacity-0 scale-95'
                }`}
            />

            {/* Liquid Glass Sliding Active Capsule */}
            <div
              aria-hidden="true"
              className="liquid-pill-active-mitra pointer-events-none absolute z-0 rounded-full lg:rounded-[1.4rem] bg-gradient-to-b from-ink-900 via-ink-900 to-ink-950 shadow-[0_8px_20px_rgba(15,23,42,0.32),inset_0_1px_1px_rgba(255,255,255,0.35)]
                top-1.5 bottom-1.5 left-1.5 w-[calc((100%-12px)/5)]
                lg:top-2 lg:bottom-auto lg:left-2 lg:h-[62px] lg:w-[calc(100%-16px)]"
            >
              {/* Glossy Liquid Specular Sheen */}
              <div className="pointer-events-none absolute inset-x-2 top-0.5 h-2.5 rounded-t-full bg-gradient-to-b from-white/25 to-transparent" />
            </div>

            {tabItems.map(({ id, label, Icon }, index) => {
              const isActive = activeTab === id
              return (
                <button
                  key={id}
                  data-tour={id === 'logs' ? 'logs-tab' : undefined}
                  type="button"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onClick={() => openTab(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group relative z-10 flex h-[54px] w-full flex-col items-center justify-center gap-1 rounded-full px-1 py-1 text-[10px] font-semibold transition-colors duration-200 ease-out active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 sm:text-[11px] lg:h-[62px] lg:rounded-[1.4rem] ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-600 hover:text-ink-950'
                  }`}
                >
                  <Icon
                    className={`size-4.5 shrink-0 transition-transform duration-200 ease-out sm:size-5 ${
                      isActive ? 'scale-110' : 'group-hover:scale-110 group-active:scale-95'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="max-w-full truncate leading-none tracking-tight">
                    {label}
                  </span>
                  {id === 'history' && trackingNotificationCount > 0 ? (
                    <span
                      className={`absolute right-1 top-1 grid min-w-4 place-items-center rounded-full px-1 text-[9px] tabular-nums font-bold shadow-xs transition-colors sm:right-2 sm:text-[10px] ${
                        isActive
                          ? 'bg-amber-400 text-ink-950 ring-1 ring-white/50'
                          : 'bg-warn-fg text-white ring-1 ring-white'
                      }`}
                      aria-label={`${trackingNotificationCount} pesanan perlu dilacak atau ditindaklanjuti`}
                    >
                      {trackingNotificationCount}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}

interface NumericStockInputProps {
  id?: string
  value: number
  onChange: (val: number) => void
  min?: number
  max?: number
  className?: string
  'aria-label'?: string
}

function NumericStockInput({
  id,
  value,
  onChange,
  min = 0,
  max,
  className,
  'aria-label': ariaLabel,
}: NumericStockInputProps) {
  const [localVal, setLocalVal] = useState(String(value))
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (!isFocused) {
      setLocalVal(String(value))
    }
  }, [value, isFocused])

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={ariaLabel}
      value={isFocused ? localVal : String(value)}
      onFocus={(e) => {
        setIsFocused(true)
        setLocalVal(value === 0 ? '' : String(value))
        e.target.select()
      }}
      onBlur={() => {
        setIsFocused(false)
        const parsed = Number.parseInt(localVal, 10)
        let finalVal = Number.isNaN(parsed) ? min : parsed
        if (finalVal < min) finalVal = min
        if (max !== undefined && finalVal > max) finalVal = max
        setLocalVal(String(finalVal))
        onChange(finalVal)
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, '')
        const stripped = raw.replace(/^0+(?=\d)/, '')
        setLocalVal(stripped)
        if (stripped === '') {
          onChange(min)
        } else {
          let parsed = Number.parseInt(stripped, 10)
          if (parsed < min) parsed = min
          if (max !== undefined && parsed > max) parsed = max
          onChange(parsed)
        }
      }}
      className={className}
    />
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
  onOpenLogs?: () => void
}

function StocksPanel({
  query,
  centralProductsQuery,
  editedStocks,
  changedIds,
  onQtyChange,
  onSave,
  isSaving,
  onOpenLogs,
}: StocksPanelProps) {
  return (
    <section aria-labelledby="stock-heading" className="dashboard-panel-enter">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="dashboard-eyebrow">Manajemen persediaan</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink-900 sm:text-3xl">
            Laporan stok fisik & stok toko
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Pantau ketersediaan barang di gudang pusat Daisuki dan laporkan sisa
            stok fisik di toko cabang Anda.
          </p>
        </div>
        {onOpenLogs ? (
          <button
            type="button"
            data-tour="logs-tab"
            onClick={onOpenLogs}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-3.5 py-2 text-xs font-semibold text-ink-700 shadow-2xs hover:bg-paper focus-visible:outline-2 focus-visible:outline-ink-900"
          >
            <History className="size-4" aria-hidden="true" /> Lihat log stok
          </button>
        ) : null}
      </div>

      {/* 1. Grid Stok Gudang Pusat Daisuki */}
      <div
        data-tour="central-stock-card"
        className="dashboard-surface mt-6 overflow-hidden border border-line"
      >
        <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between bg-paper/40">
          <div className="flex items-center gap-3">
            <span
              className="grid size-11 shrink-0 place-items-center rounded-lg border border-line bg-white"
              aria-hidden="true"
            >
              <img
                src="/icons/logo.jpg"
                alt=""
                width={40}
                height={40}
                className="size-full rounded-md object-cover"
              />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink-900 sm:text-base">
                Stok gudang pusat Daisuki
              </h2>
              <p className="text-xs text-muted">
                Ketersediaan stok siap kirim yang dikelola admin pusat Daisuki
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            Stok siap kirim · Diperbarui realtime
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
              title="Stok pusat daisuki belum tersedia"
              description="Admin belum mengaktifkan produk untuk gudang pusat."
            />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          {centralProductsQuery.data?.map((product) => (
            <div key={product.id} className="min-w-0 bg-white p-3.5 sm:p-4">
              <p
                className="truncate text-xs font-medium leading-snug tracking-tight text-muted"
                title={product.name}
              >
                {product.name}
              </p>
              <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-ink-900">
                {product.central_stock.toLocaleString('id-ID')}{' '}
                <span className="text-xs font-normal text-muted">
                  {product.unit}
                </span>
              </p>
              <p
                className={`mt-1 truncate text-xs font-medium ${
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

      {/* 2. Bagian Stok Saya (Stok Mitra) - Menjadi Satu Kesatuan Border dengan Laporan Stok */}
      <div className="dashboard-surface mt-6 overflow-hidden border border-line shadow-xs">
        <div
          data-tour="daily-report-card"
          className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between bg-paper/40"
        >
          <div className="flex items-center gap-3">
            <span
              className="grid size-11 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/70 shadow-xs"
              aria-hidden="true"
            >
              <Store className="size-5.5 text-emerald-700" />
            </span>
            <div>
              <p className="dashboard-eyebrow text-emerald-800">
                Laporan harian
              </p>
              <h1
                id="stock-heading"
                className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl"
              >
                Stok Saya
              </h1>
              <p className="mt-0.5 text-xs text-muted sm:text-sm">
                Sesuaikan jumlah dengan stok yang ada di rak, lalu simpan
                perubahan di bawah.
              </p>
            </div>
          </div>
        </div>

        {query.isLoading ? (
          <div className="p-6">
            <LoadingState label="Memuat stok cabang..." />
          </div>
        ) : null}
        {query.isError ? (
          <div className="p-6">
            <ErrorState
              message={errorMessage(query.error)}
              onRetry={() => void query.refetch()}
            />
          </div>
        ) : null}
        {query.data?.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Belum ada stok cabang"
              description="Admin perlu menambahkan produk untuk cabang ini."
            />
          </div>
        ) : null}

        {/* Laporan stok dengan Grid Layout */}
        {query.data && query.data.length > 0 ? (
          <div className="bg-paper/30 p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {query.data.map((stock) => {
                const qty = editedStocks[stock.product_id] ?? stock.current_qty
                const status = getStockStatus(qty, stock.par_level)
                const changed = changedIds.has(stock.product_id)
                return (
                  <article
                    key={stock.product_id}
                    className={`flex flex-col justify-between rounded-xl border bg-white p-4 shadow-2xs transition-all hover:shadow-xs sm:p-5 ${
                      changed
                        ? 'border-emerald-300 ring-1 ring-emerald-200/60 bg-emerald-50/15'
                        : 'border-line hover:border-ink-300'
                    }`}
                  >
                    <div>
                      {/* Baris Atas: Nama Produk & Status Badges */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h2
                              className="font-display text-base font-bold text-ink-900 sm:text-lg truncate"
                              title={stock.product_name}
                            >
                              {stock.product_name}
                            </h2>
                            {changed ? (
                              <span
                                className="size-2 shrink-0 rounded-full bg-emerald-600 ring-2 ring-emerald-200"
                                aria-label="Jumlah diubah"
                                title="Jumlah stok diubah"
                              />
                            ) : null}
                          </div>
                        </div>
                        <div
                          data-tour="stock-status-badge"
                          className="flex shrink-0 flex-col items-end gap-1"
                        >
                          <StockStatusBadge status={status} />
                          {stock.is_stale ? <StaleBadge /> : null}
                        </div>
                      </div>

                      {/* Display Stok Saat Ini */}
                      <div
                        className="mt-3 flex items-baseline gap-1.5"
                        aria-live="polite"
                      >
                        <span className="font-display text-3xl font-extrabold tabular-nums text-ink-900">
                          {qty.toLocaleString('id-ID')}
                        </span>
                        <span className="text-xs font-medium text-muted">
                          /pcs sekarang
                        </span>
                      </div>
                    </div>

                    {/* Counter Pengubah Jumlah Stok */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line/80 pt-3">
                      <label
                        htmlFor={`stock-${stock.product_id}`}
                        className="text-xs font-semibold text-muted"
                      >
                        Stok di toko:
                      </label>
                      <div
                        data-tour="daily-report-counter"
                        className="flex items-center gap-1.5"
                      >
                        <button
                          type="button"
                          onClick={() => onQtyChange(stock, qty - 1)}
                          className="grid size-11 place-items-center rounded-lg border border-line bg-paper text-ink-900 transition-all hover:bg-ink-100 active:scale-95 cursor-pointer"
                          aria-label={`Kurangi ${stock.product_name}`}
                        >
                          <Minus className="size-4" aria-hidden="true" />
                        </button>
                        <NumericStockInput
                          id={`stock-${stock.product_id}`}
                          value={qty}
                          onChange={(val) => onQtyChange(stock, val)}
                          className="h-11 w-20 sm:w-24 rounded-lg border border-line bg-white text-center text-lg font-bold tabular-nums text-ink-900 focus-visible:outline-2 focus-visible:outline-emerald-600"
                          aria-label={`Jumlah stok ${stock.product_name}`}
                        />
                        <button
                          type="button"
                          onClick={() => onQtyChange(stock, qty + 1)}
                          className="grid size-11 place-items-center rounded-lg border border-line bg-paper text-ink-900 transition-all hover:bg-ink-100 active:scale-95 cursor-pointer"
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
          </div>
        ) : null}

        {/* Footer tombol simpan di dalam border yang sama */}
        {query.data && query.data.length > 0 ? (
          <div className="flex justify-center border-t border-line bg-paper/40 p-4 sm:p-5">
            <button
              data-tour="save-stock-button"
              type="button"
              onClick={onSave}
              disabled={changedIds.size === 0 || isSaving}
              className={`inline-flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 ${
                changedIds.size > 0
                  ? 'bg-ink-900 text-white hover:bg-ink-700 shadow-xs'
                  : 'border border-line bg-paper text-muted disabled:cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              <span>
                {changedIds.size > 0
                  ? `Simpan Laporan Stok Fisik (${changedIds.size})`
                  : 'Belum ada perubahan stok'}
              </span>
            </button>
          </div>
        ) : null}
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
  onQtyChange: (productId: string, qty: string) => void
  onSkipChange: (productId: string, skipped: boolean) => void
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
  onRemove,
  onQtyChange,
  onSkipChange,
  onSubmit,
  isSubmitting,
}: OrderFormProps) {
  const statusPriority = { kritis: 0, waspada: 1, aman: 2 }
  const products = [...(stocksQuery.data ?? [])].sort(
    (a, b) =>
      statusPriority[getStockStatus(a.current_qty, a.par_level)] -
        statusPriority[getStockStatus(b.current_qty, b.par_level)] ||
      a.current_qty - b.current_qty,
  )

  const hasAnyExceeded = orderItems.some((item) => {
    const centralItem = centralProducts.find((p) => p.id === item.product_id)
    const stock = stocksQuery.data?.find(
      (s) => s.product_id === item.product_id,
    )
    const centralQty = centralItem?.central_stock ?? stock?.central_stock
    return centralQty !== undefined && Number(item.qty) > centralQty
  })
  const hasInvalidQty = orderItems.some((item) => !validOrderQuantity(item.qty))
  const totalOrderQty = orderItems.reduce(
    (sum, item) => sum + (validOrderQuantity(item.qty) ? Number(item.qty) : 0),
    0,
  )
  const needsRestock = products.filter(
    (stock) => getStockStatus(stock.current_qty, stock.par_level) === 'kritis',
  )

  return (
    <section aria-labelledby="order-heading" className="dashboard-panel-enter">
      <div className="dashboard-surface overflow-hidden border border-line shadow-xs">
        {/* Header Ajukan Restock */}
        <div className="flex flex-col gap-2 border-b border-line bg-paper/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <span
              className="grid size-11 shrink-0 place-items-center rounded-lg border border-ink-200 bg-white text-ink-900 shadow-2xs"
              aria-hidden="true"
            >
              <PackagePlus className="size-5.5 text-ink-900" />
            </span>
            <div>
              <p className="dashboard-eyebrow">Restock cabang</p>
              <h1
                id="order-heading"
                className="font-display text-xl font-bold tracking-tight text-ink-900 sm:text-2xl"
              >
                Ajukan restock
              </h1>
              <p className="mt-0.5 text-xs text-muted sm:text-sm">
                Pilih barang yang ingin dipesan dan sesuaikan jumlahnya dengan stok pusat.
              </p>
            </div>
          </div>
          {orderItems.length > 0 ? (
            <div className="flex items-center gap-2 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 sm:self-center">
              <span className="size-2 rounded-full bg-emerald-600" aria-hidden="true" />
              <span className="tabular-nums">
                {orderItems.length} produk · {totalOrderQty.toLocaleString('id-ID')} pcs dipilih
              </span>
            </div>
          ) : null}
        </div>

        {stocksQuery.isLoading ? (
          <div className="p-6">
            <LoadingState label="Memuat produk cabang..." />
          </div>
        ) : null}

        {stocksQuery.isError ? (
          <div className="p-6">
            <ErrorState
              message={errorMessage(stocksQuery.error)}
              onRetry={() => void stocksQuery.refetch()}
            />
          </div>
        ) : null}

        {stocksQuery.data?.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Belum ada produk untuk dipesan"
              description="Produk akan muncul setelah admin menambahkan stok untuk cabang Anda."
            />
          </div>
        ) : null}

        {/* Banner Ringkas Saran Stok Kritis (Bila Ada) */}
        {needsRestock.length > 0 ? (
          <div className="border-b border-amber-200/80 bg-amber-50/80 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950 sm:text-sm">
              <div className="flex items-center gap-2 font-semibold text-amber-900">
                <AlertTriangle className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
                <span>Prioritas stok kritis:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {needsRestock.map((stock) => {
                  const suggested = Math.max(1, stock.par_level - stock.current_qty)
                  return (
                    <button
                      key={stock.product_id}
                      type="button"
                      onClick={() => {
                        onSkipChange(stock.product_id, false)
                        onAdd(stock)
                        onQtyChange(stock.product_id, String(suggested))
                      }}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-950 shadow-2xs transition-colors hover:bg-amber-100/60 cursor-pointer"
                    >
                      <span>{stock.product_name}</span>
                      <span className="tabular-nums text-amber-800">
                        +{suggested.toLocaleString('id-ID')} pcs
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ) : null}

        {/* Grid 2 Kolom Daftar Produk */}
        {products.length > 0 ? (
          <div className="bg-paper/30 p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {products.map((stock) => {
                const selected = orderItems.find(
                  (item) => item.product_id === stock.product_id,
                )
                const centralItem = centralProducts.find(
                  (p) => p.id === stock.product_id,
                )
                const centralQty = centralItem?.central_stock ?? stock.central_stock
                const status = getStockStatus(stock.current_qty, stock.par_level)
                const suggestedQty = Math.max(0, stock.par_level - stock.current_qty)
                const isExceeded = Boolean(
                  selected &&
                    centralQty !== undefined &&
                    Number(selected.qty) > centralQty,
                )

                return (
                  <article
                    key={stock.product_id}
                    className={`flex flex-col justify-between rounded-xl border bg-white p-4 shadow-2xs transition-all sm:p-5 ${
                      isExceeded
                        ? 'border-amber-400 bg-amber-50/20 ring-1 ring-amber-300/70'
                        : selected
                          ? 'border-ink-900 bg-emerald-50/10 ring-1 ring-ink-900/10 shadow-xs'
                          : 'border-line hover:border-ink-300'
                    }`}
                  >
                    <div>
                      {/* Baris Atas: Nama Produk & Badge Status */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h2
                              className="truncate font-display text-base font-bold text-ink-900 sm:text-lg"
                              title={stock.product_name}
                            >
                              {stock.product_name}
                            </h2>
                            {selected ? (
                              <span
                                className="size-2 shrink-0 rounded-full bg-emerald-600 ring-2 ring-emerald-200"
                                aria-label="Masuk pengajuan"
                                title="Masuk daftar pengajuan"
                              />
                            ) : null}
                          </div>
                        </div>
                        <StockStatusBadge status={status} />
                      </div>

                      {/* Baris Metrik Ringkas: Sisa Toko vs Stok Pusat */}
                      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-line/70 bg-paper/50 px-3 py-2 text-xs">
                        <div>
                          <span className="text-muted"> Sisa di toko Saya </span>
                          <p className="mt-0.5 font-display text-base font-bold tabular-nums text-ink-900">
                            {stock.current_qty.toLocaleString('id-ID')}{' '}
                            <span className="font-sans text-xs font-normal text-muted">
                              {stock.product_unit}
                            </span>
                          </p>
                        </div>
                        <div className="border-l border-line/70 pl-2.5">
                          <span className="text-muted">Stok pusat</span>
                          <p
                            className={`mt-0.5 font-display text-base font-bold tabular-nums ${
                              isExceeded ? 'text-amber-700' : 'text-ink-900'
                            }`}
                          >
                            {centralQty === undefined ? (
                              <span className="font-sans text-xs font-normal text-muted">
                                Belum tersedia
                              </span>
                            ) : (
                              <>
                                {centralQty.toLocaleString('id-ID')}{' '}
                                <span className="font-sans text-xs font-normal text-muted">
                                  {stock.product_unit}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Baris Kontrol Pengajuan */}
                    <div className="mt-4 border-t border-line/80 pt-3">
                      {selected ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <label
                              htmlFor={`order-${stock.product_id}`}
                              className="text-xs font-semibold text-ink-900"
                            >
                              Pesan:
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                onRemove(stock.product_id)
                              }
                              className="rounded-md px-2 py-1 text-xs font-semibold text-crit-fg transition-colors hover:bg-crit-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700 cursor-pointer"
                              aria-label={`Batal pesan ${stock.product_name}`}
                            >
                              Batal
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                onQtyChange(
                                  stock.product_id,
                                  String(
                                    Math.max(1, Number(selected.qty || 1) - 1),
                                  ),
                                )
                              }
                              disabled={
                                !selected.qty || Number(selected.qty) <= 1
                              }
                              className="grid size-11 place-items-center rounded-lg border border-line bg-paper text-ink-900 transition-all hover:bg-ink-100 active:scale-95 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700 cursor-pointer"
                              aria-label={`Kurangi jumlah ${stock.product_name}`}
                            >
                              <Minus className="size-4" aria-hidden="true" />
                            </button>
                            <input
                              data-tour="restock-item-input"
                              id={`order-${stock.product_id}`}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder="0"
                              value={selected.qty}
                              onChange={(event) =>
                                onQtyChange(
                                  stock.product_id,
                                  event.target.value.replace(/^0+(?=\d)/, ''),
                                )
                              }
                              className={`h-11 w-20 sm:w-24 rounded-lg border text-center text-lg font-bold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 ${
                                isExceeded
                                  ? 'border-amber-400 bg-amber-50/70 text-amber-950 ring-1 ring-amber-300 focus-visible:outline-amber-600'
                                  : 'border-line bg-white text-ink-900 focus-visible:outline-ink-700'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                onQtyChange(
                                  stock.product_id,
                                  String(Number(selected.qty || 0) + 1),
                                )
                              }
                              className="grid size-11 place-items-center rounded-lg border border-line bg-paper text-ink-900 transition-all hover:bg-ink-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700 cursor-pointer"
                              aria-label={`Tambah jumlah ${stock.product_name}`}
                            >
                              <Plus className="size-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          {suggestedQty > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                onSkipChange(stock.product_id, false)
                                onAdd(stock)
                                onQtyChange(
                                  stock.product_id,
                                  String(
                                    centralQty !== undefined
                                      ? Math.min(suggestedQty, Math.max(1, centralQty))
                                      : suggestedQty,
                                  ),
                                )
                              }}
                              className="inline-flex min-h-9 items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 cursor-pointer"
                            >
                              <span>Isi saran +{suggestedQty} pcs</span>
                            </button>
                          ) : (
                            <span className="text-xs text-muted">
                              Belum diajukan
                            </span>
                          )}
                          <button
                            data-tour="restock-item-input"
                            type="button"
                            onClick={() => {
                              onSkipChange(stock.product_id, false)
                              onAdd(stock)
                              if (suggestedQty > 0) {
                                onQtyChange(
                                  stock.product_id,
                                  String(
                                    centralQty !== undefined
                                      ? Math.min(suggestedQty, Math.max(1, centralQty))
                                      : suggestedQty,
                                  ),
                                )
                              }
                            }}
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-ink-800 bg-white px-3.5 text-sm font-semibold text-ink-900 shadow-2xs transition-colors hover:bg-ink-900 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700 cursor-pointer"
                          >
                            <Plus className="size-4" aria-hidden="true" />
                            <span>Tambah ke pengajuan</span>
                          </button>
                        </div>
                      )}

                      {selected && isExceeded && centralQty !== undefined ? (
                        <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                          <AlertTriangle
                            className="size-4 shrink-0 text-amber-600"
                            aria-hidden="true"
                          />
                          <span>
                            Melebihi stok pusat ({centralQty.toLocaleString('id-ID')}{' '}
                            {stock.product_unit} tersedia).
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* Footer Ringkasan Pengajuan & Catatan */}
        <div className="border-t border-line bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-ink-900">
              Ringkasan pengajuan
            </h2>
            {orderItems.length > 0 ? (
              <span className="text-xs font-semibold tabular-nums text-muted">
                Total: {totalOrderQty.toLocaleString('id-ID')} pcs
              </span>
            ) : null}
          </div>

          {orderItems.length === 0 ? (
            <p className="mt-1.5 text-sm text-muted">
              Belum ada barang dipilih. Tekan <strong>Tambah ke pengajuan</strong> pada kartu produk di atas.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
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
                  centralQty !== undefined && Number(item.qty) > centralQty

                return (
                  <div
                    key={item.product_id}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                      itemExceeded
                        ? 'border-amber-300 bg-amber-50 text-amber-950'
                        : 'border-line bg-paper/60 text-ink-900'
                    }`}
                  >
                    <span>{stock?.product_name ?? 'Produk'}</span>
                    <strong className="tabular-nums font-bold">
                      {item.qty || '0'} {stock?.product_unit ?? 'pcs'}
                    </strong>
                    <button
                      type="button"
                      onClick={() => onRemove(item.product_id)}
                      className="ml-0.5 text-muted hover:text-crit-fg cursor-pointer"
                      aria-label={`Hapus ${stock?.product_name ?? 'produk'} dari ringkasan`}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {hasAnyExceeded ? (
            <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle
                className="size-4 shrink-0 text-amber-600 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <p className="font-bold text-amber-900">
                  Kuantitas melebihi stok gudang pusat
                </p>
                <p className="mt-0.5 text-amber-800">
                  Sesuaikan jumlah agar tidak melebihi stok pusat yang tersedia sebelum mengirim.
                </p>
              </div>
            </div>
          ) : null}

          {hasInvalidQty ? (
            <p role="alert" className="mt-3 text-xs font-semibold text-crit-fg">
              Isi jumlah minimal 1 pcs untuk setiap barang yang dipilih.
            </p>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label
                htmlFor="order-note"
                className="block text-xs font-semibold text-ink-900"
              >
                Catatan untuk admin{' '}
                <span className="font-normal text-muted">(opsional)</span>
              </label>
              <textarea
                data-tour="restock-note-input"
                id="order-note"
                rows={2}
                value={note}
                onChange={(event) => onNoteChange(event.target.value)}
                placeholder="Contoh: dibutuhkan sebelum Jumat untuk akhir pekan"
                className="mt-1.5 w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700"
                maxLength={500}
              />
            </div>

            <button
              data-tour="submit-order-button"
              type="button"
              onClick={onSubmit}
              disabled={
                orderItems.length === 0 ||
                hasInvalidQty ||
                hasAnyExceeded ||
                isSubmitting
              }
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              <span className="tabular-nums">
                Kirim Pengajuan ({totalOrderQty.toLocaleString('id-ID')} pcs)
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function OrderHistory({
  query,
  availableProducts = [],
  deliveryTourStep,
  onOpenOrder,
  onVerify,
  confirming,
  onEdit,
  onCancel,
  editing,
  cancelling,
  onUploadProof,
  uploadingProof,
}: {
  query: ReturnType<typeof useQuery<Order[]>>
  availableProducts?: Product[]
  deliveryTourStep: number
  onOpenOrder: () => void
  onVerify: (orderId: string, code: string) => Promise<unknown>
  confirming: boolean
  onEdit: (
    orderId: string,
    note: string,
    items: Array<{ product_id: string; qty_requested: number }>,
  ) => Promise<unknown>
  onCancel: (orderId: string) => Promise<unknown>
  editing: boolean
  cancelling: boolean
  onUploadProof: (orderId: string, photo: string) => Promise<unknown>
  uploadingProof: boolean
}) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const tourOpenedOrderId = useRef<string | null>(null)
  const [editTarget, setEditTarget] = useState<Order | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [cancelMode, setCancelMode] = useState(false)
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null)
  const [receiptPhotoError, setReceiptPhotoError] = useState('')
  const [preparingPhoto, setPreparingPhoto] = useState(false)
  const [statusFilter, setStatusFilter] = useState<
    | 'semua'
    | 'diproses'
    | 'disetujui'
    | 'dalam_pengiriman'
    | 'selesai'
    | 'ditolak'
  >('diproses')

  const allOrders = query.data ?? []
  const selectedOrder =
    allOrders.find((order) => order.id === selectedOrderId) ?? null

  useEffect(() => {
    if (deliveryTourStep < 0) {
      if (tourOpenedOrderId.current) setSelectedOrderId(null)
      tourOpenedOrderId.current = null
      return
    }
    const shipment = query.data?.find(
      (order) => order.status === 'dalam_pengiriman',
    )
    if (!shipment) return
    setStatusFilter('dalam_pengiriman')
    if (deliveryTourStep >= 2) {
      tourOpenedOrderId.current = shipment.id
      setSelectedOrderId(shipment.id)
    } else if (tourOpenedOrderId.current) {
      setSelectedOrderId(null)
      tourOpenedOrderId.current = null
    }
  }, [deliveryTourStep, query.data])

  const handleReceiptFile = async (file?: File) => {
    if (!file) return
    setPreparingPhoto(true)
    setReceiptPhotoError('')
    try {
      setReceiptPhoto(await prepareReceiptPhoto(file))
    } catch (error) {
      setReceiptPhoto(null)
      setReceiptPhotoError(errorMessage(error))
    } finally {
      setPreparingPhoto(false)
    }
  }

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'semua') return allOrders
    return allOrders.filter((o) => o.status === statusFilter)
  }, [allOrders, statusFilter])

  return (
    <section
      aria-labelledby="history-heading"
      className="dashboard-panel-enter"
    >
      <div
        data-tour="order-history-list"
        className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="dashboard-eyebrow">Riwayat restock</p>
          <h1
            id="history-heading"
            className="mt-1 text-2xl font-semibold text-ink-900 sm:text-3xl"
          >
            Status pesanan
          </h1>
        </div>

        {allOrders.length > 0 ? (
          <button
            type="button"
            onClick={onOpenOrder}
            className="mt-2 inline-flex min-h-11 items-center justify-center gap-1.5 self-start rounded-md bg-gray-400 px-4 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 sm:mt-0 sm:self-auto"
          >
            <PackagePlus className="size-4" />
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
                className="min-h-11 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700"
              >
                restock
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
            className={`min-h-11 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === 'semua'
                ? 'border border-emerald-300/90 bg-emerald-50 text-emerald-950 font-semibold shadow-xs'
                : 'border border-line/60 bg-white text-muted hover:border-line hover:bg-paper hover:text-ink-900'
            }`}
          >
            Semua ({allOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('diproses')}
            className={`min-h-11 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === 'diproses'
                ? 'border border-amber-300/90 bg-amber-50 text-amber-950 font-semibold shadow-xs'
                : 'border border-line/60 bg-white text-muted hover:border-line hover:bg-paper hover:text-ink-900'
            }`}
          >
            Menunggu Persetujuan (
            {allOrders.filter((o) => o.status === 'diproses').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('disetujui')}
            className={`min-h-11 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === 'disetujui'
                ? 'border border-emerald-300/90 bg-emerald-50 text-emerald-950 font-semibold shadow-xs'
                : 'border border-line/60 bg-white text-muted hover:border-line hover:bg-paper hover:text-ink-900'
            }`}
          >
            Disetujui (
            {allOrders.filter((o) => o.status === 'disetujui').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('dalam_pengiriman')}
            className={`min-h-11 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === 'dalam_pengiriman'
                ? 'border border-sky-300/90 bg-sky-50 text-sky-950 font-semibold shadow-xs'
                : 'border border-line/60 bg-white text-muted hover:border-line hover:bg-paper hover:text-ink-900'
            }`}
          >
            Dalam Pengiriman (
            {allOrders.filter((o) => o.status === 'dalam_pengiriman').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('selesai')}
            className={`min-h-11 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === 'selesai'
                ? 'border border-emerald-300/90 bg-emerald-50 text-emerald-950 font-semibold shadow-xs'
                : 'border border-line/60 bg-white text-muted hover:border-line hover:bg-paper hover:text-ink-900'
            }`}
          >
            Selesai ({allOrders.filter((o) => o.status === 'selesai').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ditolak')}
            className={`min-h-11 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === 'ditolak'
                ? 'border border-crit/40 bg-crit-bg text-crit-fg shadow-xs'
                : 'border border-line/60 bg-white text-muted hover:border-line hover:bg-paper hover:text-ink-900'
            }`}
          >
            Ditolak ({allOrders.filter((o) => o.status === 'ditolak').length})
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
                data-tour={
                  order.status === 'dalam_pengiriman'
                    ? 'delivery-order-card'
                    : undefined
                }
                role="button"
                tabIndex={0}
                aria-label={`Lihat detail pesanan ${order.order_no}`}
                onClick={() => {
                  setSelectedOrderId(order.id)
                  setReceiptPhoto(null)
                  setReceiptPhotoError('')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedOrderId(order.id)
                    setReceiptPhoto(null)
                    setReceiptPhotoError('')
                  }
                }}
                className="group relative flex cursor-pointer flex-col justify-between gap-3 rounded-lg border border-line bg-white p-4 transition-colors hover:border-ink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 sm:p-5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-base font-bold tabular-nums text-ink-900 sm:text-lg">
                        {order.order_no}
                      </h2>
                      <OrderStatusBadge status={order.status} />
                      {order.status === 'selesai' &&
                      !order.receipt_photo_present ? (
                        <span className="rounded-md bg-warn-bg px-2 py-1 text-xs font-semibold text-warn-fg">
                          {order.receipt_proof_requested_at
                            ? 'Admin meminta foto bukti'
                            : 'Foto bukti belum ada'}
                        </span>
                      ) : null}
                      {order.admin_note ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2 py-1 text-[11px] font-semibold text-ink-700">
                          <MessageSquare className="size-3" />
                          <span>Ada Catatan Admin</span>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className="inline-flex items-center gap-1 rounded-md border border-line/60 bg-paper px-3 py-1.5 text-xs font-semibold text-ink-800 transition-colors group-hover:bg-ink-100 group-hover:text-ink-900">
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
                <p className="text-xs tabular-nums text-muted">
                  Diajukan {formatOrderDate(order.created_at)}
                </p>
                {order.status === 'dalam_pengiriman' ? (
                  <span className="inline-flex min-h-11 items-center gap-2 self-start rounded-md bg-ink-900 px-4 text-sm font-semibold text-white">
                    <Truck className="size-4" aria-hidden="true" /> Pindai
                    Barcode Kardus &amp; Terima
                  </span>
                ) : null}
                {order.status === 'selesai' && order.receipt_photo_present ? (
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="size-4" aria-hidden="true" /> Bukti
                    penerimaan tersedia
                  </span>
                ) : null}
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
            if (!open) {
              setSelectedOrderId(null)
              setReceiptPhoto(null)
              setReceiptPhotoError('')
            }
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
                    Diajukan pada{' '}
                    {formatDetailedDateTime(selectedOrder.created_at)}
                  </Dialog.Description>
                </div>

                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="grid size-11 place-items-center rounded-md text-muted hover:bg-paper hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-ink-700"
                    aria-label="Tutup detail pesanan"
                  >
                    <X className="size-5" />
                  </button>
                </Dialog.Close>
              </div>

              {/* Rincian Produk yang Diminta & Disetujui */}
              {selectedOrder.status === 'dalam_pengiriman' ? (
                <div className="mt-4 rounded-md border border-line bg-paper p-3 text-sm text-ink-900">
                  <p className="font-semibold">Manifest pengiriman</p>
                  <p className="mt-1 text-muted">
                    {selectedOrder.items.length} jenis produk ·{' '}
                    <span className="tabular-nums">
                      {selectedOrder.items
                        .reduce(
                          (sum, item) => sum + (item.qty_approved ?? 0),
                          0,
                        )
                        .toLocaleString('id-ID')}{' '}
                      pcs
                    </span>{' '}
                    disetujui
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    Identitas pengemudi, kendaraan, dan estimasi tiba belum
                    tersedia dari sistem pengiriman.
                  </p>
                </div>
              ) : null}
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
                    <MessageSquare
                      className="size-4 text-ink-700"
                      aria-hidden="true"
                    />
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
                {selectedOrder.status === 'diproses' ||
                selectedOrder.status === 'disetujui' ? (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {selectedOrder.status === 'diproses' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditTarget(selectedOrder)
                          setSelectedOrderId(null)
                        }}
                        className="min-h-11 rounded-md border border-ink-700 bg-white px-4 text-sm font-semibold text-ink-700 focus-visible:outline-2 focus-visible:outline-ink-900"
                      >
                        Edit pengajuan
                      </button>
                    ) : null}
                    {!cancelMode ? (
                      <button
                        type="button"
                        onClick={() => setCancelMode(true)}
                        className="min-h-11 rounded-md border border-crit bg-white px-4 text-sm font-semibold text-crit-fg focus-visible:outline-2 focus-visible:outline-crit"
                      >
                        Batalkan pesanan?
                      </button>
                    ) : (
                      <div className="w-full rounded-md border border-crit/40 bg-crit-bg/30 p-3">
                        <p className="text-sm text-ink-900">
                          Batalkan  Pengajuan ini tidak akan dikirim.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setCancelMode(false)}
                            className="min-h-11 rounded-md border border-line bg-white px-4 text-sm"
                          >
                            Kembali
                          </button>
                          <button
                            type="button"
                            disabled={cancelling}
                            onClick={() =>
                              void onCancel(selectedOrder.id)
                                .then(() => {
                                  setSelectedOrderId(null)
                                  setCancelMode(false)
                                })
                                .catch(() => undefined)
                            }
                            className="min-h-11 rounded-md bg-crit px-4 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            Ya, batalkan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
                {selectedOrder.status === 'selesai' &&
                !selectedOrder.receipt_photo_present ? (
                  <div className="mb-4 rounded-md border border-line bg-white p-4">
                    <p className="text-sm font-semibold text-ink-900">
                      Foto bukti barang diterima
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Foto paket atau barang yang tiba di cabang. JPG, PNG, atau
                      WebP; maksimal 5 MB sebelum diproses.
                    </p>
                    {selectedOrder.receipt_proof_requested_at ? (
                      <p className="mt-2 rounded-md bg-warn-bg p-2 text-xs font-semibold text-warn-fg">
                        Admin pusat meminta foto bukti untuk pesanan ini.
                      </p>
                    ) : null}
                    {receiptPhoto ? (
                      <img
                        src={receiptPhoto}
                        alt="Pratinjau foto bukti barang diterima"
                        className="mt-3 max-h-52 w-full rounded-md border border-line object-contain"
                      />
                    ) : null}
                    <label
                      htmlFor={`receipt-photo-${selectedOrder.id}`}
                      className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line bg-paper px-4 text-sm font-semibold text-ink-900 hover:bg-ink-50"
                    >
                      <ImagePlus className="size-4" aria-hidden="true" />
                      {receiptPhoto ? 'Ganti foto' : 'Ambil atau pilih foto'}
                    </label>
                    <input
                      id={`receipt-photo-${selectedOrder.id}`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      className="sr-only"
                      onChange={(event) => {
                        void handleReceiptFile(event.currentTarget.files?.[0])
                        event.currentTarget.value = ''
                      }}
                    />
                    {preparingPhoto ? (
                      <p className="mt-2 text-xs text-muted">
                        Memproses foto...
                      </p>
                    ) : null}
                    {receiptPhotoError ? (
                      <p className="mt-2 text-xs text-crit-fg" role="alert">
                        {receiptPhotoError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {selectedOrder.status === 'disetujui' ? (
                  <div className="rounded-md bg-ok/10 p-3 text-sm font-medium text-ok-fg">
                    Jumlah barang disetujui admin pusat. Pesanan sedang
                    dipersiapkan untuk pengiriman.
                  </div>
                ) : null}

                {selectedOrder.status === 'dalam_pengiriman' ? (
                  <div className="rounded-md border border-line bg-ink-50 p-4">
                    <div className="flex items-center gap-2 font-semibold text-ink-900 text-sm">
                      <Truck className="size-4 text-order-pengiriman" />
                      <span>Barang Dalam Pengiriman</span>
                    </div>
                    <button
                      data-tour="delivery-confirm-button"
                      type="button"
                      onClick={() => setScanOpen(true)}
                      disabled={confirming}
                      className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-ink-700 px-4 text-sm font-semibold text-white hover:bg-ink-900 disabled:opacity-50"
                    >
                     Scan Barcode
                    </button>
                    <DeliveryScannerModal
                      open={scanOpen}
                      onOpenChange={setScanOpen}
                      pending={confirming}
                      onVerify={(code) =>
                        onVerify(selectedOrder.id, code).then(() => {
                          setSelectedOrderId(null)
                          setReceiptPhoto(null)
                        })
                      }
                    />
                  </div>
                ) : null}

                {selectedOrder.status === 'selesai' ? (
                  <div className="space-y-3">
                    <div className="rounded-md bg-ok/10 p-3 text-sm font-medium text-ok-fg flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-ok shrink-0" />
                      <span>
                        Pesanan selesai. Barang diterima dan stok cabang sudah
                        bertambah.
                      </span>
                    </div>
                    {selectedOrder.receipt_photo_present ? (
                      <p className="text-xs font-semibold text-ok-fg">
                        Foto bukti sudah dikirim ke admin pusat.
                      </p>
                    ) : (
                      <div className="rounded-md border border-warn bg-warn-bg/30 p-3">
                        <p className="text-sm font-semibold text-warn-fg">
                          Foto bukti belum ada
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          Unggah foto barang yang diterima agar Admin dapat
                          memeriksanya.
                        </p>
                        <button
                          type="button"
                          disabled={
                            !receiptPhoto || uploadingProof || preparingPhoto
                          }
                          onClick={() => {
                            if (!receiptPhoto) return
                            void onUploadProof(selectedOrder.id, receiptPhoto)
                              .then(() => setReceiptPhoto(null))
                              .catch(() => undefined)
                          }}
                          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {uploadingProof ? (
                            <Loader2
                              className="size-4 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <ImagePlus className="size-4" aria-hidden="true" />
                          )}
                          Kirim foto bukti
                        </button>
                      </div>
                    )}
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
      <EditOrderModal
        order={editTarget}
        availableProducts={availableProducts}
        onClose={() => setEditTarget(null)}
        onSave={onEdit}
        pending={editing}
      />
    </section>
  )
}

interface EditOrderItem {
  product_id: string
  product_name: string
  product_unit?: string
  central_stock?: number
}

function EditOrderModal({
  order,
  availableProducts = [],
  onClose,
  onSave,
  pending,
}: {
  order: Order | null
  availableProducts?: Product[]
  onClose: () => void
  onSave: (
    orderId: string,
    note: string,
    items: Array<{ product_id: string; qty_requested: number }>,
  ) => Promise<unknown>
  pending: boolean
}) {
  const [note, setNote] = useState('')
  const [currentItems, setCurrentItems] = useState<EditOrderItem[]>([])
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!order) return
    setNote(order.note ?? '')
    setCurrentItems(
      order.items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_unit: item.product_unit,
        central_stock: item.central_stock,
      })),
    )
    setQuantities(
      Object.fromEntries(
        order.items.map((item) => [item.product_id, item.qty_requested]),
      ),
    )
  }, [order])

  if (!order) return null

  // Daftar produk / kategori Daisuki yang belum dimasukkan ke dalam pengajuan ini
  const currentProductIds = new Set(currentItems.map((item) => item.product_id))
  const unaddedProducts = availableProducts.filter(
    (product) => !currentProductIds.has(product.id),
  )

  const handleAddProduct = (product: Product) => {
    setCurrentItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_name: product.name,
        product_unit: product.unit,
        central_stock: product.central_stock,
      },
    ])
    setQuantities((prev) => ({
      ...prev,
      [product.id]: prev[product.id] || 10,
    }))
  }

  const handleRemoveProduct = (productId: string) => {
    setCurrentItems((prev) =>
      prev.filter((item) => item.product_id !== productId),
    )
    setQuantities((prev) => {
      const next = { ...prev }
      delete next[productId]
      return next
    })
  }

  const items = currentItems
    .filter((item) => (quantities[item.product_id] ?? 0) > 0)
    .map((item) => ({
      product_id: item.product_id,
      qty_requested: quantities[item.product_id],
    }))

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/45" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-1rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto overflow-x-hidden rounded-lg border border-line bg-white p-5 shadow-xl focus-visible:outline-2 focus-visible:outline-ume">
          <Dialog.Title className="font-display text-xl font-semibold text-ink-900">
            Edit pengajuan {order.order_no}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted">
            Atur jumlah barang sebelum admin menyetujui pesanan. Anda juga dapat
            menambahkan kategori produk lain di bawah.
          </Dialog.Description>
          <div className="mt-5 space-y-3">
            {currentItems.map((item) => {
              const qty = quantities[item.product_id] ?? 0
              return (
                <div
                  key={item.product_id}
                  className="flex items-center justify-between gap-3 rounded-md border border-line bg-paper/40 p-3 text-sm font-medium text-ink-900"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-900">
                      {item.product_name}
                    </p>
                    <p className="text-xs text-muted">
                      {item.product_unit ?? 'pcs'}
                      {typeof item.central_stock === 'number'
                        ? ` · Stok pusat: ${item.central_stock.toLocaleString('id-ID')}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setQuantities((prev) => ({
                          ...prev,
                          [item.product_id]: Math.max(0, qty - 1),
                        }))
                      }
                      className="grid size-8 place-items-center rounded border border-line bg-white text-ink-900 hover:bg-paper active:scale-95"
                      aria-label={`Kurangi ${item.product_name}`}
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <NumericStockInput
                      value={qty}
                      onChange={(val) =>
                        setQuantities((current) => ({
                          ...current,
                          [item.product_id]: val,
                        }))
                      }
                      className="h-8 w-16 rounded border border-line bg-white px-1 text-center text-sm font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-ink-900"
                      aria-label={`Jumlah restock ${item.product_name}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setQuantities((prev) => ({
                          ...prev,
                          [item.product_id]: qty + 1,
                        }))
                      }
                      className="grid size-8 place-items-center rounded border border-line bg-white text-ink-900 hover:bg-paper active:scale-95"
                      aria-label={`Tambah ${item.product_name}`}
                    >
                      <Plus className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(item.product_id)}
                      className="grid size-8 place-items-center rounded border border-transparent text-muted hover:border-line hover:bg-white hover:text-crit-fg transition-colors"
                      title="Hapus barang dari pengajuan"
                      aria-label={`Hapus ${item.product_name}`}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Section Tambah Kategori jika ada barang yang belum dimasukkan */}
          {unaddedProducts.length > 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-emerald-950">
                    Kategori barang belum dimasukkan
                  </p>
                  <p className="mt-0.5 text-[11px] text-emerald-800/80">
                    Ada {unaddedProducts.length} barang lain di katalog yang bisa
                    ditambahkan ke pengajuan ini:
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  {unaddedProducts.length} tersedia
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {unaddedProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-emerald-200/80 bg-white p-2.5 shadow-2xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-ink-900">
                        {p.name}
                      </p>
                      <p className="text-[11px] text-muted">
                        Stok pusat:{' '}
                        {p.central_stock.toLocaleString('id-ID')} {p.unit}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddProduct(p)}
                      className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-ink-700 active:scale-95"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      <span>+ Tambah Kategori</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <label
            htmlFor="edit-order-note"
            className="mt-4 block text-sm font-semibold text-ink-900"
          >
            Catatan cabang
          </label>
          <textarea
            id="edit-order-note"
            value={note}
            maxLength={1000}
            onChange={(event) => setNote(event.target.value)}
            className="mt-2 min-h-20 w-full rounded-md border border-line bg-white p-3 text-sm focus-visible:outline-2 focus-visible:outline-ume"
          />
          {items.length === 0 ? (
            <p role="alert" className="mt-2 text-sm text-crit-fg">
              Sisakan minimal satu barang.
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink-900"
            >
              Kembali
            </button>
            <button
              type="button"
              disabled={pending || !items.length}
              onClick={() =>
                void onSave(order.id, note, items)
                  .then(onClose)
                  .catch(() => undefined)
              }
              className="min-h-11 rounded-md bg-ink-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? 'Menyimpan...' : 'Simpan perubahan'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

async function prepareReceiptPhoto(file: File): Promise<string> {
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
    throw new Error('Foto tidak dapat dibuka. Pilih foto lain.')
  }
  try {
    const scale = Math.min(1, 960 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Foto belum dapat diproses di perangkat ini.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.78, 0.65, 0.5]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      if (dataUrl.length <= 680_000) return dataUrl
    }
    throw new Error('Foto masih terlalu besar. Pilih foto lain.')
  } finally {
    image.close()
  }
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

function ProfilePanel({
  user,
  onLogout,
}: {
  user: User
  onLogout: () => void
}) {
  const { refreshUser } = useAuth()
  const [name, setName] = useState(user.partner_name ?? '')
  const [picName, setPicName] = useState(
    user.partner_pic_name ?? user.full_name,
  )
  const [phone, setPhone] = useState(user.partner_phone ?? '')
  const [address, setAddress] = useState(user.partner_address ?? '')
  const [region, setRegion] = useState(user.partner_region ?? emptyRegion)
  const [photo, setPhoto] = useState<string | null>(user.partner_photo ?? null)
  const [photoError, setPhotoError] = useState('')
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false)

  useEffect(() => {
    setName(user.partner_name ?? '')
    setPicName(user.partner_pic_name ?? user.full_name)
    setPhone(user.partner_phone ?? '')
    setAddress(user.partner_address ?? '')
    setRegion(user.partner_region ?? emptyRegion)
    setPhoto(user.partner_photo ?? null)
  }, [user])

  const saveProfile = useMutation({
    mutationFn: async () => {
      await updateProfile({
        name: name.trim(),
        pic_name: picName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        ...region,
        photo_data_url: photo,
      })
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
    <section
      aria-labelledby="profile-heading"
      className="dashboard-panel-enter"
    >
      <p className="dashboard-eyebrow">Data mitra</p>
      <h1
        id="profile-heading"
        className="mt-1 text-2xl font-semibold text-ink-900 sm:text-3xl"
      >
        Profil mitra
      </h1>
      <p className="mt-2 text-sm text-muted">
        Perbarui data cabang yang digunakan untuk pengiriman barang.
      </p>

      <form
        className="dashboard-surface mt-6 space-y-5 p-4 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault()
          saveProfile.mutate()
        }}
      >
        <div className="flex flex-wrap items-center gap-4 border-b border-line pb-5">
          {photo ? (
            <img
              src={resolveImageUrl(photo) ?? ''}
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

        <div data-tour="profile-section" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="sm:col-span-2 lg:col-span-3">
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
        <div data-tour="profile-region">
          <RegionPicker
            idPrefix="profile-region"
            value={region}
            onChange={setRegion}
          />
        </div>
        <button
          type="submit"
          disabled={saveProfile.isPending || isProcessingPhoto}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-gray-400 px-5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto"
        >
          {saveProfile.isPending || isProcessingPhoto ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          Simpan profil
        </button>
      </form>
      <button
        type="button"
        onClick={onLogout}
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-semibold text-crit-fg transition-colors hover:border-crit/40 hover:bg-crit-bg hover:text-crit-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crit cursor-pointer"
      >
        <LogOut className="size-4" aria-hidden="true" /> Keluar dari akun
      </button>
    </section>
  )
}

function formatOrderDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'Tanggal pesanan tidak tersedia'
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (Number.isNaN(date.getTime())) return 'Tanggal pesanan tidak tersedia'

  const formatted = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)

  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function formatDetailedDateTime(
  dateInput: string | Date | null | undefined,
): string {
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

function formatCompactDateTime(
  dateInput: string | Date | null | undefined,
): string {
  if (!dateInput) return 'Waktu tidak tersedia'
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (Number.isNaN(date.getTime())) return 'Waktu tidak tersedia'

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
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

function formatWeekDateRange(weekDays: Date[]): string {
  if (weekDays.length < 7) return ''
  const first = weekDays[0]
  const last = weekDays[6]
  const firstDay = first.getDate()
  const lastDay = last.getDate()
  const firstMonth = first.toLocaleDateString('id-ID', { month: 'short' })
  const lastMonth = last.toLocaleDateString('id-ID', { month: 'short' })
  const year = last.getFullYear()

  return firstMonth === lastMonth
    ? `${firstDay} – ${lastDay} ${lastMonth} ${year}`
    : `${firstDay} ${firstMonth} – ${lastDay} ${lastMonth} ${year}`
}

function formatDayDate(dateInput: Date | string): string {
  const date =
    typeof dateInput === 'string'
      ? new Date(dateInput + 'T12:00:00')
      : dateInput
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
    <article className="min-w-0 px-3 py-3 sm:px-5 sm:py-4">
      <p className="text-xs font-medium text-ink-700 sm:text-sm">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums text-ink-900 sm:mt-2 sm:text-2xl">
        {value}
      </p>
      {detail ? (
        <p className="mt-1 hidden text-xs text-muted sm:block">{detail}</p>
      ) : null}
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
    <section
      aria-labelledby="mitra-logs-title"
      className="dashboard-panel-enter space-y-4 sm:space-y-6"
    >
      <div
        data-tour="stock-log-panel"
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="dashboard-eyebrow">Aktivitas stok</p>
          <h1
            id="mitra-logs-title"
            className="mt-1 font-display text-2xl font-semibold text-ink-900 sm:text-3xl"
          >
            Log stok
          </h1>
          <p className="mt-1 text-sm text-muted">
            Lihat stok keluar dan barang yang diterima cabang.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filteredLogs.length === 0}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink-900 shadow-2xs transition-colors hover:border-ink-400 hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="size-4" aria-hidden="true" />
          Unduh CSV
        </button>
      </div>

      <div className="flex items-center justify-start sm:justify-end">
        {/* View Mode Toggle */}
        <div className="flex w-full items-center rounded-lg border border-line bg-white p-1 text-sm font-semibold sm:w-auto">
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            aria-pressed={viewMode === 'calendar'}
            className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-all sm:flex-none ${
              viewMode === 'calendar'
                ? 'border border-emerald-300/90 bg-emerald-50 text-emerald-950 shadow-xs'
                : 'border border-transparent text-muted hover:text-ink-900'
            }`}
          >
            <Calendar className="size-3.5" aria-hidden="true" />
            <span>Kalender</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-pressed={viewMode === 'list'}
            className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-all sm:flex-none ${
              viewMode === 'list'
                ? 'border border-emerald-300/90 bg-emerald-50 text-emerald-950 shadow-xs'
                : 'border border-transparent text-muted hover:text-ink-900'
            }`}
          >
            <Clock className="size-3.5" aria-hidden="true" />
            <span>Daftar</span>
          </button>
        </div>
      </div>

      {query.isError ? (
        <ErrorState
          message={errorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      <div className="dashboard-surface grid grid-cols-2 divide-x divide-line sm:divide-x-0 lg:grid-cols-4 lg:divide-x">
        <div className="hidden sm:block">
          <MitraInsightMetric
            label="Total Log Tercatat"
            value={query.isLoading ? '…' : logs.length}
            detail="Seluruh riwayat perubahan stok"
          />
        </div>
        <MitraInsightMetric
          label="Stok keluar"
          value={query.isLoading ? '…' : `${totalConsumed} pcs`}
          detail="Konsumsi dari laporan stok fisik"
        />
        <MitraInsightMetric
          label="Stok masuk"
          value={query.isLoading ? '…' : `${totalReceived} pcs`}
          detail="Barang diterima dari pesanan selesai"
        />
        <div className="hidden sm:block">
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
            detail={
              latestUpdate
                ? formatDetailedDateTime(latestUpdate)
                : 'Belum ada data'
            }
          />
        </div>
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
          <div className="flex flex-col gap-2.5 rounded-lg border border-line bg-white p-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
            {/* Grup kontrol navigasi < dan > berdampingan mengapit tanggal */}
            <div className="flex items-center justify-between gap-1.5 sm:justify-start sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  setWeekOffset((w) => w - 1)
                  setSelectedBatch(null)
                }}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-ink-900 transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 active:scale-95 focus-visible:outline-2 focus-visible:outline-emerald-600"
                title="Geser ke minggu sebelumnya (<)"
                aria-label="Minggu sebelumnya"
              >
                <ChevronLeft className="size-4.5" aria-hidden="true" />
              </button>

              <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 text-center sm:flex-initial sm:justify-start">
                <Calendar
                  className="hidden size-4 shrink-0 text-emerald-700 sm:block"
                  aria-hidden="true"
                />
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {weekOffset === 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/80 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-900 shadow-2xs">
                      <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      Minggu Ini
                    </span>
                  ) : weekOffset === -1 ? (
                    <span className="inline-flex items-center rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs font-semibold text-muted">
                      Minggu Kemarin
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs font-semibold text-muted">
                      {Math.abs(weekOffset)} Minggu Lalu
                    </span>
                  )}
                  <span className="font-display text-xs font-bold tabular-nums text-ink-900 sm:text-sm">
                    ({formatWeekDateRange(weekDays)})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setWeekOffset((w) => Math.min(0, w + 1))
                  setSelectedBatch(null)
                }}
                disabled={weekOffset >= 0}
                className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg border transition-all ${
                  weekOffset >= 0
                    ? 'border-line/60 bg-paper/60 text-muted/40 cursor-not-allowed'
                    : 'border-line bg-paper text-ink-900 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 active:scale-95 cursor-pointer'
                } focus-visible:outline-2 focus-visible:outline-emerald-600`}
                title={
                  weekOffset >= 0
                    ? 'Sudah berada di minggu ini'
                    : 'Geser ke minggu berikutnya (>)'
                }
                aria-label="Minggu berikutnya"
              >
                <ChevronRight className="size-4.5" aria-hidden="true" />
              </button>
            </div>

            {/* Tombol Kembali ke Minggu Ini (Hanya muncul jika bukan minggu ini) */}
            {weekOffset !== 0 ? (
              <button
                type="button"
                onClick={() => {
                  setWeekOffset(0)
                  setSelectedBatch(null)
                }}
                className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-300/80 bg-emerald-50 px-3.5 text-xs font-bold text-emerald-950 shadow-2xs transition-all hover:bg-emerald-100 hover:border-emerald-400 active:scale-98 sm:w-auto"
              >
                <Calendar
                  className="size-3.5 text-emerald-700"
                  aria-hidden="true"
                />
                <span>Kembali ke Minggu Ini</span>
              </button>
            ) : null}
          </div>

          {/* Grid 7 Hari (Senin sampai Minggu) */}
          <div className="overflow-x-auto pb-1">
            <div className="grid min-w-[332px] grid-cols-7 gap-1 sm:min-w-0 sm:gap-2">
              {weekDays.map((d, index) => {
                const dStr = toLocalDateStr(d)
                const isSelected = dStr === activeDateStr
                const isToday = dStr === todayStr
                const count = logsByDate.get(dStr)?.length ?? 0
                const dayNameShort = [
                  'Sen',
                  'Sel',
                  'Rab',
                  'Kam',
                  'Jum',
                  'Sab',
                  'Min',
                ][index]
                const dayNameFull = [
                  'Senin',
                  'Selasa',
                  'Rabu',
                  'Kamis',
                  'Jumat',
                  'Sabtu',
                  'Minggu',
                ][index]
                const dayNumber = d.getDate()

                return (
                  <button
                    key={dStr}
                    type="button"
                    onClick={() => {
                      setSelectedDateStr(dStr)
                      setSelectedBatch(null)
                    }}
                    aria-label={`${dayNameFull}, ${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}, ${count} catatan${isToday ? ', hari ini' : ''}`}
                    aria-pressed={isSelected}
                    className={`group relative flex min-h-16 flex-col items-center justify-center rounded-md border px-0.5 py-1 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600 sm:justify-between sm:p-2.5 ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/25'
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

                    <div className="hidden items-center gap-1 sm:flex">
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

                    {count > 0 ? (
                      <span
                        className={`size-1.5 rounded-full sm:hidden ${isSelected ? 'bg-white' : 'bg-ok'}`}
                        aria-hidden="true"
                      />
                    ) : null}

                    {isToday ? (
                      <span
                        className={`absolute -top-1.5 right-1 hidden rounded-sm px-1 text-[8px] font-bold uppercase tracking-wider sm:block ${
                          isSelected
                            ? 'bg-white text-emerald-800'
                            : 'bg-emerald-700 text-white'
                        }`}
                      >
                        Hari Ini
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Panel Detail Hari Terpilih & Jam-Jam Perubahan */}
          <div className="rounded-md border border-line bg-white p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col gap-2 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar
                    className="size-4 text-ink-700"
                    aria-hidden="true"
                  />
                  <h2 className="font-display text-base font-bold text-ink-900">
                    {formatDayDate(activeDateObj)}
                  </h2>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {dayBatches.length > 0
                    ? `${activeDateLogs.length} catatan stok`
                    : 'Belum ada catatan pada tanggal ini'}
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
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {dayBatches.map((batch) => (
                      <button
                        key={batch.key}
                        type="button"
                        onClick={() => setSelectedBatch(batch)}
                        className="group flex min-h-16 flex-col justify-center gap-2 rounded-md border border-line bg-white p-3 text-left transition-colors hover:border-ink-500 hover:bg-ink-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700 sm:p-3.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div>
                              <span className="font-display text-sm font-bold text-ink-900">
                                {batch.timeFormatted}
                              </span>
                              <p className="text-xs text-ink-700">
                                {batch.sourceLabel} · {batch.totalItems} produk
                              </p>
                            </div>
                          </div>
                          <ChevronRight
                            className="size-4 shrink-0 text-ink-700"
                            aria-hidden="true"
                          />
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <div className="flex items-center gap-2 font-semibold tabular-nums">
                            {batch.totalConsumed > 0 ? (
                              <span className="text-crit-fg">
                                Keluar {batch.totalConsumed} pcs
                              </span>
                            ) : null}
                            {batch.totalRestocked > 0 ? (
                              <span className="text-ok-fg">
                                Masuk {batch.totalRestocked} pcs
                              </span>
                            ) : null}
                          </div>
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
                  Semua catatan
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {filteredLogs.length} dari {logs.length} catatan
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <div className="relative col-span-2 sm:w-52">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  aria-label="Cari produk dalam catatan stok"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari produk..."
                  className="h-11 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm text-ink-900 placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink-700"
                />
              </div>

              {productOptions.length > 1 ? (
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="h-11 min-w-0 rounded-md border border-line bg-white px-2 text-sm text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink-700 sm:px-3"
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
                className={`h-11 min-w-0 rounded-md border border-line bg-white px-2 text-sm text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink-700 sm:px-3 ${productOptions.length > 1 ? '' : 'col-span-2'}`}
                aria-label="Filter berdasarkan tipe aktivitas"
              >
                <option value="all">Semua Tipe</option>
                <option value="manual_update">Laporan stok</option>
                <option value="order_received">Barang diterima</option>
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
                    ? 'Laporan stok'
                    : log.source === 'order_received'
                      ? 'Barang diterima'
                      : 'Penyesuaian stok'

                return (
                  <article
                    key={log.id}
                    className="flex flex-col gap-2 p-4 transition-colors hover:bg-ink-50/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug text-ink-900">
                        {log.product_name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-700">
                        <span className="font-medium text-ink-700">
                          <span className="sm:hidden">
                            {formatCompactDateTime(log.created_at)}
                          </span>
                          <span className="hidden sm:inline">
                            {formatDetailedDateTime(log.created_at)}
                          </span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-xs">{sourceLabel}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="flex items-center gap-1.5 text-xs tabular-nums text-ink-700 sm:rounded-md sm:border sm:border-line sm:bg-white sm:px-2.5 sm:py-1 sm:text-sm">
                        <span className="sm:hidden">Stok</span>
                        <span>{log.qty_before}</span>
                        <span className="text-xs text-muted" aria-hidden="true">
                          →
                        </span>
                        <span className="font-semibold text-ink-900">
                          {log.qty_after}
                        </span>
                      </div>
                      <span
                        className={`min-w-16 text-right text-sm font-bold tabular-nums sm:rounded sm:px-2 sm:py-1 sm:text-center sm:text-xs ${
                          isConsumption
                            ? 'text-crit-fg sm:bg-crit-bg'
                            : isRestock
                              ? 'text-ok-fg sm:bg-ok-bg'
                              : 'text-ink-700 sm:bg-ink-100'
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
