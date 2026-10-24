import { treaty } from '@elysiajs/eden'
import type { App } from '../../../api/src/index'
import { env } from '@/env'

export function resolveApiUrl(): string {
  // Jika VITE_API_URL diatur secara eksplisit ke domain API eksternal tersendiri
  // (misal server produksi terpisah), utamakan URL tersebut.
  if (
    env.VITE_API_URL &&
    !env.VITE_API_URL.includes('localhost') &&
    !env.VITE_API_URL.includes('127.0.0.1')
  ) {
    return env.VITE_API_URL
  }

  // Di browser (akses localhost, LAN IP, atau melalui tunnel seperti Cloudflare/ngrok),
  // gunakan origin browser saat ini (port 3000) agar semua permintaan API
  // secara otomatis diteruskan oleh proxy Vite dev server ke port 3001.
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin
  }

  return env.VITE_API_URL || 'http://localhost:3001'
}

/**
 * Resolves an image path (such as /uploads/receipts/xxx.jpg) to a fully qualified URL
 * pointing to the active API server. Supports data URLs and external URLs without alteration.
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
  const baseUrl = resolveApiUrl()
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${cleanPath}`
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

export const api = treaty<App>(resolveApiUrl(), {
  onRequest() {
    return sessionRequest()
  },
})
