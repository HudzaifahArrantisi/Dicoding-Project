import { apiClient } from './client'
import type { StockItem } from '@/lib/inventory-types'

export interface RestockRecommendation {
  id: string
  partner_id: string
  partner_name: string
  product_id: string
  product_name: string
  product_sku: string
  forecast_qty: number
  suggested_qty: number
  days_of_cover: number
  model_version: string
  generated_at: string
}

/**
 * Mengambil data inventaris stok cabang (beserta status kesehatan stok, par level, dan kalkulasi persentase).
 * Mitra cabang otomatis hanya melihat stok tokonya sendiri; Admin dapat menyaring berdasarkan partner_id.
 */
export async function getStocks(query?: { partner_id?: string }): Promise<StockItem[]> {
  const qs = query?.partner_id ? `?partner_id=${encodeURIComponent(query.partner_id)}` : ''
  const response = await apiClient.get<{ data: StockItem[]; total: number }>(`/stocks${qs}`)
  return response.data
}

/**
 * Mengambil rekomendasi restock otomatis dari model Data Science/AI.
 */
export async function getRestockRecommendations(query?: { partner_id?: string }): Promise<RestockRecommendation[]> {
  const qs = query?.partner_id ? `?partner_id=${encodeURIComponent(query.partner_id)}` : ''
  const response = await apiClient.get<{ data: RestockRecommendation[] }>(`/stocks/recommendations${qs}`)
  return response.data
}

