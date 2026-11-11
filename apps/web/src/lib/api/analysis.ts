import { apiRequest } from './client'

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
  manifest: { partner_product_rows?: number; product_count?: number; sha256?: Record<string, string> } | null
  steps: Array<{ label: string; status: 'running' | 'succeeded' | 'failed' }>
}

export interface AnalysisArtifacts {
  status: AnalysisRun['status']
  manifest: AnalysisRun['manifest'] & { run_id?: string; start_date?: string; end_date?: string; timezone?: string; generated_at?: string }
  json: Record<string, unknown>
  csv_preview: string
  markdown: string
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

export async function actionAnalysisRun(id: string, action: 'approve' | 'process' | 'rollback' | 'reject', reason?: string) {
  return apiRequest(`/analysis/runs/${id}/${action}`, { method: 'POST', body: reason ? JSON.stringify({ reason }) : undefined })
}

export async function createAnalysisTeamUser(input: { full_name: string; email: string; password: string; role: 'data_science' | 'ai_engineer' }) {
  return apiRequest('/analysis/team-users', { method: 'POST', body: JSON.stringify(input) })
}
