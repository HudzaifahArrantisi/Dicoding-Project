import { expect, test } from 'bun:test'
import { readAssistantSse } from './assistant-sse'

test('jawaban chat yang lolos guardrail dibaca dari event SSE', async () => {
  const response = new Response('data: {"reply":"Halo","source":"fallback","quickReplies":[],"interactionId":"id","modelAvailable":false}\n\n', {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
  })
  const answer = await readAssistantSse<{ reply: string; source: string }>(response)
  expect(answer.reply).toBe('Halo')
  expect(answer.source).toBe('fallback')
})
