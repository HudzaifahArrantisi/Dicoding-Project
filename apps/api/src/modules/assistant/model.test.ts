import { afterAll, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { classifyMitraMessage, predictMitraStocks, stopMitraModelWorker } from './model'
import type { ModelRecord } from './context'

afterAll(() => stopMitraModelWorker())

const modelPath = resolve(import.meta.dir, '../../../../../ai/data/mainbrain/models/daisuki.pkl')
const python = process.env.DAISUKI_PYTHON_BIN || 'python'

test.skipIf(!existsSync(modelPath) || !Bun.which(python))('memakai daisuki.pkl untuk menilai data stok mitra', async () => {
  const record: ModelRecord = {
    partner_id: '11111111-1111-1111-1111-111111111111',
    partner_name: 'Cabang Uji', partner_type: 'kafe',
    product_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', product_name: 'Basreng Daun Jeruk',
    current_qty: 5, par_level: 30, central_stock: 850,
    sold_7d: 28, sold_prev_7d: 8, sold_30d: 40, report_count: 7,
    critical_count: 3, requested_30d: 0, approved_30d: 0,
    has_active_order: false, updated_at: new Date(),
  }
  const result = await predictMitraStocks([record])
  expect(result.available).toBe(true)
  expect(result.predictions).toHaveLength(1)
  expect(result.predictions[0].product_id).toBe(record.product_id)
  expect(['urgent_restock', 'regular_order', 'normal']).toContain(result.predictions[0].label)
  expect(result.predictions[0].confidence).toBeGreaterThan(0)
}, 40_000)

test.skipIf(!existsSync(modelPath) || !Bun.which(python))('model mengenali intent pesan mitra', async () => {
  for (const [message, expected] of [
    ['hai', 'greeting'],
    ['berapa total stok gudang pusat daisuki saat ini', 'central_stock'],
    ['produk apa yang paling laku', 'top_products'],
    ['siapa presiden indonesia', 'out_of_scope'],
  ] as const) {
    expect((await classifyMitraMessage(message))?.label).toBe(expected)
  }
}, 40_000)
