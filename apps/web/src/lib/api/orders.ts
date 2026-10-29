import { apiClient } from './client'
import type { Order, OrderStatus } from '@/lib/inventory-types'

export interface CreateOrderItemPayload {
  product_id: string
  qty_requested: number
}

export interface CreateOrderPayload {
  items: CreateOrderItemPayload[]
  note?: string
}

export interface UpdateOrderPayload {
  items: CreateOrderItemPayload[]
  note?: string
}

export interface ApproveOrderItemPayload {
  product_id: string
  qty_approved: number
}

export interface ApproveOrderPayload {
  note?: string
  admin_note?: string
  items?: ApproveOrderItemPayload[]
}

export interface UpdateOrderStatusPayload {
  status: OrderStatus
  rejected_reason?: string
}

export interface ShipmentLogItem {
  id: string
  order_no: string
  partner_name: string
  status: OrderStatus
  shipped_at: string
  items: Array<{
    order_id: string
    product_name: string
    product_unit: string
    qty_approved: number | null
  }>
}

export type ShipmentLog = ShipmentLogItem

export interface ShipmentLogPage {
  total: number
  page: number
  page_size: number
  data: ShipmentLogItem[]
}

export interface ReceiptProofData {
  photo_data_url: string
  verified_at: string | null
}

/**
 * Mengambil daftar seluruh pesanan restock (opsional difilter berdasarkan partner_id).
 */
export async function getOrders(query?: { partner_id?: string }): Promise<Order[]> {
  const qs = query?.partner_id ? `?partner_id=${encodeURIComponent(query.partner_id)}` : ''
  const response = await apiClient.get<{ data: Order[] }>(`/orders${qs}`)
  return response.data
}

/**
 * Mengambil detail satu pesanan berdasarkan ID.
 */
export async function getOrderById(orderId: string): Promise<Order | null> {
  const orders = await getOrders()
  return orders.find((o) => o.id === orderId) ?? null
}

/**
 * Mengajukan pesanan restock multi-item baru dari mitra cabang ke gudang pusat.
 */
export async function createOrder(payload: CreateOrderPayload): Promise<{ status: string }> {
  return apiClient.post<{ status: string }>('/orders', payload)
}

/**
 * Mengubah rincian kuantitas atau catatan pesanan yang masih berstatus 'diproses'.
 */
export async function updateOrder(orderId: string, payload: UpdateOrderPayload): Promise<{ status: string }> {
  return apiClient.put<{ status: string }>(`/orders/${orderId}`, payload)
}

/**
 * Membatalkan pesanan restock (sebelum pengiriman).
 */
export async function cancelOrder(orderId: string): Promise<{ status: string }> {
  return apiClient.patch<{ status: string }>(`/orders/${orderId}/cancel`)
}

/**
 * Menyetujui kuantitas per item pesanan oleh Admin Daisuki Pusat.
 */
export async function approveOrder(orderId: string, payload: ApproveOrderPayload): Promise<{ status: string }> {
  return apiClient.patch<{ status: string }>(`/orders/${orderId}/approval`, payload)
}

/**
 * Mengubah status pesanan restock (misal: 'dalam_pengiriman' atau 'ditolak').
 */
export async function updateOrderStatus(orderId: string, payload: UpdateOrderStatusPayload): Promise<{ status: string }> {
  return apiClient.patch<{ status: string }>(`/orders/${orderId}/status`, payload)
}

/**
 * Mengubah status pesanan menjadi 'dalam_pengiriman' saat kurir ekspedisi berangkat.
 */
export async function shipOrder(orderId: string): Promise<{ status: string }> {
  return updateOrderStatus(orderId, { status: 'dalam_pengiriman' })
}

/**
 * Menolak pesanan dengan menyertakan alasan penolakan.
 */
export async function rejectOrder(orderId: string, reason: string): Promise<{ status: string }> {
  return updateOrderStatus(orderId, { status: 'ditolak', rejected_reason: reason })
}

/**
 * Memverifikasi penerimaan pengiriman oleh mitra cabang menggunakan kode resi (barcode/QR).
 */
export async function confirmOrderReceipt(orderId: string, code: string): Promise<{ status: string }> {
  return apiClient.post<{ status: string }>(`/orders/${orderId}/verify-delivery`, { code })
}

/**
 * Mengambil data foto bukti penerimaan pesanan.
 */
export async function getOrderReceiptProof(orderId: string): Promise<ReceiptProofData> {
  const response = await apiClient.get<{ data: ReceiptProofData } | ReceiptProofData>(`/orders/${orderId}/receipt-proof`)
  if ('data' in response) {
    return response.data
  }
  return response
}

/**
 * Mengunggah foto bukti fisik penerimaan resi oleh mitra cabang.
 */
export async function uploadReceiptProof(orderId: string, photoDataUrl: string): Promise<{ status: string }> {
  return apiClient.patch<{ status: string }>(`/orders/${orderId}/receipt-proof`, { photo_data_url: photoDataUrl })
}

/**
 * Meminta ulang foto bukti penerimaan pesanan oleh admin pusat jika belum jelas.
 */
export async function requestReceiptProof(orderId: string): Promise<{ status: string }> {
  return apiClient.patch<{ status: string }>(`/orders/${orderId}/request-receipt-proof`)
}

/**
 * Mengambil log pengiriman dengan pagination untuk admin pusat.
 */
export async function getShipmentLogs(page = 1, pageSize = 10): Promise<ShipmentLogPage> {
  return apiClient.get<ShipmentLogPage>(`/admin/shipment-logs?page=${page}&page_size=${pageSize}`)
}

