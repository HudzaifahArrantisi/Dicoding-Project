import { treaty } from '@elysiajs/eden'
import type { App } from '../../../../api/src/index'
import { env } from '@/env'

export const API_BASE_PATH = '/api'

let csrfToken: string | null = null

export function setCsrfToken(value: string | null): void {
  csrfToken = value
}

export function getCsrfToken(): string | null {
  return csrfToken
}

/**
 * Normalizes any backend resource path, endpoint, or URL to use the single /api prefix,
 * preventing double prefixes (e.g. /api/api/orders -> /api/orders).
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

  if (
    env.VITE_API_URL &&
    !env.VITE_API_URL.includes('localhost') &&
    !env.VITE_API_URL.includes('127.0.0.1')
  ) {
    const base = env.VITE_API_URL.replace(/\/+$/, '')
    return base.endsWith(API_BASE_PATH) ? base : `${base}${API_BASE_PATH}`
  }

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

export function sessionRequest(init: RequestInit = {}): RequestInit {
  const headersRecord: Record<string, string> = {}

  if (init.headers) {
    if (typeof Headers !== 'undefined' && init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headersRecord[key] = value
      })
    } else if (Array.isArray(init.headers)) {
      for (const [key, value] of init.headers) {
        headersRecord[key] = value
      }
    } else if (typeof (init.headers as { forEach?: unknown }).forEach === 'function') {
      (init.headers as Headers).forEach((value, key) => {
        headersRecord[key] = value
      })
    } else {
      Object.assign(headersRecord, init.headers)
    }
  }

  if (csrfToken && !headersRecord['X-CSRF-Token'] && !headersRecord['x-csrf-token']) {
    headersRecord['X-CSRF-Token'] = csrfToken
  }

  return {
    ...init,
    credentials: 'include',
    headers: headersRecord,
  }
}

/**
 * Centralized low-level fetch helper that guarantees routing through /api and carries session credentials.
 */
export async function apiFetch(
  input: string | URL,
  init: RequestInit = {}
): Promise<Response> {
  const targetUrl = resolveApiPath(typeof input === 'string' ? input : input.toString())
  return fetch(targetUrl, sessionRequest(init))
}

/**
 * Core centralized request function for domain modules.
 * Automatically handles:
 * - /api prefix normalization
 * - credentials: 'include' & CSRF token
 * - JSON body serialization & Content-Type headers
 * - Unified error parsing and status code checking
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData

  const headers = new Headers(options.headers)
  if (!isFormData && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await apiFetch(path, {
    ...options,
    headers,
  })

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      // Sesi kedaluwarsa
    }
    const errorBody = (await response.json().catch(() => null)) as { error?: string; message?: string } | null
    const msg = errorBody?.error || errorBody?.message || `Permintaan gagal (${response.status})`
    const error = new Error(msg) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  // Handle empty responses (204 No Content, etc.)
  if (response.status === 204) {
    return undefined as unknown as T
  }

  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    return response.json() as Promise<T>
  }

  return response.text() as unknown as Promise<T>
}

/**
 * Centralized HTTP API client helper providing convenient request methods.
 */
export const apiClient = {
  fetch: apiFetch,
  request: apiRequest,
  resolveApiPath,
  resolveApiUrl,
  get<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    return apiRequest<T>(path, { ...init, method: 'GET' })
  },
  post<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
    return apiRequest<T>(path, {
      ...init,
      method: 'POST',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
    })
  },
  put<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
    return apiRequest<T>(path, {
      ...init,
      method: 'PUT',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
    })
  },
  patch<T = unknown>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
    return apiRequest<T>(path, {
      ...init,
      method: 'PATCH',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
    })
  },
  delete<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    return apiRequest<T>(path, { ...init, method: 'DELETE' })
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

