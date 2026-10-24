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

export const api = treaty<App>(resolveApiUrl(), {
  onRequest() {
    const token =
      typeof window === 'undefined'
        ? null
        : localStorage.getItem('daisuki_token')

    return token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
  },
})
