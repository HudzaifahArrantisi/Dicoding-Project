import { useEffect, useRef, useState } from 'react'
import { Dialog } from 'radix-ui'
import { Printer, X, FileText, Receipt, Check, Copy } from 'lucide-react'
import type { Order } from '@/lib/inventory-types'

type DeliveryReceiptModalProps = {
  order: Order
  open: boolean
  onOpenChange: (open: boolean) => void
  afterShipment?: boolean
}

type PrintFormat = 'surat_jalan' | 'thermal'

function printDocumentViaIframe(htmlContent: string) {
  const existingFrame = document.getElementById('daisuki-print-frame')
  if (existingFrame) {
    existingFrame.remove()
  }

  const iframe = document.createElement('iframe')
  iframe.id = 'daisuki-print-frame'
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.visibility = 'hidden'

  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) return

  doc.open()
  doc.write(htmlContent)
  doc.close()

  setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
  }, 250)
}

export function DeliveryReceiptModal({
  order,
  open,
  onOpenChange,
  afterShipment = false,
}: DeliveryReceiptModalProps) {
  const barcodeRef = useRef<SVGSVGElement>(null)
  const [printFormat, setPrintFormat] = useState<PrintFormat>('surat_jalan')
  const [qrData, setQrData] = useState<{ token: string; image: string } | null>(null)
  const [barcodeSvgHtml, setBarcodeSvgHtml] = useState('')
  const [error, setError] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)

  const qr = qrData && qrData.token === order.delivery_qr_token ? qrData.image : null
  const shippedItems = order.items.filter((item) => (item.qty_approved ?? 0) > 0)
  const total = shippedItems.reduce((sum, item) => sum + (item.qty_approved ?? 0), 0)

  const partnerTypeLabel =
    order.partner_type === 'kafe'
      ? 'Kafe'
      : order.partner_type === 'hotel'
        ? 'Hotel'
        : order.partner_type === 'restoran'
          ? 'Restoran'
          : order.partner_type === 'minimarket'
            ? 'Minimarket'
            : order.partner_type

  const shippedDate = order.shipped_at
    ? new Date(order.shipped_at).toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date(order.created_at).toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })

  useEffect(() => {
    if (!open || !order.delivery_code || !order.delivery_qr_token) return
    let alive = true
    setError('')
    setQrData(null)
    setBarcodeSvgHtml('')
    barcodeRef.current?.replaceChildren()

    Promise.all([import('qrcode'), import('jsbarcode')])
      .then(async ([QRCode, JsBarcode]) => {
        const image = await QRCode.toDataURL(order.delivery_qr_token!, {
          width: 320,
          margin: 4,
          errorCorrectionLevel: 'M',
        })
        if (!alive || !barcodeRef.current) return
        JsBarcode.default(barcodeRef.current, order.delivery_code!, {
          format: 'CODE128',
          width: 1.8,
          height: 48,
          margin: 8,
          displayValue: true,
          fontSize: 12,
        })
        setBarcodeSvgHtml(barcodeRef.current.outerHTML)
        setQrData({ token: order.delivery_qr_token!, image })
      })
      .catch(() => {
        if (alive) setError('Kode resi belum dapat dibuat. Tutup lalu buka kembali resi.')
      })
    return () => {
      alive = false
    }
  }, [open, order.delivery_code, order.delivery_qr_token])

  const handleCopyCode = () => {
    if (!order.delivery_code) return
    void navigator.clipboard.writeText(order.delivery_code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handlePrint = () => {
    if (!qr || !barcodeSvgHtml) return

    if (printFormat === 'surat_jalan') {
      const rowsHtml = shippedItems
        .map(
          (item, idx) => `
          <tr>
            <td style="text-align: center; color: #6b7280;">${idx + 1}</td>
            <td style="font-family: monospace; font-size: 8.5pt;">${item.product_sku || '-'}</td>
            <td><strong>${item.product_name}</strong></td>
            <td style="text-align: center;">${item.product_unit}</td>
            <td style="text-align: right; font-weight: 700; font-size: 10pt;">${item.qty_approved}</td>
            <td style="text-align: center; color: #9ca3af; font-size: 8pt;">[ &nbsp; ]</td>
          </tr>`,
        )
        .join('')

      const a4Html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Surat Jalan - ${order.order_no}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      font-size: 10pt;
      line-height: 1.35;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .sj-container {
      width: 100%;
      margin: 0 auto;
    }
    .sj-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 10px;
      border-bottom: 2px solid #111827;
    }
    .sj-brand-name {
      font-size: 20pt;
      font-weight: 800;
      color: #111827;
      letter-spacing: -0.5px;
      line-height: 1;
    }
    .sj-brand-sub {
      font-size: 8.5pt;
      font-weight: 600;
      color: #4b5563;
      margin-top: 3px;
    }
    .sj-brand-meta {
      font-size: 7.5pt;
      color: #6b7280;
      margin-top: 2px;
    }
    .sj-title-box {
      text-align: right;
    }
    .sj-title {
      font-size: 16pt;
      font-weight: 800;
      color: #111827;
      letter-spacing: 0.5px;
      line-height: 1;
    }
    .sj-title-en {
      font-size: 8pt;
      font-weight: 600;
      color: #6b7280;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .sj-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 12px;
      margin-bottom: 12px;
    }
    .sj-card {
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 8px 12px;
      background-color: #f9fafb;
    }
    .sj-card-title {
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      margin-bottom: 5px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 3px;
    }
    .sj-card table {
      width: 100%;
      font-size: 9pt;
      border-collapse: collapse;
    }
    .sj-card td {
      padding: 2px 0;
      vertical-align: top;
    }
    .sj-card td.lbl {
      width: 105px;
      color: #4b5563;
    }
    .sj-card td.val {
      font-weight: 600;
      color: #111827;
    }
    .sj-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      margin-bottom: 12px;
      font-size: 9pt;
    }
    .sj-table th {
      background-color: #f3f4f6;
      color: #111827;
      font-weight: 700;
      text-align: left;
      padding: 7px 9px;
      border: 1px solid #d1d5db;
      text-transform: uppercase;
      font-size: 7.5pt;
    }
    .sj-table td {
      padding: 6px 9px;
      border: 1px solid #e5e7eb;
      color: #1f2937;
    }
    .sj-table tr:nth-child(even) td {
      background-color: #fafafa;
    }
    .sj-table tfoot td {
      background-color: #f3f4f6;
      font-weight: 700;
      border: 1px solid #d1d5db;
      padding: 7px 9px;
    }
    .sj-verification {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px dashed #9ca3af;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 14px;
      background-color: #ffffff;
      gap: 14px;
    }
    .sj-verif-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .sj-verif-qr {
      width: 84px;
      height: 84px;
      flex-shrink: 0;
    }
    .sj-verif-text h4 {
      font-size: 9pt;
      font-weight: 700;
      color: #111827;
      margin-bottom: 2px;
    }
    .sj-verif-text p {
      font-size: 8pt;
      color: #4b5563;
      line-height: 1.35;
      max-width: 310px;
    }
    .sj-verif-barcode {
      text-align: center;
      flex-shrink: 0;
    }
    .sj-verif-barcode svg {
      max-width: 175px;
      height: auto;
    }
    .sj-signatures {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-top: 8px;
      text-align: center;
    }
    .sj-sig-col {
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 8px;
      background-color: #ffffff;
    }
    .sj-sig-title {
      font-size: 8pt;
      font-weight: 600;
      color: #4b5563;
    }
    .sj-sig-space {
      height: 48px;
    }
    .sj-sig-name {
      font-size: 8.5pt;
      font-weight: 700;
      color: #111827;
      border-top: 1px solid #d1d5db;
      padding-top: 4px;
      margin: 0 8px;
    }
    .sj-sig-date {
      font-size: 7.5pt;
      color: #9ca3af;
      margin-top: 2px;
    }
    .sj-footer-note {
      margin-top: 10px;
      font-size: 7pt;
      color: #9ca3af;
      text-align: center;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="sj-container">
    <div class="sj-header">
      <div>
        <h1 class="sj-brand-name">DAISUKI</h1>
        <p class="sj-brand-sub">B2B Inventory & Order Management System</p>
        <p class="sj-brand-meta">Gudang Distribusi Pusat • Telp: (021) 8899-2345 • logistics@daisuki.id</p>
      </div>
      <div class="sj-title-box">
        <h2 class="sj-title">SURAT JALAN</h2>
        <p class="sj-title-en">DELIVERY NOTE / PACKING SLIP</p>
      </div>
    </div>

    <div class="sj-grid">
      <div class="sj-card">
        <div class="sj-card-title">Informasi Dokumen & Pengiriman</div>
        <table>
          <tr>
            <td class="lbl">No. Surat Jalan</td>
            <td class="val">${order.delivery_code || order.order_no}</td>
          </tr>
          <tr>
            <td class="lbl">No. PO Pesanan</td>
            <td class="val">${order.order_no}</td>
          </tr>
          <tr>
            <td class="lbl">Tanggal Kirim</td>
            <td class="val">${shippedDate}</td>
          </tr>
          <tr>
            <td class="lbl">Status Logistik</td>
            <td class="val" style="color: #0284c7;">Dalam Pengiriman</td>
          </tr>
        </table>
      </div>

      <div class="sj-card">
        <div class="sj-card-title">Tujuan Pengiriman (Mitra)</div>
        <table>
          <tr>
            <td class="lbl">Nama Mitra</td>
            <td class="val">${order.partner_name} (${partnerTypeLabel})</td>
          </tr>
          <tr>
            <td class="lbl">Alamat Tujuan</td>
            <td class="val">${order.partner_address || 'Cabang terdaftar di sistem'}</td>
          </tr>
          <tr>
            <td class="lbl">Catatan Khusus</td>
            <td class="val">${order.admin_note || order.note || '-'}</td>
          </tr>
        </table>
      </div>
    </div>

    <table class="sj-table">
      <thead>
        <tr>
          <th style="width: 34px; text-align: center;">No</th>
          <th style="width: 100px;">SKU</th>
          <th>Nama Barang / Produk</th>
          <th style="width: 75px; text-align: center;">Satuan</th>
          <th style="width: 90px; text-align: right;">Kuantitas</th>
          <th style="width: 75px; text-align: center;">Cek Fisik</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4" style="text-align: right; font-weight: bold;">TOTAL BARANG DIKIRIM:</td>
          <td style="text-align: right; font-weight: bold; font-size: 10.5pt;">${total} pcs</td>
          <td style="text-align: center; color: #6b7280; font-size: 7.5pt;">Lengkap [ &nbsp; ]</td>
        </tr>
      </tfoot>
    </table>

    <div class="sj-verification">
      <div class="sj-verif-left">
        <img src="${qr}" class="sj-verif-qr" alt="QR Code" />
        <div class="sj-verif-text">
          <h4>Pindai untuk Konfirmasi Penerimaan Fisik</h4>
          <p>Petugas cabang mitra wajib memindai QR Code ini menggunakan aplikasi Daisuki Mitra saat barang tiba untuk memverifikasi stok dan menyelesaikan pesanan.</p>
        </div>
      </div>
      <div class="sj-verif-barcode">
        ${barcodeSvgHtml}
        <p style="font-size: 7.5pt; color: #6b7280; margin-top: 2px;">Kode: ${order.delivery_code || '-'}</p>
      </div>
    </div>

    <div class="sj-signatures">
      <div class="sj-sig-col">
        <p class="sj-sig-title">Diserahkan Oleh,</p>
        <div class="sj-sig-space"></div>
        <p class="sj-sig-name">Admin Gudang Pusat</p>
        <p class="sj-sig-date">Tgl: ________________</p>
      </div>
      <div class="sj-sig-col">
        <p class="sj-sig-title">Pengemudi / Kurir,</p>
        <div class="sj-sig-space"></div>
        <p class="sj-sig-name">Ekspedisi Pengiriman</p>
        <p class="sj-sig-date">Tgl: ________________</p>
      </div>
      <div class="sj-sig-col">
        <p class="sj-sig-title">Diterima Oleh,</p>
        <div class="sj-sig-space"></div>
        <p class="sj-sig-name">PIC Cabang Mitra</p>
        <p class="sj-sig-date">Tgl: ________________</p>
      </div>
    </div>

    <p class="sj-footer-note">Dokumen ini dicetak otomatis dari Sistem Daisuki Inventory. Harap simpan 1 rangkap untuk arsip mitra dan 1 rangkap untuk gudang pusat.</p>
  </div>
</body>
</html>`

      printDocumentViaIframe(a4Html)
    } else {
      const thermalRowsHtml = shippedItems
        .map(
          (item) => `
        <tr>
          <td style="padding: 3px 0; border-bottom: 1px dashed #ccc;">
            <strong>${item.product_name}</strong>
          </td>
          <td style="text-align: right; padding: 3px 0; border-bottom: 1px dashed #ccc; font-weight: 700;">
            ${item.qty_approved} ${item.product_unit}
          </td>
        </tr>`,
        )
        .join('')

      const thermalHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Resi Thermal - ${order.order_no}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 3mm 4mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #000000;
      background: #ffffff;
      font-size: 8.5pt;
      line-height: 1.3;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .thermal-container {
      width: 72mm;
      margin: 0 auto;
    }
    .thermal-header {
      text-align: center;
      border-bottom: 2px solid #000000;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }
    .thermal-brand {
      font-size: 15pt;
      font-weight: 800;
      margin: 0;
      letter-spacing: 0.5px;
    }
    .thermal-sub {
      font-size: 8pt;
      font-weight: 700;
      margin-top: 1px;
    }
    .thermal-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
      font-size: 8pt;
    }
    .thermal-divider {
      border-top: 1px dashed #000000;
      margin: 5px 0;
    }
    .thermal-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin: 4px 0;
    }
    .thermal-table th {
      border-top: 1px solid #000000;
      border-bottom: 1px solid #000000;
      padding: 3px 0;
      text-align: left;
    }
    .thermal-total-row {
      display: flex;
      justify-content: space-between;
      font-weight: 800;
      font-size: 9.5pt;
      border-top: 1px solid #000000;
      padding-top: 4px;
      margin-top: 4px;
    }
    .thermal-qr {
      text-align: center;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid #000000;
    }
    .thermal-qr img {
      width: 125px;
      height: 125px;
      margin: 3px auto;
      display: block;
    }
    .thermal-barcode {
      text-align: center;
      margin-top: 4px;
    }
    .thermal-barcode svg {
      max-width: 100%;
      height: auto;
    }
    .thermal-footer {
      text-align: center;
      font-size: 7pt;
      border-top: 1px dashed #000000;
      padding-top: 5px;
      margin-top: 6px;
      line-height: 1.25;
    }
  </style>
</head>
<body>
  <div class="thermal-container">
    <div class="thermal-header">
      <h1 class="thermal-brand">DAISUKI</h1>
      <p class="thermal-sub">RESI PENGIRIMAN</p>
    </div>

    <div class="thermal-row">
      <span>No. Pesanan:</span>
      <strong>${order.order_no}</strong>
    </div>
    <div class="thermal-row">
      <span>No. Surat Jalan:</span>
      <strong>${order.delivery_code || '-'}</strong>
    </div>
    <div class="thermal-row">
      <span>Dikirim:</span>
      <span>${shippedDate}</span>
    </div>

    <div class="thermal-divider"></div>

    <div class="thermal-row">
      <span>Tujuan:</span>
      <strong>${order.partner_name}</strong>
    </div>
    ${order.partner_address ? `
    <div style="font-size: 7.5pt; color: #333; margin-top: 2px;">
      ${order.partner_address}
    </div>` : ''}

    <div class="thermal-divider"></div>

    <table class="thermal-table">
      <thead>
        <tr>
          <th style="width: 70%;">Barang</th>
          <th style="text-align: right;">Jumlah</th>
        </tr>
      </thead>
      <tbody>
        ${thermalRowsHtml}
      </tbody>
    </table>

    <div class="thermal-total-row">
      <span>TOTAL</span>
      <span>${total} pcs</span>
    </div>

    <div class="thermal-qr">
      <p style="font-size: 7.5pt; font-weight: 700;">PINDAI SAAT TERIMA BARANG</p>
      <img src="${qr}" alt="QR Code" />
      <div class="thermal-barcode">
        ${barcodeSvgHtml}
      </div>
    </div>

    <p class="thermal-footer">
      Masukkan struk ini ke paket.<br />
      Mitra memindai kode saat barang diterima.
    </p>
  </div>
</body>
</html>`

      printDocumentViaIframe(thermalHtml)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-ink-900/45 backdrop-blur-xs" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[71] max-h-[94vh] w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-white shadow-2xl focus:outline-none">
          {/* Header Dialog */}
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-white/95 px-5 py-4 backdrop-blur-md sm:px-6">
            <div>
              <Dialog.Title className="font-display text-xl font-bold text-ink-900">
                {afterShipment ? 'Barang Dikirim · Cetak Dokumen' : 'Cetak Resi / Surat Jalan'}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-ink-50 hover:text-ink-900 cursor-pointer"
                aria-label="Tutup dialog cetak"
              >
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            {/* Hidden SVG used for JsBarcode generation */}
            <svg ref={barcodeRef} className="hidden" aria-hidden="true" />

            {error ? (
              <p role="alert" className="rounded-lg border border-crit/30 bg-crit-bg/30 p-3 text-sm text-crit-fg">
                {error}
              </p>
            ) : null}

            {/* Pilihan Format Cetak (Segmented Control) */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Pilih Format Cetak:
              </span>
              <div className="inline-flex rounded-lg border border-line bg-paper p-1">
                <button
                  type="button"
                  onClick={() => setPrintFormat('surat_jalan')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    printFormat === 'surat_jalan'
                      ? 'bg-white text-ink-900 shadow-xs'
                      : 'text-ink-600 hover:text-ink-900'
                  }`}
                >
                  <FileText className="size-4" />
                  <span>Surat Jalan (A4 Standar)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintFormat('thermal')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    printFormat === 'thermal'
                      ? 'bg-white text-ink-900 shadow-xs'
                      : 'text-ink-600 hover:text-ink-900'
                  }`}
                >
                  <Receipt className="size-4" />
                  <span>Struk Thermal (80 mm)</span>
                </button>
              </div>
            </div>

            {/* Card Preview Dokumen */}
            <div className="rounded-xl border border-line bg-ink-50/70 p-4 sm:p-6 overflow-hidden">
              <div className="mb-3 flex items-center justify-between text-xs text-muted">
                {order.delivery_code ? (
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1 font-semibold text-ume hover:underline cursor-pointer"
                  >
                    {copiedCode ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    <span>{copiedCode ? 'Tersalin' : `Salin Kode: ${order.delivery_code}`}</span>
                  </button>
                ) : null}
              </div>

              {/* Tampilan Preview: A4 Surat Jalan */}
              {printFormat === 'surat_jalan' ? (
                <div className="mx-auto w-full max-w-xl rounded-lg border border-line bg-white p-5 sm:p-6 text-xs text-ink-900 shadow-xs">
                  {/* Kop */}
                  <div className="flex items-start justify-between border-b-2 border-ink-900 pb-3">
                    <div>
                      <h3 className="font-display text-lg font-extrabold tracking-tight text-ink-900">
                        DAISUKI
                      </h3>
                      <p className="text-[11px] font-semibold text-ink-600">
                        B2B Inventory & Order Management System
                      </p>
                      <p className="text-[10px] text-muted">Gudang Distribusi Pusat</p>
                    </div>
                    <div className="text-right">
                      <span className="font-display text-sm font-extrabold uppercase text-ink-900">
                        SURAT JALAN
                      </span>
                      <p className="text-[10px] text-muted">DELIVERY NOTE</p>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                    <div className="rounded border border-line bg-ink-50/50 p-2.5 space-y-1">
                      <p className="font-bold uppercase text-[9px] text-muted">Informasi Pengiriman</p>
                      <p><span className="text-muted">No. SJ:</span> <strong className="tabular-nums">{order.delivery_code || order.order_no}</strong></p>
                      <p><span className="text-muted">No. PO:</span> <strong className="tabular-nums">{order.order_no}</strong></p>
                      <p><span className="text-muted">Tanggal:</span> <span className="tabular-nums">{shippedDate}</span></p>
                    </div>
                    <div className="rounded border border-line bg-ink-50/50 p-2.5 space-y-1">
                      <p className="font-bold uppercase text-[9px] text-muted">Tujuan Mitra</p>
                      <p><span className="text-muted">Penerima:</span> <strong>{order.partner_name}</strong> ({partnerTypeLabel})</p>
                      <p className="truncate"><span className="text-muted">Alamat:</span> {order.partner_address || '-'}</p>
                    </div>
                  </div>

                  {/* Tabel Preview */}
                  <table className="mt-3 w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="border-y border-ink-300 bg-paper text-ink-800">
                        <th className="py-1.5 px-2 text-left font-bold w-8">No</th>
                        <th className="py-1.5 px-2 text-left font-bold">Produk</th>
                        <th className="py-1.5 px-2 text-center font-bold w-16">Satuan</th>
                        <th className="py-1.5 px-2 text-right font-bold w-20">Kuantitas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {shippedItems.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="py-1.5 px-2 text-muted tabular-nums">{idx + 1}</td>
                          <td className="py-1.5 px-2 font-medium">{item.product_name}</td>
                          <td className="py-1.5 px-2 text-center text-muted">{item.product_unit}</td>
                          <td className="py-1.5 px-2 text-right font-bold tabular-nums">{item.qty_approved}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-ink-900 font-bold bg-paper/60">
                        <td colSpan={3} className="py-2 px-2 text-right">TOTAL DIKIRIM:</td>
                        <td className="py-2 px-2 text-right tabular-nums text-ink-900">{total} pcs</td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* QR & Barcode Section */}
                  <div className="mt-3 flex items-center justify-between gap-3 rounded border border-dashed border-ink-300 p-2.5 bg-paper/30">
                    <div className="flex items-center gap-2.5">
                      {qr ? (
                        <img src={qr} alt="QR Code Verifikasi" className="size-16 shrink-0 rounded bg-white p-1 border border-line" />
                      ) : (
                        <div className="size-16 shrink-0 rounded bg-ink-100 flex items-center justify-center text-[9px] text-muted">QR...</div>
                      )}
                      <div>
                        <p className="font-bold text-[11px] text-ink-900">QR Konfirmasi Penerimaan</p>
                        <p className="text-[10px] text-muted leading-tight">Mitra memindai kode ini via aplikasi saat barang tiba.</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {barcodeSvgHtml ? (
                        <div
                          className="scale-90 origin-right"
                          dangerouslySetInnerHTML={{ __html: barcodeSvgHtml }}
                        />
                      ) : (
                        <div className="h-10 w-28 rounded bg-ink-100 animate-pulse" />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Tampilan Preview: Thermal Struk 80mm */
                <article className="mx-auto w-full max-w-[80mm] rounded-lg border border-line bg-white p-4 text-xs text-ink-900 shadow-xs">
                  <header className="border-b border-ink-900 pb-2.5 text-center">
                    <p className="font-display text-lg font-bold">DAISUKI</p>
                    <p className="text-[10px] font-bold tracking-wider text-muted">RESI PENGIRIMAN</p>
                  </header>

                  <dl className="mt-2.5 space-y-1 text-[11px]">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">No. pesanan:</dt>
                      <dd className="font-bold tabular-nums text-right">{order.order_no}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">Dikirim:</dt>
                      <dd className="tabular-nums text-right">{shippedDate}</dd>
                    </div>
                    <div className="border-t border-dashed border-line pt-1.5">
                      <dt className="text-muted">Tujuan:</dt>
                      <dd className="font-bold">{order.partner_name}</dd>
                    </div>
                    {order.partner_address ? (
                      <div>
                        <dt className="text-muted">Alamat:</dt>
                        <dd className="break-words text-[10px] text-ink-700">{order.partner_address}</dd>
                      </div>
                    ) : null}
                  </dl>

                  <table className="mt-2.5 w-full table-fixed border-collapse text-left text-[11px]">
                    <thead>
                      <tr className="border-y border-ink-900">
                        <th className="w-[70%] py-1 font-bold">Barang</th>
                        <th className="py-1 text-right font-bold">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shippedItems.map((item) => (
                        <tr key={item.id} className="border-b border-dashed border-line">
                          <td className="break-words py-1.5 pr-1 font-medium">{item.product_name}</td>
                          <td className="py-1.5 text-right tabular-nums font-semibold">
                            {item.qty_approved} {item.product_unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold border-t border-ink-900">
                        <th className="py-1.5">Total</th>
                        <td className="py-1.5 text-right tabular-nums">{total} pcs</td>
                      </tr>
                    </tfoot>
                  </table>

                  <div className="mt-2 flex flex-col items-center gap-1.5 border-t border-ink-900 pt-2.5 text-center">
                    <p className="text-[10px] font-bold">Pindai untuk konfirmasi penerimaan</p>
                    {qr ? (
                      <img src={qr} alt="QR Code verifikasi" className="size-28" />
                    ) : (
                      <p className="py-4 text-[10px] text-muted">Membuat QR...</p>
                    )}
                    <div className="scale-90">
                      {barcodeSvgHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: barcodeSvgHtml }} />
                      ) : (
                        <div className="h-10 w-28 rounded bg-ink-100 animate-pulse" />
                      )}
                    </div>
                  </div>
                  <p className="mt-2 border-t border-dashed border-line pt-1.5 text-center text-[10px] leading-tight text-muted">
                    Masukkan struk ini ke paket. Mitra memindai kode saat barang diterima.
                  </p>
                </article>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-white p-4 sm:flex-row sm:justify-end sm:p-5">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="min-h-11 rounded-md border border-line bg-white px-5 text-sm font-semibold text-ink-800 hover:bg-paper cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!qr || Boolean(error)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ume px-6 text-sm font-semibold text-white shadow-xs hover:bg-ume/90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <Printer className="size-4" aria-hidden="true" />
              <span>
                Cetak {printFormat === 'surat_jalan' ? 'Surat Jalan (A4)' : 'Struk Thermal (80mm)'}
              </span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
