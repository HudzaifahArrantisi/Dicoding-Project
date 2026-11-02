import { apiClient } from './client'
import type { NotificationItem, OrderStatus } from '@/lib/inventory-types'

export interface AlertOrderItem {
  product_name: string
  product_unit: string
  qty_requested: number
  qty_approved: number | null
}

export interface AlertOrder {
  id: string
  order_no: string
  partner_id: string
  status: OrderStatus
  created_at: string
  rejected_reason: string | null
  items: AlertOrderItem[]
}

export const EMPTY_ALERT_ORDERS: AlertOrder[] = []

export interface NotificationFeed {
  data: NotificationItem[]
  orders: AlertOrder[]
}

export interface MarkNotificationResponse {
  status: string
  read_at: string
  ids: string[]
}

/**
 * Mengambil daftar notifikasi peringatan (alert) untuk Admin Pusat.
 */
export async function getAdminNotifications(): Promise<NotificationFeed> {
  const response = await apiClient.get<{
    data: NotificationItem[]
    orders: AlertOrder[]
  }>('/notification')

  return {
    data: response.data.map((item) => ({
      ...item,
      read_at: item.read_at ? new Date(item.read_at).toISOString() : null,
      created_at: new Date(item.created_at).toISOString(),
    })),
    orders: response.orders.map((order) => ({
      ...order,
      created_at: new Date(order.created_at).toISOString(),
    })),
  }
}

/**
 * Menandai satu notifikasi telah dibaca.
 */
export async function markNotificationRead(id: string): Promise<MarkNotificationResponse> {
  return apiClient.patch<MarkNotificationResponse>('/notification', { id })
}

/**
 * Menandai seluruh notifikasi yang belum dibaca menjadi sudah dibaca.
 */
export async function markAllNotificationsRead(): Promise<MarkNotificationResponse> {
  return apiClient.patch<MarkNotificationResponse>('/notification', { all: true })
}

