import { apiRequest } from './client'
import type { OperationalInsightResponse } from '@/data/operational-insight-fallback'

export interface AnalysisRun {
  id: string
  start_date: string
  end_date: string
  status: 'creating' | 'draft' | 'approved' | 'rejected' | 'processing' | 'published' | 'failed'
  is_active: boolean
  created_at: string
  approved_at: string | null
  published_at: string | null
  current_step: string | null
  error: string | null
  manifest: { partner_product_rows?: number; product_count?: number; sha256?: Record<string, string>; training_source?: 'analysis' | 'raw_references' } | null
  steps: Array<{ label: string; status: 'running' | 'succeeded' | 'failed' }>
}

export interface AnalysisArtifacts {
  status: AnalysisRun['status']
  manifest: AnalysisRun['manifest'] & { run_id?: string; start_date?: string; end_date?: string; timezone?: string; generated_at?: string }
  json: Record<string, unknown>
  csv_preview: string
  markdown: string
  categories: Record<'products' | 'partners' | 'regions' | 'reporting', { category: string; items: unknown[] }>
}

export async function getAnalysisRuns() {
  return apiRequest<{ runs: AnalysisRun[]; active_run_id: string | null }>('/analysis/runs')
}

export async function getAnalysisArtifacts(id: string) {
  return apiRequest<AnalysisArtifacts>(`/analysis/runs/${id}/artifacts`)
}

export async function createAnalysisRun(start_date: string, end_date: string) {
  return apiRequest<{ id: string }>('/analysis/runs', { method: 'POST', body: JSON.stringify({ start_date, end_date }) })
}

export interface RawReference {
  id: string
  category: string
  file_name: string
  size_bytes: number
  sha256: string
  created_at: string
  origin: 'admin' | 'migration'
}

export async function getRawReferences() {
  return apiRequest<{ files: RawReference[] }>('/analysis/raw-references')
}

export async function uploadRawReference(file: File) {
  const body = new FormData()
  body.append('file', file)
  return apiRequest<{ file: RawReference }>('/analysis/raw-references', { method: 'POST', body })
}

export async function deleteRawReference(id: string) {
  return apiRequest<{ deleted: boolean; id: string }>(`/analysis/raw-references/${id}`, { method: 'DELETE' })
}

export async function actionAnalysisRun(id: string, action: 'approve' | 'process' | 'rollback' | 'reject', reason?: string,
  training_source?: 'analysis' | 'raw_references') {
  const body = reason || training_source ? JSON.stringify({ ...(reason ? { reason } : {}), ...(training_source ? { training_source } : {}) }) : undefined
  return apiRequest(`/analysis/runs/${id}/${action}`, { method: 'POST', body })
}

export async function createAnalysisTeamUser(input: { full_name: string; email: string; password: string; role: 'data_science' | 'ai_engineer' }) {
  return apiRequest('/analysis/team-users', { method: 'POST', body: JSON.stringify(input) })
}

export interface ProductAbsorptionItem {
  product_id: string
  product_name: string
  weekly_consumption: number
  current_qty: number
  par_level: number
  absorption_rate: number
  predicted_risk_level: 'Aman' | 'Waspada' | 'Kritis'
  predicted_days_to_stockout: number
  urgency_lead_time_breached: boolean
}

export interface PartnerAbsorptionRanking {
  rank: number
  partner_id: string
  partner_name: string
  city: string
  province: string
  cluster_code: 'TIPE_A' | 'TIPE_B' | 'TIPE_C' | 'INACTIVE'
  segment_name: string
  recommended_schedule: string
  actionable_strategy: string
  is_active_partner: boolean
  performance_tier: 'top_performer' | 'steady' | 'slow_moving' | 'inactive'
  tier_label: string
  tier_score: number
  avg_absorption_rate: number
  total_weekly_consumption: number
  total_current_stock: number
  dominant_risk_level: 'Aman' | 'Waspada' | 'Kritis'
  min_days_to_stockout: number
  has_lead_time_breach: boolean
  products: ProductAbsorptionItem[]
}

export interface AbsorptionPeriod {
  id: string
  label: string
  date_range: string
  start_date: string
  end_date: string
  is_current: boolean
}

export interface WeeklyAbsorptionMatrixResponse {
  metadata: {
    version: string
    pipeline_name: string
    generated_at: string
    current_period_id: string
    current_period_label: string
    total_partners: number
    active_partners: number
    inactive_partners: number
    official_products: string[]
    data_sources: string[]
  }
  available_periods: AbsorptionPeriod[]
  available_cities: string[]
  summary: {
    network_avg_absorption_rate: number
    top_performer_count: number
    steady_count: number
    slow_moving_count: number
    inactive_count: number
    critical_risk_count: number
    warning_risk_count: number
    lead_time_breached_count: number
  }
  period_data: Record<
    string,
    {
      period_id: string
      rankings: PartnerAbsorptionRanking[]
    }
  >
}

export async function getWeeklyAbsorptionMatrix(): Promise<WeeklyAbsorptionMatrixResponse> {
  return apiRequest<WeeklyAbsorptionMatrixResponse>('/analysis/weekly-absorption-matrix')
}

export type {
  PriorityActionItem,
  CityInsightItem,
  PeriodInsightItem,
  OperationalInsightResponse,
} from '@/data/operational-insight-fallback'

export async function getOperationalInsight() {
  return apiRequest<OperationalInsightResponse>('/analysis/operational-insight')
}
