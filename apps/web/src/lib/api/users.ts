import { apiClient } from './client'
import type { ManagedPartner, PartnerType } from '@/lib/inventory-types'

export interface PartnerPagination {
  total: number
  totalPages: number
  page: number
  limit: number
}

export interface PartnerListResponse {
  data: ManagedPartner[]
  pagination: PartnerPagination
}

export interface CreatePartnerPayload {
  name: string
  type: PartnerType
  address?: string
  pic_name?: string
  pic_phone?: string
  phone?: string
  province_code?: string
  regency_code?: string
  district_code?: string
  village_code?: string
  username?: string
  password?: string
  par_basreng?: number
  par_seblak?: number
  par_makaroni?: number
  par_keripik_pisang?: number
}

export type UpdatePartnerPayload = Partial<CreatePartnerPayload>

export interface PartnerQueryFilter {
  search?: string
  type?: string
  status?: string
  page?: number
  limit?: number
}

/**
 * Mengambil daftar seluruh cabang mitra yang terdaftar di sistem.
 */
export async function getPartners(filter: PartnerQueryFilter = {}): Promise<PartnerListResponse> {
  const params = new URLSearchParams()
  if (filter.search) params.set('search', filter.search)
  if (filter.type && filter.type !== 'semua') params.set('type', filter.type)
  if (filter.status) params.set('status', filter.status)
  if (filter.page) params.set('page', String(filter.page))
  if (filter.limit) params.set('limit', String(filter.limit))

  const qs = params.toString() ? `?${params.toString()}` : ''
  return apiClient.get<PartnerListResponse>(`/admin/partners${qs}`)
}

/**
 * Mendaftarkan mitra cabang baru beserta akun login dan buffer stok awal.
 */
export async function createPartner(payload: CreatePartnerPayload): Promise<{ status: string; id?: string }> {
  return apiClient.post<{ status: string; id?: string }>('/admin/partners', payload)
}

/**
 * Memperbarui data informasi atau buffer minimal cabang mitra.
 */
export async function updatePartner(id: string, payload: UpdatePartnerPayload): Promise<{ status: string }> {
  return apiClient.patch<{ status: string }>(`/admin/partners/${id}`, payload)
}

/**
 * Menghapus/menonaktifkan satu cabang mitra.
 */
export async function deletePartner(id: string): Promise<{ status: string }> {
  return apiClient.delete<{ status: string }>(`/admin/partners/${id}`)
}

/**
 * Menghapus/menonaktifkan beberapa cabang mitra sekaligus.
 */
export async function bulkDeletePartners(ids: string[]): Promise<{ status: string; deleted_count?: number }> {
  return apiClient.post<{ status: string; deleted_count?: number }>('/admin/partners/bulk-delete', { ids })
}

