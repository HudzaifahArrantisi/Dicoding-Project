import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { resolveApiPath } from './api'

type Role = 'admin' | 'mitra'
type Topic = 'orders' | 'stocks' | 'logs' | 'products' | 'notifications' | 'metrics' | 'partners'

const topics: Topic[] = [
  'orders',
  'stocks',
  'logs',
  'products',
  'notifications',
  'metrics',
  'partners',
]

const queryKeys: Record<Role, Partial<Record<Topic, string[][]>>> = {
  admin: {
    orders: [['admin-orders'], ['admin-shipment-logs']],
    stocks: [['admin-stocks']],
    logs: [
      ['admin-stock-logs-partner'],
      ['admin-stock-log-partners'],
      ['admin-weekly-summary'],
    ],
    products: [
      ['admin-central-products'],
      ['admin-stocks'],
      ['admin-orders'],
      ['admin-metrics'],
      ['admin-ai-insights'],
    ],
    notifications: [['admin-notifications']],
    metrics: [['admin-metrics']],
    partners: [['admin-partners']],
  },
  mitra: {
    orders: [['mitra-orders']],
    stocks: [['mitra-stocks']],
    logs: [['mitra-stock-logs']],
    products: [['central-products'], ['mitra-stocks']],
  },
}

function parseTopics(raw: string): Topic[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !('topics' in parsed)) return []
    const values: unknown = (parsed as { topics?: unknown }).topics
    if (!Array.isArray(values)) return []
    return values.filter(
      (value): value is Topic =>
        typeof value === 'string' && topics.some((topic) => topic === value),
    )
  } catch {
    return []
  }
}

export function useInventoryEvents(enabled: boolean, role: Role): void {
  const queryClient = useQueryClient()
  const queryClientRef = useRef(queryClient)
  queryClientRef.current = queryClient

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    let stopped = false
    let eventSource: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null
    let retryDelay = 3_000
    const pending = new Set<Topic>()

    const flush = () => {
      invalidateTimer = null
      if (pending.size === 0) return
      const keys = new Map<string, string[]>()
      for (const topic of pending) {
        for (const key of queryKeys[role][topic] ?? []) {
          keys.set(key.join(':'), key)
        }
      }
      pending.clear()
      for (const key of keys.values()) {
        void queryClientRef.current.invalidateQueries({ queryKey: key })
      }
    }

    const queue = (changed: Topic[]) => {
      for (const topic of changed) pending.add(topic)
      if (pending.size && !invalidateTimer) {
        invalidateTimer = setTimeout(flush, 250)
      }
    }

    const connect = () => {
      if (stopped || eventSource) return

      try {
        const url = resolveApiPath('/events')
        const es = new EventSource(url, { withCredentials: true })
        eventSource = es

        es.onopen = () => {
          retryDelay = 3_000
        }

        es.addEventListener('inventory', (event) => {
          if (stopped) return
          const changed = parseTopics(event.data)
          if (changed.length > 0) {
            queue(changed)
          }
        })

        es.onerror = () => {
          if (stopped) return
          es.close()
          eventSource = null

          // Exponential backoff to avoid rapid reconnection loops
          const delay = retryDelay
          retryDelay = Math.min(retryDelay * 2, 30_000)

          if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null
              connect()
            }, delay)
          }
        }
      } catch {
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(connect, 5_000)
        }
      }
    }

    const handleVisibility = () => {
      if (document.hidden) {
        if (eventSource) {
          eventSource.close()
          eventSource = null
        }
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
      } else {
        retryDelay = 3_000
        connect()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    connect()

    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', handleVisibility)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (invalidateTimer) clearTimeout(invalidateTimer)
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
    }
  }, [enabled, role])
}
