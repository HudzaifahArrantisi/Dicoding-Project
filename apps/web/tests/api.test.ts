import { describe, expect, test } from 'bun:test'
import {
  API_BASE_PATH,
  api,
  apiClient,
  apiFetch,
  resolveApiPath,
  resolveApiUrl,
  resolveImageUrl,
  setCsrfToken,
} from '../src/lib/api'

describe('Centralized API client routing architecture', () => {
  describe('resolveApiPath', () => {
    test('routes bare resource names to /api prefix', () => {
      expect(resolveApiPath('orders')).toBe('/api/orders')
      expect(resolveApiPath('products')).toBe('/api/products')
      expect(resolveApiPath('stocks')).toBe('/api/stocks')
    })

    test('routes leading-slash paths to /api prefix', () => {
      expect(resolveApiPath('/orders')).toBe('/api/orders')
      expect(resolveApiPath('/products')).toBe('/api/products')
      expect(resolveApiPath('/auth/login')).toBe('/api/auth/login')
      expect(resolveApiPath('/stocks/logs')).toBe('/api/stocks/logs')
      expect(resolveApiPath('/admin/weekly-summary')).toBe('/api/admin/weekly-summary')
    })

    test('preserves order details and dynamic route parameters', () => {
      expect(resolveApiPath('/orders/PO-2026-001')).toBe('/api/orders/PO-2026-001')
      expect(resolveApiPath('/orders/:id')).toBe('/api/orders/:id')
      expect(resolveApiPath('/orders/PO-2026-001/receipt-proof')).toBe(
        '/api/orders/PO-2026-001/receipt-proof',
      )
    })

    test('preserves query strings correctly', () => {
      expect(resolveApiPath('/orders?status=diproses')).toBe('/api/orders?status=diproses')
      expect(resolveApiPath('/stocks?limit=10&page=2')).toBe('/api/stocks?limit=10&page=2')
      expect(resolveApiPath('orders?status=disetujui')).toBe('/api/orders?status=disetujui')
    })

    test('prevents double and multiple /api prefixes', () => {
      expect(resolveApiPath('/api/orders')).toBe('/api/orders')
      expect(resolveApiPath('/api/api/orders')).toBe('/api/orders')
      expect(resolveApiPath('/api/api/api/orders')).toBe('/api/orders')
      expect(resolveApiPath('/api/products')).toBe('/api/products')
      expect(resolveApiPath('/api/api/auth/login')).toBe('/api/auth/login')
    })

    test('handles full URLs pointing to app origin', () => {
      expect(resolveApiPath('http://localhost:3000/orders')).toBe(
        'http://localhost:3000/api/orders',
      )
      expect(resolveApiPath('http://localhost:3000/api/orders')).toBe(
        'http://localhost:3000/api/orders',
      )
      expect(resolveApiPath('http://localhost:3000/api/api/orders')).toBe(
        'http://localhost:3000/api/orders',
      )
      expect(resolveApiPath('http://localhost:3000/orders?status=diproses')).toBe(
        'http://localhost:3000/api/orders?status=diproses',
      )
    })

    test('handles empty or root path', () => {
      expect(resolveApiPath('')).toBe('/api')
      expect(resolveApiPath('/')).toBe('/api')
    })
  })

  describe('resolveApiUrl', () => {
    test('returns base /api path by default', () => {
      expect(resolveApiUrl()).toBe(API_BASE_PATH)
    })

    test('resolves resource paths when passed an argument', () => {
      expect(resolveApiUrl('/orders')).toBe('/api/orders')
      expect(resolveApiUrl('products')).toBe('/api/products')
    })
  })

  describe('resolveImageUrl', () => {
    test('prefixes backend image paths with /api', () => {
      expect(resolveImageUrl('/uploads/receipts/proof-123.jpg')).toBe(
        '/api/uploads/receipts/proof-123.jpg',
      )
      expect(resolveImageUrl('uploads/profiles/user-456.png')).toBe(
        '/api/uploads/profiles/user-456.png',
      )
    })

    test('prevents double prefix on image paths', () => {
      expect(resolveImageUrl('/api/uploads/receipts/proof-123.jpg')).toBe(
        '/api/uploads/receipts/proof-123.jpg',
      )
    })

    test('passes data URLs, blob URLs, and external URLs untouched', () => {
      expect(resolveImageUrl('data:image/jpeg;base64,ABC')).toBe('data:image/jpeg;base64,ABC')
      expect(resolveImageUrl('blob:http://localhost:3000/uuid')).toBe(
        'blob:http://localhost:3000/uuid',
      )
      expect(resolveImageUrl('https://external.cdn/photo.jpg')).toBe(
        'https://external.cdn/photo.jpg',
      )
      expect(resolveImageUrl(null)).toBeNull()
      expect(resolveImageUrl(undefined)).toBeNull()
    })
  })

  describe('apiFetch & apiClient', () => {
    test('apiFetch routes to /api and attaches credentials and CSRF token', async () => {
      setCsrfToken('test-csrf-token')

      let interceptedUrl = ''
      let interceptedInit: RequestInit | undefined
      const originalFetch = globalThis.fetch
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        interceptedUrl = String(input)
        interceptedInit = init
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }) as typeof fetch

      try {
        const response = await apiFetch('/orders?status=diproses', {
          headers: { 'X-Custom': 'header' },
        })
        expect(response.ok).toBe(true)
        expect(interceptedUrl).toBe('/api/orders?status=diproses')
        expect(interceptedInit?.credentials).toBe('include')
        expect((interceptedInit?.headers as Record<string, string>)?.['X-CSRF-Token']).toBe(
          'test-csrf-token',
        )
        expect((interceptedInit?.headers as Record<string, string>)?.['X-Custom']).toBe('header')
      } finally {
        globalThis.fetch = originalFetch
        setCsrfToken(null)
      }
    })

    test('apiClient helper methods automatically route through /api', async () => {
      const calls: Array<{ url: string; method?: string; body?: unknown }> = []
      const originalFetch = globalThis.fetch
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
          url: String(input),
          method: init?.method,
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
        })
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }) as typeof fetch

      try {
        await apiClient.get('/orders')
        await apiClient.post('/orders', { items: [{ product_id: '1', qty: 5 }] })
        await apiClient.patch('/orders/PO-1', { note: 'updated' })
        await apiClient.delete('/orders/PO-1')

        expect(calls[0]).toEqual({ url: '/api/orders', method: 'GET', body: undefined })
        expect(calls[1]).toEqual({
          url: '/api/orders',
          method: 'POST',
          body: { items: [{ product_id: '1', qty: 5 }] },
        })
        expect(calls[2]).toEqual({
          url: '/api/orders/PO-1',
          method: 'PATCH',
          body: { note: 'updated' },
        })
        expect(calls[3]).toEqual({ url: '/api/orders/PO-1', method: 'DELETE', body: undefined })
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  describe('Treaty client routing through /api', () => {
    test('treaty dispatches requests with /api prefix', async () => {
      const urls: string[] = []
      const originalFetch = globalThis.fetch
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        urls.push(String(input))
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }) as typeof fetch

      try {
        await api.orders.get()
        await api.products.get()
        await api.auth.login.post({ email: 'mitra@daisuki.id', password: 'secret' })
        await api.orders({ id: 'PO-2026-999' })['receipt-proof'].get()
        await api.orders.get({ query: { partner_id: 'partner-1' } })

        expect(urls).toEqual([
          '/api/orders',
          '/api/products',
          '/api/auth/login',
          '/api/orders/PO-2026-999/receipt-proof',
          '/api/orders?partner_id=partner-1',
        ])
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })
})

