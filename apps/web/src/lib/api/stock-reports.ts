import { apiClient, apiFetch } from './client'
import type { StockLog } from '@/lib/inventory-types'

export interface ReportDailyStockItem {
  product_id: string
  current_qty: number
}

export interface ReportDailyStockPayload {
  items: ReportDailyStockItem[]
  partner_id?: string
}

export interface PartnerStockLogSummary {
  partner_id: string
  partner_name: string
  log_count: number
  latest_update: string
}

export type StockLogPartner = PartnerStockLogSummary

/**
 * Melaporkan sisa stok fisik harian di rak toko mitra.
 */
export async function reportDailyStock(payload: ReportDailyStockPayload): Promise<{ status: string }> {
  return apiClient.put<{ status: string }>('/stocks', payload)
}

/**
 * Mengambil histori log perubahan stok untuk cabang mitra tertentu.
 */
export async function getStockLogs(query?: { partner_id?: string }): Promise<StockLog[]> {
  const qs = query?.partner_id ? `?partner_id=${encodeURIComponent(query.partner_id)}` : ''
  const response = await apiClient.get<{ data: StockLog[] }>(`/stocks/logs${qs}`)
  return response.data
}

/**
 * Mengambil ringkasan aktivitas log pembaruan stok seluruh mitra cabang (khusus Admin).
 */
export async function getPartnerStockLogs(): Promise<PartnerStockLogSummary[]> {
  const response = await apiClient.get<{ data: PartnerStockLogSummary[] }>('/admin/stock-logs/partners')
  return response.data
}

/**
 * Mengambil seluruh riwayat log perubahan stok milik satu cabang mitra (khusus Admin).
 */
export async function getPartnerStockLogsById(partnerId: string): Promise<StockLog[]> {
  const response = await apiClient.get<{ data: StockLog[] }>(`/admin/stock-logs/partners/${partnerId}`)
  return response.data
}

/**
 * Mengunduh file ekspor CSV dari seluruh mutasi log stok.
 */
export async function exportStockLogs(): Promise<Blob> {
  const response = await apiFetch('/admin/stock-logs/export')
  if (!response.ok) {
    throw new Error('Ekspor log belum berhasil.')
  }
  return response.blob()
}

