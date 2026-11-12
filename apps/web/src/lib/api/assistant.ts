import { apiClient, apiFetch } from './client'
import { readAssistantSse } from './assistant-sse'

export type MitraTour = 'restock' | 'stock_report' | 'delivery' | 'logs' | 'profile'

export interface MitraAssistantReply {
  reply: string
  source: 'llm' | 'fallback'
  suggestedTour?: MitraTour
  tourLabel?: string
  quickReplies: string[]
  interactionId: string
  modelAvailable: boolean
  session_id?: string
}

export interface MitraChatHistoryItem {
  id: string
  message: string
  reply: string
  source: 'llm' | 'fallback'
  intent: MitraTour | null
  feedback: -1 | 1 | null
  created_at: string
}

export async function askMitraAssistant(message: string, sessionId?: string): Promise<MitraAssistantReply> {
  const response = await apiFetch('/assistant/mitra/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ message, session_id: sessionId }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error ?? `Permintaan gagal (${response.status})`)
  }
  if (!response.headers.get('Content-Type')?.includes('text/event-stream')) {
    return response.json() as Promise<MitraAssistantReply>
  }
  return readAssistantSse<MitraAssistantReply>(response)
}

export async function getMitraAssistantHistory(sessionId?: string): Promise<MitraChatHistoryItem[]> {
  const response = await apiClient.get<{ data: MitraChatHistoryItem[] }>('/assistant/mitra/history', sessionId ? { headers: { 'x-session-id': sessionId } } : undefined)
  return response.data
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
