import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    SERVER_URL: z.string().url().optional(),
  },

  clientPrefix: 'VITE_',

  client: {
    VITE_API_URL: z.string().url(),
  },

  runtimeEnv: import.meta.env,

  emptyStringAsUndefined: true,
})
