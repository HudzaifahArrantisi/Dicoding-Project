import { treaty } from '@elysiajs/eden'
import type { App } from '../../../api/src/index'
import { env } from '@/env'

export const api = treaty<App>(env.VITE_API_URL, {
  onRequest() {
    const token =
      typeof window === 'undefined'
        ? null
        : localStorage.getItem('daisuki_token')

    return token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
  },
})
