import { describe, expect, test } from 'bun:test'
import { composeMitraReply, resolveMitraIntent } from './compose'
import type { MitraContext, ModelRecord } from './context'
import type { WeeklyFacts } from './facts'

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
  test('sapaan dan fakta mingguan memakai profil serta snapshot, bukan angka jawaban tetap', () => {
    const facts = {
      metadata: { generated_at: '2026-11-04T17:00:00Z', period_days: 7, model_version: 'test' },
      central_warehouse: { total_stock_units: 321, products: [{ id: 'a', name: 'Basreng Daun Jeruk', sku: 'x', central_stock: 321, category: 'Camilan' }] },
      network_sales: { total_sold_7d: 25, total_sold_prev_7d: 20, sales_growth_percentage: 25, restock_fulfillment_rate: null, central_stock_health_days: 89, requested_restock_units: 0, approved_restock_units: 0 },
      top_performers_partners: [{ rank: 1, partner_name: 'Toko Uji', region: 'Bandung', weekly_units: 25, percentage: 100 }],
      top_selling_products: [{ rank: 1, product_name: 'Basreng Daun Jeruk', category: 'Camilan', weekly_units: 25, share_pct: 100 }],
      top_selling_categories: [{ category: 'Camilan', weekly_units: 25, share_pct: 100 }],
      regional_hotspots: [{ region: 'Bandung', province: 'Jawa Barat', status: 'ZONA_HIJAU', active_partners: 1, weekly_units: 25, stockout_probability: 0, urgency: 'NORMAL', recommended_action: 'Pantau rutin' }],
    } satisfies WeeklyFacts
    const withFacts = { ...context, weeklyFacts: facts } as MitraContext
    const emptyModel = { available: false, predictions: [] }
    expect(composeMitraReply('hai', withFacts, emptyModel, null).reply).toContain('Toko A')
    expect(composeMitraReply('stok pusat berapa', withFacts, emptyModel, null).reply).toContain('321 pcs')
    expect(composeMitraReply('produk apa yang paling laku', withFacts, emptyModel, null).reply).toContain('25 pcs')
    expect(composeMitraReply('mitra paling laku', withFacts, emptyModel, null).reply).toContain('Toko Uji')
    expect(composeMitraReply('siapa presiden', withFacts, emptyModel, null).reply).toContain('hanya bisa membantu urusan inventaris')
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
    expect(resolveMitraIntent('resep masakan yang tadi', 'delivery')).toBeNull()
  })
})
