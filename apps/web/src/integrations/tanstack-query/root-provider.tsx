import { QueryClient } from '@tanstack/react-query'

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: (failureCount, error) => {
          const status = (error as { status?: number } | undefined)?.status
          const msg = error instanceof Error ? error.message : String(error)
          if (status === 401 || status === 403 || msg.includes('Unauthorized') || msg.includes('Sesi')) {
            return false
          }
          return failureCount < 2
        },
      },
    },
  })

  return {
    queryClient,
  }
}
export default function TanstackQueryProvider() {}
