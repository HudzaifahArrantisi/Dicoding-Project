import { apiClient } from './client'

export interface RegionOption {
  code: string
  name: string
}

/**
 * Mengambil daftar seluruh provinsi di Indonesia.
 */
export async function getProvinces(): Promise<RegionOption[]> {
  const response = await apiClient.get<{ data: RegionOption[] }>('/regions/provinces')
  return response.data
}

/**
 * Mengambil daftar kabupaten/kota berdasarkan kode provinsi terpilih.
 */
export async function getRegencies(provinceCode: string): Promise<RegionOption[]> {
  const response = await apiClient.get<{ data: RegionOption[] }>(`/regions/regencies/${provinceCode}`)
  return response.data
}

/**
 * Mengambil daftar kecamatan berdasarkan kode kabupaten/kota terpilih.
 */
export async function getDistricts(regencyCode: string): Promise<RegionOption[]> {
  const response = await apiClient.get<{ data: RegionOption[] }>(`/regions/districts/${regencyCode}`)
  return response.data
}

/**
 * Mengambil daftar kelurahan/desa berdasarkan kode kecamatan terpilih.
 */
export async function getVillages(districtCode: string): Promise<RegionOption[]> {
  const response = await apiClient.get<{ data: RegionOption[] }>(`/regions/villages/${districtCode}`)
  return response.data
}

