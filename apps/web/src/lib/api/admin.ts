import { apiClient } from './client'
import type { RegionalActivity } from '@/components/inventory/regional-analysis'

export interface AdminMetrics {
  totalBranches: number
  criticalBranches: number
  pendingOrders: number
  criticalItemsCount: number
}

export interface WeeklySummary {
  total_logs_this_week: number
  active_partners_count: number
  total_units_consumed: number
  daily_update_breakdown: Array<{ day: string; active_partners: number; log_count: number }>
  partner_daily_log_breakdown: Array<{
    day: string
    partner_id: string
    partner_name: string
    log_count: number
  }>
}

export interface AIInsights {
  regional_activity?: RegionalActivity
  engine_status?: {
    is_active: boolean
    last_run_at: string
    version: string
  }
  kpi_summary?: {
    weekly_sales_units: number
    sales_growth_percentage: number
    restock_fulfillment_rate: number
    central_stock_health_days: number
    critical_high_turnover_count: number
    stockout_risk_count: number
  }
  fast_moving_products?: Array<{
    partner_id: string
    partner_name: string
    partner_type: string
    product_id: string
    product_name: string
    product_sku: string
    current_qty: number
    par_level: number
    weekly_consumption: number
    daily_velocity: number
    critical_frequency: number
    turnover_rate: number
    suggested_par_level: number
    par_delta: number
    reason: string
  }>
  stockout_deficit_analysis?: Array<{
    partner_id: string
    partner_name: string
    partner_type: string
    product_id: string
    product_name: string
    current_qty: number
    par_level: number
    days_of_cover: number
    critical_frequency: number
    root_cause: 'UNDER_CAPACITY' | 'LATE_REORDER' | 'SUPPLY_DEFICIT'
    root_cause_label: string
    risk_level: 'DARURAT' | 'WASPADA'
    action_recommendation: string
  }>
  factory_procurement_forecast?: Array<{
    product_id: string
    product_name: string
    product_sku: string
    central_stock: number
    total_partner_demand_weekly: number
    estimated_runout_days: number
    suggested_factory_batch_order: number
    urgency: 'CRITICAL' | 'WARNING' | 'HEALTHY'
  }>
  frequent_stockouts: Array<{
    partner_id: string
    partner_name: string
    product_id: string
    product_name: string
    current_qty: number
    par_level: number
    critical_log_count: number
  }>
  recommendations: Array<{
    partner_id: string
    partner_name: string
    product_id: string
    product_name: string
    forecast_qty: number
    suggested_qty: number
    days_of_cover: string | null
    model_version: string
    metadata?: {
      predicted_demand_units: number
      recommended_qty: number
      urgency: 'CRITICAL' | 'WARNING' | 'NORMAL'
      reasoning: string
    } | null
    generated_at: string
  }>
  market_hotspots?: {
    top_performers: Array<{ partner_name: string; region: string; weekly_units: number }>
    regions: Array<{ region: string; deficit_units: number; partner_count: number }>
  }
  naive_bayes_analysis?: {
    model_version: string
    algorithm: string
    features_evaluated: string[]
    summary: {
      total_items_analyzed: number
      high_risk_items_count: number
      surge_detected_count: number
      red_zone_regions_count: number
      yellow_zone_regions_count: number
      green_zone_regions_count: number
    }
    high_risk_items: Array<{
      partner_id: string
      partner_name: string
      partner_type: string
      province_name: string
      regency_name: string
      product_id: string
      product_name: string
      product_sku: string
      current_qty: number
      daily_velocity: number
      days_of_cover: number
      sales_surge_ratio: number
      stockout_probability: number
      risk_level: 'TINGGI' | 'SEDANG' | 'RENDAH'
      dominant_factor: string
      suggested_restock_units: number
    }>
    regional_hotspots: Array<{
      province_name: string
      regency_name: string
      total_partners: number
      critical_partners_count: number
      warning_partners_count: number
      average_stockout_probability: number
      peak_stockout_probability: number
      zone: 'ZONA_MERAH' | 'ZONA_KUNING' | 'ZONA_HIJAU'
      primary_risk_driver: string
      recommended_action: string
      partners: Array<{
        partner_id: string
        partner_name: string
        max_stockout_probability: number
        average_stockout_probability: number
        zone: 'ZONA_MERAH' | 'ZONA_KUNING' | 'ZONA_HIJAU'
        urgent_items: Array<{
          product_name: string
          stockout_probability: number
        }>
      }>
    }>
  }
  ai_digest?: {
    headline: string
    sales_insight: string
    restock_insight: string
    procurement_insight: string
    generated_at: string
  }
}

/**
 * Mengambil ringkasan metrik dashboard admin (total cabang, cabang kritis, pesanan pending).
 */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  return apiClient.get<AdminMetrics>('/admin/metrics')
}

/**
 * Mengambil rekap konsumsi mingguan jaringan cabang Daisuki.
 */
export async function getWeeklySummary(): Promise<WeeklySummary> {
  const response = await apiClient.get<{ data: WeeklySummary }>('/admin/weekly-summary')
  return response.data
}

/**
 * Mengambil hasil analisis cerdas & rekomendasi rantai pasok dari model AI/Data Science.
 */
export async function getAiInsights(): Promise<AIInsights> {
  const response = await apiClient.get<{ data: AIInsights }>('/admin/ai-insights')
  return response.data
}

/**
 * Menjalankan pipeline komputasi analitik AI secara manual.
 */
export interface AiRunStatus {
  status: 'idle' | 'running' | 'succeeded' | 'failed'
  started_at: string | null
  finished_at: string | null
}

export async function getAiRunStatus(): Promise<AiRunStatus> {
  return apiClient.get<AiRunStatus>('/admin/ai-insights/run')
}

export async function triggerAiInsights(): Promise<AiRunStatus> {
  return apiClient.post<AiRunStatus>('/admin/ai-insights/run')
}

/**
 * Memeriksa status kesehatan koneksi basis data PostgreSQL Neon.
 */
export async function checkDatabaseHealth(): Promise<{ status: string }> {
  return apiClient.get<{ status: string }>('/health/db')
}

