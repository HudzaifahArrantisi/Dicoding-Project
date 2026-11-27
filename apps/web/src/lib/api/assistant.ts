import { apiClient, apiFetch } from './client'
import { readAssistantSse } from './assistant-sse'

export type MitraTour = 'restock' | 'stock_report' | 'delivery' | 'logs' | 'profile'

export interface AssistantQuotaStatus {
  used: number
  limit: number
  remaining: number
  window_hours: number
  reset_at: string | null
  retry_after_seconds: number
  burst_cooldown_seconds: number
  in_flight: boolean
}

export class AssistantQuotaError extends Error {
  status: number
  reason?: string
  quota?: AssistantQuotaStatus

  constructor(message: string, status: number, reason?: string, quota?: AssistantQuotaStatus) {
    super(message)
    this.name = 'AssistantQuotaError'
    this.status = status
    this.reason = reason
    this.quota = quota
  }
}

export interface MitraAssistantReply {
  reply: string
  source: 'llm' | 'fallback'
  suggestedTour?: MitraTour
  tourLabel?: string
  quickReplies: string[]
  interactionId: string
  modelAvailable: boolean
  session_id?: string
  visualization?: MitraStockVisualization | null
  quota?: AssistantQuotaStatus
}

export interface MitraStockVisualization {
  type: 'bar'
  title: string
  unit: string
  items: Array<{ label: string; value: number }>
}

export interface MitraChatHistoryItem {
  id: string
  message: string
  reply: string
  visualization?: MitraStockVisualization | null
  source: 'llm' | 'fallback'
  intent: MitraTour | null
  feedback: -1 | 1 | null
  created_at: string
}

export interface MitraChatSession {
  session_id: string
  title: string | null
  last_at: string
  message_count: number
  summary: string | null
  is_closed: boolean
}

export async function getMitraChatSessions(): Promise<MitraChatSession[]> {
  const response = await apiClient.get<{ data: MitraChatSession[] }>('/assistant/mitra/sessions')
  return response.data
}

export async function getMitraChatSession(
  sessionId: string,
): Promise<{ data: MitraChatHistoryItem[]; summary: string | null; quota?: AssistantQuotaStatus }> {
  return apiClient.get<{ data: MitraChatHistoryItem[]; summary: string | null; quota?: AssistantQuotaStatus }>(
    '/assistant/mitra/history',
    { headers: { 'x-session-id': sessionId } },
  )
}

export async function getMitraChatQuota(): Promise<AssistantQuotaStatus> {
  const response = await apiClient.get<{ quota: AssistantQuotaStatus }>('/assistant/mitra/quota')
  return response.quota
}

export function deleteMitraChatSession(sessionId: string): Promise<{ status: string }> {
  return apiClient.delete<{ status: string }>(`/assistant/mitra/sessions/${encodeURIComponent(sessionId)}`)
}

export function reopenMitraChatSession(sessionId: string): Promise<{ status: string; session_id: string }> {
  return apiClient.post<{ status: string; session_id: string }>(`/assistant/mitra/sessions/${encodeURIComponent(sessionId)}/reopen`, {})
}

export async function askMitraAssistant(message: string, sessionId?: string): Promise<MitraAssistantReply> {
  const response = await apiFetch('/assistant/mitra/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ message, session_id: sessionId }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string
      reason?: string
      quota?: AssistantQuotaStatus
    } | null
    throw new AssistantQuotaError(
      body?.error ?? `Permintaan gagal (${response.status})`,
      response.status,
      body?.reason,
      body?.quota,
    )
  }
  if (!response.headers.get('Content-Type')?.includes('text/event-stream')) {
    return response.json() as Promise<MitraAssistantReply>
  }
  return readAssistantSse<MitraAssistantReply>(response)
}

export async function getMitraAssistantHistory(sessionId?: string): Promise<MitraChatHistoryItem[]> {
  const response = await apiClient.get<{ data: MitraChatHistoryItem[]; quota?: AssistantQuotaStatus }>(
    '/assistant/mitra/history',
    sessionId ? { headers: { 'x-session-id': sessionId } } : undefined,
  )
  return response.data
}

