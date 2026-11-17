import { expect, test } from 'bun:test'
import { canTransition } from './index'

test('pre-order hanya bisa diproses setelah stok dialokasikan atau dibatalkan', () => {
  expect(canTransition('ditunda', 'diproses')).toBe(true)
  expect(canTransition('ditunda', 'disetujui')).toBe(false)
  expect(canTransition('ditunda', 'dibatalkan')).toBe(true)
})

test('barang harus dipacking sebelum dikirim dan diterima', () => {
  expect(canTransition('disetujui', 'dalam_pengiriman')).toBe(false)
  expect(canTransition('disetujui', 'dipacking')).toBe(true)
  expect(canTransition('dipacking', 'dalam_pengiriman')).toBe(true)
  expect(canTransition('dipacking', 'selesai')).toBe(false)
})
