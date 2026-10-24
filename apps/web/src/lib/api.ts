import { treaty } from '@elysiajs/eden'
import type { App } from '../../../api/src/index'
import { env } from '@/env'

export function resolveApiUrl(): string {
  if (typeof window !== 'undefined' && window.location.hostname) {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'

    // Saat diakses dari perangkat lain di jaringan lokal (misal: HP via IP 192.168.x.x),
    // arahkan request API ke port 3001 di IP host yang sama.
    if (!isLocalhost) {
      return `${window.location.protocol}//${window.location.hostname}:3001`
    }
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

export const api = treaty<App>(resolveApiUrl(), {
  onRequest() {
    const token =
      typeof window === 'undefined'
        ? null
        : localStorage.getItem('daisuki_token')

    return token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
  },
})
