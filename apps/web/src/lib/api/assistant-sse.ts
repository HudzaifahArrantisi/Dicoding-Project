export async function readAssistantSse<T>(response: Response): Promise<T> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Respons chatbot kosong')
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      buffer += decoder.decode(chunk.value, { stream: true })
      const boundary = buffer.indexOf('\n\n')
      if (boundary >= 0) {
        const line = buffer.slice(0, boundary).split('\n').find((part) => part.startsWith('data: '))
        if (line) return JSON.parse(line.slice(6)) as T
      }
    }
  } finally {
    reader.releaseLock()
  }
  throw new Error('Respons chatbot tidak lengkap')
}
