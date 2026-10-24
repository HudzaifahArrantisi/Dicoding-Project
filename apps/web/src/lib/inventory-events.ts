import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { resolveApiUrl } from './api'

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
    ],
    notifications: [['admin-notifications']],
    metrics: [['admin-metrics']],
    partners: [['admin-partners']],
  },
  mitra: {
    orders: [['mitra-orders']],
    stocks: [['mitra-stocks']],
    logs: [['mitra-stock-logs']],
    products: [['central-products']],
  },
}

function parseTopics(frame: string): Topic[] {
  if (!frame.split('\n').some((line) => line.trim() === 'event: inventory')) {
    return []
  }
  const data = frame
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
  try {
    const parsed: unknown = JSON.parse(data)
    if (!parsed || typeof parsed !== 'object' || !('topics' in parsed)) return []
    const values: unknown = parsed.topics
    if (!Array.isArray(values)) return []
    return values.filter(
      (value): value is Topic =>
        typeof value === 'string' && topics.some((topic) => topic === value),
    )
  } catch {
    return []
  }
}

export function useInventoryEvents(token: string | null, role: Role): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!token) return

    let stopped = false
    let connectedBefore = false
    let lastResyncAt = 0
    let retryDelay = 1_000
    let controller: AbortController | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null
    let catchupTimer: ReturnType<typeof setTimeout> | null = null
    const pending = new Set<Topic>()

    const flush = () => {
      invalidateTimer = null
      const keys = new Map<string, string[]>()
      for (const topic of pending) {
        for (const key of queryKeys[role][topic] ?? []) {
          keys.set(key.join(':'), key)
        }
      }
      pending.clear()
      for (const key of keys.values()) {
        void queryClient.invalidateQueries({ queryKey: key })
      }
    }

    const queue = (changed: Topic[]) => {
      for (const topic of changed) pending.add(topic)
      if (pending.size && !invalidateTimer) {
        invalidateTimer = setTimeout(flush, 150)
      }
    }

    const canConnect = () => !stopped && !document.hidden && navigator.onLine

    const catchUp = () => {
      if (!canConnect() || !controller) return
      const wait = Math.max(0, 30_000 - (Date.now() - lastResyncAt))
      if (wait > 0) {
        if (!catchupTimer) {
          catchupTimer = setTimeout(() => {
            catchupTimer = null
            catchUp()
          }, wait)
        }
        return
      }
      lastResyncAt = Date.now()
      queue(topics)
    }

    const connect = async () => {
      if (!canConnect() || controller) return
      controller = new AbortController()
      const signal = controller.signal
      try {
        const response = await fetch(`${resolveApiUrl()}/events`, {
          headers: { Authorization: `Bearer ${token}` },
          signal,
          cache: 'no-store',
        })
        if (response.status === 401 || response.status === 403) {
          stopped = true
          return
        }
        if (!response.ok || !response.body) throw new Error('SSE unavailable')

        if (connectedBefore) catchUp()
        connectedBefore = true
        const connectedAt = Date.now()

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (!signal.aborted) {
          const { done, value } = await reader.read()
          if (done) break
          buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n')
          if (buffer.length > 65_536) buffer = ''
          let boundary = buffer.indexOf('\n\n')
          while (boundary !== -1) {
            queue(parseTopics(buffer.slice(0, boundary)))
            buffer = buffer.slice(boundary + 2)
            boundary = buffer.indexOf('\n\n')
          }
        }
        if (Date.now() - connectedAt > 30_000) retryDelay = 1_000
      } catch {
        // A dropped stream reconnects below; reconnect refreshes missed changes.
      } finally {
        controller = null
        if (canConnect()) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null
            void connect()
          }, retryDelay)
          retryDelay = Math.min(retryDelay * 2, 30_000)
        }
      }
    }

    const resume = () => {
      if (canConnect()) {
        if (reconnectTimer) clearTimeout(reconnectTimer)
        reconnectTimer = null
        void connect()
      } else {
        controller?.abort()
      }
    }

    document.addEventListener('visibilitychange', resume)
    window.addEventListener('online', resume)
    window.addEventListener('offline', resume)
    void connect()

    return () => {
      stopped = true
      controller?.abort()
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (invalidateTimer) clearTimeout(invalidateTimer)
      if (catchupTimer) clearTimeout(catchupTimer)
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('online', resume)
      window.removeEventListener('offline', resume)
    }
  }, [token, role, queryClient])
}
