import type { OrderStatus, StockStatus } from '@daisuki/shared'

export interface StockItem {
  partner_id: string
  partner_name: string
  partner_type: string
  product_id: string
  product_sku: string
  product_name: string
  product_unit: string
  b2b_price: string
  central_stock?: number
  current_qty: number
  par_level: number
  updated_at: string
  percentage: number
  status: StockStatus
  is_stale: boolean
}

export interface OrderItem {
  id: string
  product_id: string
  product_name: string
  product_sku: string
  product_unit: string
  qty_requested: number
  qty_approved: number | null
}

export interface Product {
  id: string
  sku: string
  name: string
  unit: string
  b2b_price: string
  central_stock: number
  is_active: boolean
}

export interface Order {
  id: string
  order_no: string
  partner_id: string
  partner_name: string
  partner_type: string
  status: OrderStatus
  status_label: string
  note: string | null
  admin_note?: string | null
  rejected_reason?: string | null
  created_at: string
  approved_at: string | null
  shipped_at: string | null
  completed_at: string | null
  items: OrderItem[]
}

export interface NotificationItem {
  id: string
  audience: string
  type: string
  partner_id: string | null
  partner_name: string | null
  title: string
  body: string | null
  read_at: string | null
  created_at: string
}
