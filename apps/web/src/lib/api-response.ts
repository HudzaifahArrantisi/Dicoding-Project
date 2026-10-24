type ApiResponse = {
  data?: unknown
  error?: unknown
}

function messageFromUnknown(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed && trimmed !== '[object Object]' ? trimmed : null
  }
  if (!value || typeof value !== 'object') return null

  // 1. If Eden error has `.value`, inspect that first (contains the actual server payload)
  if ('value' in value && value.value) {
    const fromValue = messageFromUnknown(value.value)
    if (fromValue && fromValue !== '[object Object]') return fromValue
  }

  // 2. Check for `error` property
  if ('error' in value) {
    if (typeof value.error === 'string') {
      const trimmed = value.error.trim()
      if (trimmed && trimmed !== '[object Object]') return trimmed
    } else if (typeof value.error === 'object' && value.error !== null) {
      const fromNested = messageFromUnknown(value.error)
      if (fromNested && fromNested !== '[object Object]') return fromNested
    }
  }

  // 3. Check for `message` property (must not be "[object Object]")
  if ('message' in value) {
    if (typeof value.message === 'string') {
      const trimmed = value.message.trim()
      if (trimmed && trimmed !== '[object Object]') return trimmed
    } else if (typeof value.message === 'object' && value.message !== null) {
      const fromNested = messageFromUnknown(value.message)
      if (fromNested && fromNested !== '[object Object]') return fromNested
    }
  }

  // 4. Check for validation errors array
  if ('errors' in value && Array.isArray(value.errors) && value.errors.length > 0) {
    const fromArray = messageFromUnknown(value.errors[0])
    if (fromArray && fromArray !== '[object Object]') return fromArray
  }

  return null
}

export function apiError(error: unknown, fallback: string): Error & { status?: number } {
  const msg = messageFromUnknown(error)
  const err = new Error(msg && msg !== '[object Object]' ? msg : fallback) as Error & { status?: number }
  if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') {
    err.status = error.status
  }
  return err
}

export function unwrapData<T>(response: ApiResponse, fallback: string): T {
  if (response.error) throw apiError(response.error, fallback)
  if (!response.data || typeof response.data !== 'object') {
    throw new Error(fallback)
  }

  if (!('data' in response.data)) {
    throw new Error(fallback)
  }

  return (response.data as { data: T }).data
}
