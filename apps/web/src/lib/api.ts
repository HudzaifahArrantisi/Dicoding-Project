import { treaty } from '@elysiajs/eden'
import type { App } from '../../../api/src/index'
import { env } from '@/env'

export const API_BASE_PATH = '/api'

/**
 * Normalizes any backend resource path, endpoint, or URL to use the single /api prefix,
 * preventing double prefixes (e.g. /api/api/orders -> /api/orders).
 *
 * Examples:
 * - 'orders' -> '/api/orders'
 * - '/orders' -> '/api/orders'
 * - '/api/orders' -> '/api/orders'
 * - '/api/api/orders' -> '/api/orders'
 * - '/products' -> '/api/products'
 * - '/auth/login' -> '/api/auth/login'
 * - '/orders/PO-123' -> '/api/orders/PO-123'
 * - '/orders?status=diproses' -> '/api/orders?status=diproses'
 */
export function resolveApiPath(path: string): string {
  if (!path || path === '/') return API_BASE_PATH

  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const url = new URL(path)
      const cleanPath = url.pathname.replace(/^(\/api)+/, API_BASE_PATH)
      if (!cleanPath.startsWith(API_BASE_PATH)) {
        url.pathname = `${API_BASE_PATH}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`
      } else {
        url.pathname = cleanPath
      }
      return url.toString()
    } catch {
      return path
    }
  }

  let clean = path.trim()
  if (!clean.startsWith('/')) {
    clean = `/${clean}`
  }

  // Prevent double/multiple prefix: /api/api/orders -> /api/orders
  clean = clean.replace(/^(\/api)+/, API_BASE_PATH)

  if (clean === API_BASE_PATH || clean.startsWith(`${API_BASE_PATH}/`)) {
    return clean
  }

  return `${API_BASE_PATH}${clean}`
}

/**
 * Resolves the base URL or resource path for API requests.
 * In the browser, returns relative `/api` to route through the single origin base path.
 */
export function resolveApiUrl(path?: string): string {
  if (path) {
    return resolveApiPath(path)
  }

  // Jika VITE_API_URL diatur secara eksplisit ke domain API eksternal tersendiri
  // (misal server produksi terpisah), utamakan URL tersebut dengan prefix /api.
  if (
    env.VITE_API_URL &&
    !env.VITE_API_URL.includes('localhost') &&
    !env.VITE_API_URL.includes('127.0.0.1')
  ) {
    const base = env.VITE_API_URL.replace(/\/+$/, '')
    return base.endsWith(API_BASE_PATH) ? base : `${base}${API_BASE_PATH}`
  }

  // Di browser dan default dev server, gunakan URL relatif /api
  return API_BASE_PATH
}

/**
 * Resolves an image path (such as /uploads/receipts/xxx.jpg) to a path passing through /api.
 * Supports data URLs, blob URLs, and external URLs without alteration.
 */
export function resolveImageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (
    path.startsWith('data:') ||
    path.startsWith('blob:') ||
    path.startsWith('http://') ||
    path.startsWith('https://')
  ) {
    return path
  }
  return resolveApiPath(path)
}

/**
 * Converts a base64 Data URL to a native binary Blob suitable for FormData upload.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',')
  const mimeMatch = parts[0].match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
  const binaryString = atob(parts[1])
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

let csrfToken: string | null = null

export function setCsrfToken(value: string | null): void {
  csrfToken = value
}

export function sessionRequest(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    credentials: 'include',
    headers: {
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...init.headers,
    },
  }
}

/**
 * Centralized fetch helper that guarantees routing through /api and carries session credentials.
 */
export async function apiFetch(
  input: string | URL,
  init: RequestInit = {}
): Promise<Response> {
  const targetUrl = resolveApiPath(typeof input === 'string' ? input : input.toString())
  return fetch(targetUrl, sessionRequest(init))
}

/**
 * Centralized HTTP API client helper providing convenient request methods.
 */
export const apiClient = {
  fetch: apiFetch,
  resolveApiPath,
  resolveApiUrl,
  async get<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(path, { ...init, method: 'GET' })
    if (!res.ok) {
      const errorBody = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(errorBody?.error || `HTTP ${res.status}`)
    }
    return res.json() as Promise<T>
  },
  async post<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
    const res = await apiFetch(path, {
      ...init,
      method: 'POST',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
    })
    if (!res.ok) {
      const errorBody = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(errorBody?.error || `HTTP ${res.status}`)
    }
    return res.json() as Promise<T>
  },
  async put<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
    const res = await apiFetch(path, {
      ...init,
      method: 'PUT',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
    })
    if (!res.ok) {
      const errorBody = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(errorBody?.error || `HTTP ${res.status}`)
    }
    return res.json() as Promise<T>
  },
  async patch<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
    const res = await apiFetch(path, {
      ...init,
      method: 'PATCH',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
    })
    if (!res.ok) {
      const errorBody = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(errorBody?.error || `HTTP ${res.status}`)
    }
    return res.json() as Promise<T>
  },
  async delete<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(path, { ...init, method: 'DELETE' })
    if (!res.ok) {
      const errorBody = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(errorBody?.error || `HTTP ${res.status}`)
    }
    return res.json() as Promise<T>
  },
}

const edenFetcher: typeof fetch = Object.assign(
  (input: RequestInfo | URL, init?: RequestInit) => {
    const targetUrl = resolveApiPath(typeof input === 'string' ? input : input.toString())
    return fetch(targetUrl, sessionRequest(init))
  },
  { preconnect: (...args: Parameters<typeof fetch.preconnect>) => globalThis.fetch.preconnect(...args) }
)

/**
 * Type-safe Treaty client configured with /api base path and request interception.
 */
export const api = treaty<App>(resolveApiUrl(), {
  keepDomain: true,
  onRequest() {
    return sessionRequest()
  },
  fetcher: edenFetcher,
})