export async function getMitraAssistantHistoryWithQuota(
  sessionId?: string,
): Promise<{ data: MitraChatHistoryItem[]; quota?: AssistantQuotaStatus }> {
  return apiClient.get<{ data: MitraChatHistoryItem[]; quota?: AssistantQuotaStatus }>(
    '/assistant/mitra/history',
    sessionId ? { headers: { 'x-session-id': sessionId } } : undefined,
  )
}

export function rateMitraAssistantAnswer(id: string, rating: -1 | 1, sessionId?: string): Promise<{ status: string }> {
  return apiClient.patch<{ status: string }>(`/assistant/mitra/chat/${encodeURIComponent(id)}/feedback`, { rating }, sessionId ? { headers: { 'x-session-id': sessionId } } : undefined)
}

export function clearMitraAssistantHistory(): Promise<{ status: string }> {
  return apiClient.delete<{ status: string }>('/assistant/mitra/history')
}

export function endMitraAssistantSession(sessionId?: string): Promise<{ status: string; remembered: boolean }> {
  return apiClient.post<{ status: string; remembered: boolean }>('/assistant/mitra/end', { session_id: sessionId })
}

export async function getAdminChatSessions(): Promise<MitraChatSession[]> {
  const response = await apiClient.get<{ data: MitraChatSession[] }>('/assistant/admin/sessions')
  return response.data
}

export async function getAdminChatSession(
  sessionId: string,
): Promise<{ data: MitraChatHistoryItem[]; summary: string | null; quota?: AssistantQuotaStatus }> {
  return apiClient.get<{ data: MitraChatHistoryItem[]; summary: string | null; quota?: AssistantQuotaStatus }>(
    '/assistant/admin/history',
    { headers: { 'x-session-id': sessionId } },
  )
}

export async function getAdminChatQuota(): Promise<AssistantQuotaStatus> {
  const response = await apiClient.get<{ quota: AssistantQuotaStatus }>('/assistant/admin/quota')
  return response.quota
}

export function deleteAdminChatSession(sessionId: string): Promise<{ status: string }> {
  return apiClient.delete<{ status: string }>(`/assistant/admin/sessions/${encodeURIComponent(sessionId)}`)
}

export function reopenAdminChatSession(sessionId: string): Promise<{ status: string; session_id: string }> {
  return apiClient.post<{ status: string; session_id: string }>(`/assistant/admin/sessions/${encodeURIComponent(sessionId)}/reopen`, {})
}

export async function askAdminAssistant(message: string, sessionId?: string): Promise<MitraAssistantReply> {
  const response = await apiFetch('/assistant/admin/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ message, session_id: sessionId }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string
      reason?: string
      quota?: AssistantQuotaStatus
    } | null
    throw new AssistantQuotaError(
      body?.error ?? `Permintaan gagal (${response.status})`,
      response.status,
      body?.reason,
      body?.quota,
    )
  }
  if (!response.headers.get('Content-Type')?.includes('text/event-stream')) {
    return response.json() as Promise<MitraAssistantReply>
  }
  return readAssistantSse<MitraAssistantReply>(response)
}

export function endAdminAssistantSession(sessionId?: string): Promise<{ status: string; remembered: boolean }> {
  return apiClient.post<{ status: string; remembered: boolean }>('/assistant/admin/end', { session_id: sessionId })
}

export function rateAdminAssistantAnswer(id: string, rating: -1 | 1, sessionId?: string): Promise<{ status: string }> {
  return apiClient.patch<{ status: string }>(`/assistant/admin/chat/${encodeURIComponent(id)}/feedback`, { rating }, sessionId ? { headers: { 'x-session-id': sessionId } } : undefined)
}

export function clearAdminAssistantHistory(): Promise<{ status: string }> {
  return apiClient.delete<{ status: string }>('/assistant/admin/history')
}
