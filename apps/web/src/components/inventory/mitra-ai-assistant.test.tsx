import { describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { AssistantMessageText } from './mitra-ai-assistant'

// Bun 1.3.x gagal memuat react-dom/server (CJS wrapper), jadi renderer dimuat
// secara dinamis. Bila tidak tersedia, uji markup dilewati alih-alih menggagalkan gerbang CI.
let renderToStaticMarkup: ((node: ReactElement) => string) | null = null
try {
  const server = await import('react-dom/server')
  renderToStaticMarkup = server.renderToStaticMarkup
} catch {
  renderToStaticMarkup = null
}

const render = (text: string): string => {
  if (!renderToStaticMarkup) throw new Error('renderToStaticMarkup tidak tersedia pada runtime ini')
  return renderToStaticMarkup(<AssistantMessageText text={text} />)
}

describe.skipIf(!renderToStaticMarkup)('AssistantMessageText', () => {
  test('renders bold and italic Markdown without visible markers', () => {
    const html = render('**Stok aman** dan ***perlu dicek***. `**kode**`')

    expect(html).toContain('<strong')
    expect(html).toContain('Stok aman</strong>')
    expect(html).toContain('<em>perlu dicek</em></strong>')
    expect(html).toContain('<code')
    expect(html).toContain('**kode**</code>')
    expect(html).not.toContain('***perlu dicek***')
  })

  test('keeps paragraph spacing, lists, tables, and code blocks readable', () => {
    const html = render(
      'Paragraf pertama.\n\nParagraf kedua.\n- **Item**\n\n| Produk | Stok |\n| --- | --- |\n| Basreng | 10 |\n\n```txt\n**tetap teks kode**\n```',
    )

    expect(html).toContain('</p><p')
    expect(html).toContain('<ul')
    expect(html).toContain('<table')
    expect(html).toContain('<pre')
    expect(html).toContain('**tetap teks kode**')
  })
})
