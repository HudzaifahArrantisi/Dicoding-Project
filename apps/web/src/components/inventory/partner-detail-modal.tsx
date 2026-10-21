import { Dialog } from 'radix-ui'
import {
  Building2,
  Copy,
  Check,
  MapPin,
  Pencil,
  Shield,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { ManagedPartner } from '@/lib/inventory-types'

export function PartnerDetailModal({
  partner,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  partner: ManagedPartner | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (partner: ManagedPartner) => void
  onDelete: (partner: ManagedPartner) => void
}) {
  const [copied, setCopied] = useState(false)

  if (!partner) return null

  const handleCopyPhone = () => {
    if (!partner.pic_phone) return
    void navigator.clipboard.writeText(partner.pic_phone)
    setCopied(true)
    toast.success('Nomor telepon berhasil disalin')
    setTimeout(() => setCopied(false), 2000)
  }

  const regionItems = [
    { label: 'Kelurahan / Desa', value: partner.village_name },
    { label: 'Kecamatan', value: partner.district_name },
    { label: 'Kota / Kabupaten', value: partner.regency_name },
    { label: 'Provinsi', value: partner.province_name },
  ].filter((item) => Boolean(item.value))

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-xs animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-white shadow-2xl focus:outline-none animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white/95 px-5 py-4 backdrop-blur-sm">
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-ink-50 text-ink-700">
                <Building2 className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Dialog.Title className="truncate font-display text-base font-bold text-ink-900 sm:text-lg">
                    {partner.name}
                  </Dialog.Title>
                  <span className="rounded-sm bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-700">
                    {partner.type}
                  </span>
                </div>
                <Dialog.Description className="mt-0.5 text-xs text-muted truncate">
                  Rincian data cabang mitra dan akun akses
                </Dialog.Description>
              </div>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Tutup detail mitra"
                className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-white text-muted transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-ink-700"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body Content */}
          <div className="space-y-4 p-5">
            {/* PIC Information */}
            <div className="rounded-lg border border-line bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                <User className="size-3.5 text-ink-700" aria-hidden="true" />
                <span>Penanggung Jawab (PIC)</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-xs text-muted">Nama PIC</p>
                  <p className="mt-0.5 font-medium text-ink-900">
                    {partner.pic_name || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Nomor Telepon</p>
                  {partner.pic_phone ? (
                    <div className="mt-0.5 flex items-center gap-2">
                      <a
                        href={`tel:${partner.pic_phone}`}
                        className="font-medium tabular-nums text-ink-700 hover:underline"
                      >
                        {partner.pic_phone}
                      </a>
                      <button
                        type="button"
                        onClick={handleCopyPhone}
                        className="inline-flex size-6 items-center justify-center rounded text-muted hover:bg-ink-100 hover:text-ink-900"
                        title="Salin nomor"
                        aria-label="Salin nomor telepon"
                      >
                        {copied ? (
                          <Check className="size-3 text-ok" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-0.5 text-muted">—</p>
                  )}
                </div>
              </div>
            </div>

            {/* Login Account Information */}
            <div className="rounded-lg border border-line bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                <Shield className="size-3.5 text-ink-700" aria-hidden="true" />
                <span>Akun Masuk Portal Mitra</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-xs text-muted">Username</p>
                  <p className="mt-0.5 font-mono text-xs font-medium text-ink-900 break-all">
                    {partner.username || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Hak Akses</p>
                  <p className="mt-0.5 font-medium text-ink-900">
                    Portal Mitra Cabang
                  </p>
                </div>
              </div>
            </div>

            {/* Address & Region Information */}
            <div className="rounded-lg border border-line bg-white p-4 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                <MapPin className="size-3.5 text-ink-700" aria-hidden="true" />
                <span>Alamat & Wilayah Operasional</span>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted">Alamat Lengkap</p>
                  <p className="mt-0.5 text-ink-900 leading-relaxed whitespace-pre-line">
                    {partner.address || '—'}
                  </p>
                </div>

                <div className="border-t border-line/60 pt-3">
                  <p className="text-xs text-muted mb-1.5">Wilayah</p>
                  {regionItems.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {regionItems.map((item) => (
                        <div key={item.label} className="rounded bg-paper p-2">
                          <span className="text-muted block text-[10px]">
                            {item.label}
                          </span>
                          <span className="font-medium text-ink-900">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted">Belum diisi</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 flex items-center justify-between border-t border-line bg-paper/90 px-5 py-3 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => {
                onOpenChange(false)
                onDelete(partner)
              }}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-crit-fg hover:bg-crit-bg focus-visible:outline-2 focus-visible:outline-crit"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              <span>Hapus Mitra</span>
            </button>

            <div className="flex items-center gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center justify-center rounded-md border border-line bg-white px-3.5 text-xs font-semibold text-ink-900 shadow-2xs transition hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-ink-700"
                >
                  Tutup
                </button>
              </Dialog.Close>

              <button
                type="button"
                onClick={() => {
                  onOpenChange(false)
                  onEdit(partner)
                }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-ink-900 px-4 text-xs font-semibold text-white shadow-2xs transition hover:bg-ink-700 focus-visible:outline-2 focus-visible:outline-ink-700"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                <span>Ubah Data</span>
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
