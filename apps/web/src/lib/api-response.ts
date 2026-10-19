type ApiResponse = {
  data?: unknown
  error?: unknown
}

function messageFromUnknown(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return null

  if ('error' in value && typeof value.error === 'string') {
    return value.error
  }

  if ('message' in value && typeof value.message === 'string') {
    return value.message
  }

  if ('value' in value) {
    return messageFromUnknown(value.value)
  }

  return null
}

export function apiError(error: unknown, fallback: string): Error {
  return new Error(messageFromUnknown(error) ?? fallback)
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
