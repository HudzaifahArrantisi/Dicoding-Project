import { describe, expect, test } from 'bun:test'
import { composeMitraReply, resolveMitraIntent } from './compose'
import type { MitraContext, ModelRecord } from './context'

const stock: ModelRecord = {
  partner_id: 'mitra-a', partner_name: 'Toko A', partner_type: 'kafe',
  product_id: 'produk-a', product_name: 'Basreng Daun Jeruk',
  current_qty: 8, par_level: 50, central_stock: 90,
  sold_7d: 35, sold_prev_7d: 21, sold_30d: 110, report_count: 7,
  critical_count: 2, requested_30d: 0, approved_30d: 0,
  has_active_order: false, updated_at: new Date(),
}

const context = {
  stocks: [stock],
  partner: { name: 'Toko A', pic_name: 'Sari', pic_phone: '0812345', address: 'Jl. A', province_name: 'Banten', regency_name: 'Tangerang', district_name: 'Serpong', village_name: 'Lengkong' },
  orders: [{ order_no: 'PO-123', status: 'dalam_pengiriman', created_at: new Date(), admin_note: null }],
  logs: [{ product_name: 'Basreng Daun Jeruk', qty_before: 12, qty_after: 8, source: 'manual_update', created_at: new Date() }],
} as MitraContext

describe('jawaban dengan data mitra', () => {
  test('sapaan dan ringkasan produk hanya memakai data cabang sendiri', () => {
    const emptyModel = { available: false, predictions: [] }
    expect(composeMitraReply('hai', context, emptyModel, null).reply).toContain('Toko A')
    expect(composeMitraReply('stok pusat berapa', context, emptyModel, null).reply).toContain('90 pcs')
    expect(composeMitraReply('produk apa yang paling laku', context, emptyModel, null).reply).toContain('35 pcs')
    expect(composeMitraReply('mitra paling laku', context, emptyModel, null).reply).toContain('hanya dapat menampilkan data inventaris cabang Anda sendiri')
    expect(composeMitraReply('siapa presiden', context, emptyModel, null).reply).toContain('asisten khusus inventaris Daisuki B2B')
    expect(composeMitraReply('kamu siapa', context, emptyModel, null).reply).toContain('Daisuki AI Assistant')
  })
  test('stok berasal dari data terbaru dan buffer bukan kapasitas maksimum', () => {
    const answer = composeMitraReply('stok saya sekarang berapa?', context, { available: false, predictions: [] }, null)
    expect(answer.reply).toContain('8 pcs')
    expect(answer.reply).toContain('Basreng Daun Jeruk')
    expect(answer.reply).toContain('bukan batas maksimum')
  })

  test('prioritas restock memakai label model dan jumlah dibatasi stok pusat', () => {
    const answer = composeMitraReply('perlu restock?', context, {
      available: true,
      predictions: [{ product_id: stock.product_id, label: 'urgent_restock', confidence: 0.91 }],
    }, null)
    expect(answer.reply).toContain('model daisuki.pkl')
    expect(answer.reply).toContain('prioritas segera')
    expect(answer.reply).toContain('42 pcs')
    expect(answer.reply).toContain('90 pcs')
  })

  test('status kiriman dan follow-up tetap pada cabang yang sama', () => {
    const answer = composeMitraReply('scan resi', context, { available: false, predictions: [] }, null)
    expect(answer.reply).toContain('PO-123')
    expect(answer.reply).toContain('verifikasi berhasil')
    expect(resolveMitraIntent('yang tadi bagaimana?', 'delivery')).toBe('delivery')
    expect(resolveMitraIntent('siapa kamu?', null)).toBe('identity')
    expect(resolveMitraIntent('resep masakan yang tadi', 'delivery')).toBeNull()
  })
})
