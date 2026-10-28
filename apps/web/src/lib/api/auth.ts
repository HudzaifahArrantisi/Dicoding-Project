import { apiClient, setCsrfToken } from './client'
import type { RegionCodes } from '@/components/inventory/region-picker'

export interface User {
  id: string
  email: string
  role: 'admin' | 'mitra'
  partner_id: string | null
  partner_name?: string | null
  partner_pic_name?: string | null
  partner_phone?: string | null
  partner_address?: string | null
  partner_photo?: string | null
  partner_region?: RegionCodes | null
  full_name: string
}

export interface CurrentUserResponse {
  csrf_token: string
  user: User
}

export interface LoginPayload {
  email: string
  password: string
}

export interface UpdateProfilePayload {
  name?: string
  pic_name?: string
  phone?: string
  address?: string
  province_code?: string
  regency_code?: string
  district_code?: string
  village_code?: string
  photo_data_url: string | null
}

/**
 * Melakukan otentikasi login ke backend.
 */
export async function login(payload: LoginPayload): Promise<{ status: string }> {
  return apiClient.post<{ status: string }>('/auth/login', payload)
}

/**
 * Mengambil profil pengguna yang sedang login beserta CSRF token sesi.
 */
export async function getCurrentUser(): Promise<CurrentUserResponse> {
  const data = await apiClient.get<CurrentUserResponse>('/me')
  if (data.csrf_token) {
    setCsrfToken(data.csrf_token)
  }
  return data
}

/**
 * Menghapus sesi otentikasi (logout).
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.post<{ status: string }>('/auth/logout')
  } finally {
    setCsrfToken(null)
  }
}

/**
 * Memperbarui profil cabang mitra (nama toko, PIC, no HP, alamat, foto, wilayah).
 */
export async function updateProfile(payload: UpdateProfilePayload): Promise<{ status: string }> {
  return apiClient.patch<{ status: string }>('/me/profile', payload)
}

