import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { AssistantMessageText } from './mitra-ai-assistant'

describe('AssistantMessageText', () => {
  test('renders bold and italic Markdown without visible markers', () => {
    const html = renderToStaticMarkup(
      <AssistantMessageText text="**Stok aman** dan ***perlu dicek***. `**kode**`" />,
    )

    expect(html).toContain('<strong')
    expect(html).toContain('Stok aman</strong>')
    expect(html).toContain('<em>perlu dicek</em></strong>')
    expect(html).toContain('<code')
    expect(html).toContain('**kode**</code>')
    expect(html).not.toContain('***perlu dicek***')
  })

  test('keeps paragraph spacing, lists, tables, and code blocks readable', () => {
    const html = renderToStaticMarkup(
      <AssistantMessageText text={'Paragraf pertama.\n\nParagraf kedua.\n- **Item**\n\n| Produk | Stok |\n| --- | --- |\n| Basreng | 10 |\n\n```txt\n**tetap teks kode**\n```'} />,
    )

    expect(html).toContain('</p><p')
    expect(html).toContain('<ul')
    expect(html).toContain('<table')
    expect(html).toContain('<pre')
    expect(html).toContain('**tetap teks kode**')
  })
})
