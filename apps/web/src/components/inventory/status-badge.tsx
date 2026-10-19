import type { OrderStatus, StockStatus } from '@daisuki/shared'
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  PackageCheck,
  PackageX,
  Truck,
  XCircle,
} from 'lucide-react'

const stockConfig = {
  aman: {
    label: 'Aman',
    className: 'bg-ok-bg text-ok-fg',
    Icon: CheckCircle2,
  },
  waspada: {
    label: 'Waspada',
    className: 'bg-warn-bg text-warn-fg',
    Icon: AlertTriangle,
  },
  kritis: {
    label: 'Kritis',
    className: 'bg-crit-bg text-crit-fg',
    Icon: AlertOctagon,
  },
} satisfies Record<
  StockStatus,
  { label: string; className: string; Icon: typeof CheckCircle2 }
>

const orderConfig = {
  diproses: {
    label: 'Menunggu persetujuan',
    className: 'bg-order-diproses-bg text-order-diproses',
    Icon: Clock3,
  },
  disetujui: {
    label: 'Disetujui',
    className: 'bg-order-disetujui-bg text-order-disetujui',
    Icon: PackageCheck,
  },
  dalam_pengiriman: {
    label: 'Dalam pengiriman',
    className: 'bg-order-pengiriman-bg text-order-pengiriman',
    Icon: Truck,
  },
  selesai: {
    label: 'Selesai',
    className: 'bg-order-selesai-bg text-order-selesai',
    Icon: CheckCircle2,
  },
  ditolak: {
    label: 'Ditolak',
    className: 'bg-order-ditolak-bg text-order-ditolak',
    Icon: XCircle,
  },
  dibatalkan: {
    label: 'Dibatalkan',
    className: 'bg-order-dibatalkan-bg text-order-dibatalkan',
    Icon: PackageX,
  },
} satisfies Record<
  OrderStatus,
  { label: string; className: string; Icon: typeof CheckCircle2 }
>

export function StockStatusBadge({ status }: { status: StockStatus }) {
  const { label, className, Icon } = stockConfig[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-semibold ${className}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  )
}

export function StaleBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-stale-bg px-2 py-1 text-xs font-semibold text-stale-fg">
      <Clock3 className="size-3.5" aria-hidden="true" />
      Belum update
    </span>
  )
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, className, Icon } = orderConfig[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-semibold ${className}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  )
}
