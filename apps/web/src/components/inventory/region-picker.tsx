import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { unwrapData } from '@/lib/api-response'

export interface RegionCodes {
  province_code: string
  regency_code: string
  district_code: string
  village_code: string
}

export const emptyRegion: RegionCodes = {
  province_code: '',
  regency_code: '',
  district_code: '',
  village_code: '',
}

type RegionOption = { code: string; name: string }

export function RegionPicker({
  value,
  onChange,
  idPrefix,
  required = false,
}: {
  value: RegionCodes
  onChange: (value: RegionCodes) => void
  idPrefix: string
  required?: boolean
}) {
  const provinces = useQuery<RegionOption[]>({
    queryKey: ['regions', 'provinces'],
    queryFn: async () => unwrapData<RegionOption[]>(await api.regions.provinces.get(), 'Provinsi belum dapat dimuat'),
    staleTime: 24 * 60 * 60 * 1000,
  })
  const regencies = useQuery<RegionOption[]>({
    queryKey: ['regions', 'regencies', value.province_code],
    queryFn: async () => unwrapData<RegionOption[]>(await api.regions.regencies({ code: value.province_code }).get(), 'Kabupaten/kota belum dapat dimuat'),
    enabled: !!value.province_code,
    staleTime: 24 * 60 * 60 * 1000,
  })
  const districts = useQuery<RegionOption[]>({
    queryKey: ['regions', 'districts', value.regency_code],
    queryFn: async () => unwrapData<RegionOption[]>(await api.regions.districts({ code: value.regency_code }).get(), 'Kecamatan belum dapat dimuat'),
    enabled: !!value.regency_code,
    staleTime: 24 * 60 * 60 * 1000,
  })
  const villages = useQuery<RegionOption[]>({
    queryKey: ['regions', 'villages', value.district_code],
    queryFn: async () => unwrapData<RegionOption[]>(await api.regions.villages({ code: value.district_code }).get(), 'Kelurahan/desa belum dapat dimuat'),
    enabled: !!value.district_code,
    staleTime: 24 * 60 * 60 * 1000,
  })
  const fields = [
    { key: 'province_code', label: 'Provinsi', options: provinces.data, query: provinces, enabled: true },
    { key: 'regency_code', label: 'Kabupaten/kota', options: regencies.data, query: regencies, enabled: !!value.province_code },
    { key: 'district_code', label: 'Kecamatan', options: districts.data, query: districts, enabled: !!value.regency_code },
    { key: 'village_code', label: 'Kelurahan/desa', options: villages.data, query: villages, enabled: !!value.district_code },
  ] as const

  return (
    <fieldset className="grid gap-4 sm:grid-cols-2">
      <legend className="mb-3 text-sm font-semibold text-ink-900">Wilayah</legend>
      {fields.map((field) => (
        <div key={field.key}>
          <label htmlFor={`${idPrefix}-${field.key}`} className="mb-1.5 block text-sm font-semibold text-ink-900">{field.label}</label>
          <select
            id={`${idPrefix}-${field.key}`}
            value={value[field.key]}
            required={required || Object.values(value).some(Boolean)}
            disabled={!field.enabled || field.query.isPending || field.query.isError}
            onChange={(event) => {
              const code = event.target.value
              if (field.key === 'province_code') onChange({ province_code: code, regency_code: '', district_code: '', village_code: '' })
              if (field.key === 'regency_code') onChange({ ...value, regency_code: code, district_code: '', village_code: '' })
              if (field.key === 'district_code') onChange({ ...value, district_code: code, village_code: '' })
              if (field.key === 'village_code') onChange({ ...value, village_code: code })
            }}
            className="min-h-11 w-full rounded-md border border-line bg-white px-3 text-base text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-700 disabled:bg-ink-50 disabled:text-muted"
          >
            <option value="">{field.query.isPending && field.enabled ? 'Memuat...' : `Pilih ${field.label.toLowerCase()}`}</option>
            {field.options?.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
          </select>
          {field.query.isError ? (
            <button type="button" onClick={() => void field.query.refetch()} className="mt-1 min-h-11 text-sm font-medium text-crit-fg underline focus-visible:outline-2 focus-visible:outline-crit">
              Gagal memuat {field.label.toLowerCase()}. Coba lagi
            </button>
          ) : null}
        </div>
      ))}
    </fieldset>
  )
}
