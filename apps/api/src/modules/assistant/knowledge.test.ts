import { describe, expect, test } from 'bun:test'
import { answerMitraQuestion } from './knowledge'
import type { MitraTour } from './knowledge'
import { loadAssistantFixture } from './test-data'

type KnowledgeFixture = {
  greetings: string[]
  tours: Array<{ question: string; tour: MitraTour }>
  refusal_cases: Array<{ question: string; required_fragment: string }>
  mixed_cases: Array<{ question: string; tour: MitraTour }>
  inventory_policy: { report_question: string; delivery_question: string; report_required_fragments: string[]; report_forbidden_fragments: string[]; delivery_required_fragments: string[] }
  identity_cases: Array<{ question: string; required_fragment: string }>
}

const fixture = loadAssistantFixture<KnowledgeFixture>('knowledge_cases.json')

describe('asisten mitra', () => {
  test.each(fixture.greetings)('membalas sapaan %s', (question) => {
    const answer = answerMitraQuestion(question)
    expect(answer.reply).toContain('Halo!')
    expect(answer.suggestedTour).toBeUndefined()
    expect(answer.quickReplies).toHaveLength(5)
  })

  test.each(fixture.tours.map(({ question, tour }) => [question, tour] as const))('mengenali %s', (question, tour) => {
    const answer = answerMitraQuestion(question)
    expect(answer.suggestedTour).toBe(tour)
    expect(answer.tourLabel).toBeTruthy()
    expect(answer.quickReplies).toHaveLength(5)
  })

  test.each(fixture.refusal_cases)('menolak pertanyaan di luar inventaris: $question', ({ question, required_fragment }) => {
    const answer = answerMitraQuestion(question)
    expect(answer.suggestedTour).toBeUndefined()
    expect(answer.reply).toContain(required_fragment)
  })

  test('sapaan bersama pertanyaan tetap mengikuti topiknya', () => {
    const [stock] = fixture.mixed_cases
    expect(answerMitraQuestion(stock.question).suggestedTour).toBe(stock.tour)
    const refusal = fixture.refusal_cases[1]
    expect(answerMitraQuestion(refusal.question).reply).toContain(refusal.required_fragment)
  })

  test('menjelaskan stok tanpa kapasitas maksimum dan hanya bertambah setelah verifikasi', () => {
    const report = answerMitraQuestion(fixture.inventory_policy.report_question).reply
    const delivery = answerMitraQuestion(fixture.inventory_policy.delivery_question).reply
    for (const text of fixture.inventory_policy.report_required_fragments) expect(report).toContain(text)
    for (const text of fixture.inventory_policy.report_forbidden_fragments) expect(report).not.toContain(text)
    for (const text of fixture.inventory_policy.delivery_required_fragments) expect(delivery).toContain(text)
  })

  test('menjawab pertanyaan tentang identitas diri asisten dengan profil resmi daisuki.pkl', () => {
    for (const item of fixture.identity_cases) expect(answerMitraQuestion(item.question).reply).toContain(item.required_fragment)
  })
})
