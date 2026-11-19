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
