import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'radix-ui'
import { Printer, X } from 'lucide-react'
import type { Order } from '@/lib/inventory-types'

type DeliveryReceiptModalProps = {
  order: Order
  open: boolean
  onOpenChange: (open: boolean) => void
  afterShipment?: boolean
}

export function DeliveryReceiptModal({
  order,
  open,
  onOpenChange,
  afterShipment = false,
}: DeliveryReceiptModalProps) {
  const barcodeRef = useRef<SVGSVGElement>(null)
  const [qrData, setQrData] = useState<{ token: string; image: string } | null>(null)
  const [error, setError] = useState('')
  const qr = qrData && qrData.token === order.delivery_qr_token ? qrData.image : null
  const shippedItems = order.items.filter((item) => (item.qty_approved ?? 0) > 0)
  const total = shippedItems.reduce((sum, item) => sum + (item.qty_approved ?? 0), 0)

  useEffect(() => {
    if (!open || !order.delivery_code || !order.delivery_qr_token) return
    let alive = true
    setError('')
    setQrData(null)
    barcodeRef.current?.replaceChildren()

    Promise.all([import('qrcode'), import('jsbarcode')])
      .then(async ([QRCode, JsBarcode]) => {
        const image = await QRCode.toDataURL(order.delivery_qr_token!, {
          width: 240,
          margin: 1,
          errorCorrectionLevel: 'M',
        })
        if (!alive || !barcodeRef.current) return
        JsBarcode.default(barcodeRef.current, order.delivery_code!, {
          format: 'CODE128',
          width: 1.5,
          height: 44,
          margin: 2,
          displayValue: true,
          fontSize: 12,
        })
        setQrData({ token: order.delivery_qr_token!, image })
      })
      .catch(() => {
        if (alive) setError('Kode resi belum dapat dibuat. Tutup lalu buka kembali resi.')
      })
    return () => { alive = false }
  }, [open, order.delivery_code, order.delivery_qr_token])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <style media="print">{'@page { size: 80mm 210mm; margin: 0; }'}</style>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-ink-900/45" />
        <Dialog.Content className="receipt-dialog fixed left-1/2 top-1/2 z-[71] max-h-[94vh] w-[calc(100%-1rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-white p-4 shadow-xl focus-visible:outline-2 focus-visible:outline-ume sm:p-6">
          <div className="receipt-actions mb-4 flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-xl font-semibold text-ink-900">
                {afterShipment ? 'Barang dikirim. Cetak resi?' : 'Cetak ulang resi'}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                Resi ini siap dicetak pada kertas struk thermal 80 mm dan dimasukkan ke paket.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="grid size-11 shrink-0 place-items-center rounded-md border border-line bg-white text-ink-900 focus-visible:outline-2 focus-visible:outline-ume" aria-label="Tutup resi">
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </div>

          {error ? <p role="alert" className="receipt-actions mb-3 text-sm text-crit-fg">{error}</p> : null}

          <article className="delivery-receipt mx-auto w-full max-w-[80mm] border border-line bg-white p-4 text-ink-900">
            <header className="border-b border-ink-900 pb-3 text-center">
              <p className="font-display text-xl font-bold">DAISUKI</p>
              <p className="text-xs font-semibold">RESI PENGIRIMAN</p>
            </header>

            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between gap-2"><dt>No. pesanan</dt><dd className="text-right font-bold tabular-nums">{order.order_no}</dd></div>
              <div className="flex justify-between gap-2"><dt>Dikirim</dt><dd className="text-right tabular-nums">{order.shipped_at ? new Date(order.shipped_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</dd></div>
              <div className="border-t border-dashed border-ink-400 pt-2"><dt>Tujuan</dt><dd className="font-semibold">{order.partner_name}</dd></div>
              {order.partner_address ? <div><dt>Alamat</dt><dd className="break-words">{order.partner_address}</dd></div> : null}
            </dl>

            <table className="mt-3 w-full table-fixed border-collapse text-left text-xs">
              <thead><tr className="border-y border-ink-400"><th className="w-[70%] py-2 font-semibold">Barang</th><th className="py-2 text-right font-semibold">Jumlah</th></tr></thead>
              <tbody>{shippedItems.map((item) => (
                <tr key={item.id} className="border-b border-dashed border-ink-300">
                  <td className="break-words py-2 pr-2">{item.product_name}</td>
                  <td className="py-2 text-right tabular-nums">{item.qty_approved} {item.product_unit}</td>
                </tr>
              ))}</tbody>
              <tfoot><tr><th className="py-2">Total</th><td className="py-2 text-right font-bold tabular-nums">{total} pcs</td></tr></tfoot>
            </table>

            <div className="mt-2 flex flex-col items-center gap-2 border-t border-ink-900 pt-3 text-center">
              <p className="text-xs font-semibold">Pindai untuk konfirmasi penerimaan</p>
              {qr ? <img src={qr} alt="QR Code verifikasi pengiriman" className="size-40" /> : <p role="status" className="py-8 text-xs text-muted">Membuat QR Code...</p>}
              <svg ref={barcodeRef} role="img" aria-label={`Barcode ${order.delivery_code}`} className="max-w-full" />
            </div>
            <p className="mt-3 border-t border-dashed border-ink-400 pt-2 text-center text-[11px] leading-4">Masukkan struk ini ke paket. Mitra memindai kode saat barang diterima.</p>
          </article>

          <div className="receipt-actions mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className="min-h-11 flex-1 rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ume">
              Nanti
            </button>
            <button type="button" onClick={() => window.print()} disabled={!qr || !!error} className="inline-flex min-h-11 flex-[2] items-center justify-center gap-2 rounded-md bg-ume px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ume">
              <Printer className="size-4" aria-hidden="true" /> Cetak struk thermal
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
