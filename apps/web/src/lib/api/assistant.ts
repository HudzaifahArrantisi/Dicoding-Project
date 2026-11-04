import { apiClient } from './client'

export type MitraTour = 'restock' | 'stock_report' | 'delivery' | 'logs' | 'profile'

export interface MitraAssistantReply {
  reply: string
  suggestedTour?: MitraTour
  tourLabel?: string
  quickReplies: string[]
  interactionId: string
  modelAvailable: boolean
}

export interface MitraChatHistoryItem {
  id: string
  message: string
  reply: string
  intent: MitraTour | null
  feedback: -1 | 1 | null
  created_at: string
}

export function askMitraAssistant(message: string): Promise<MitraAssistantReply> {
  return apiClient.post<MitraAssistantReply>('/assistant/mitra/chat', { message })
}

export async function getMitraAssistantHistory(): Promise<MitraChatHistoryItem[]> {
  const response = await apiClient.get<{ data: MitraChatHistoryItem[] }>('/assistant/mitra/history')
  return response.data
}

export function rateMitraAssistantAnswer(id: string, rating: -1 | 1): Promise<{ status: string }> {
  return apiClient.patch<{ status: string }>(`/assistant/mitra/chat/${encodeURIComponent(id)}/feedback`, { rating })
}
