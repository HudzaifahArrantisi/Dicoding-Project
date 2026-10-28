import { apiClient } from './client'
import type { Product } from '@/lib/inventory-types'

/**
 * Mengambil daftar 4 produk resmi Daisuki beserta stok ready gudang pusat.
 */
export async function getProducts(): Promise<Product[]> {
  const response = await apiClient.get<{ data: Product[] }>('/products')
  return response.data
}

/**
 * Mengambil satu produk berdasarkan ID.
 */
export async function getProductById(productId: string): Promise<Product | null> {
  const products = await getProducts()
  return products.find((p) => p.id === productId) ?? null
}

/**
 * Memperbarui ready stock gudang pusat untuk produk tertentu (khusus Admin).
 */
export async function updateCentralStock(productId: string, centralStock: number): Promise<{ status: string }> {
  return apiClient.put<{ status: string }>(`/products/${productId}/central-stock`, {
    central_stock: centralStock,
  })
}

