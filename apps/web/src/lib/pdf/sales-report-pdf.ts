import { jsPDF } from 'jspdf'

export interface PdfExportItem {
  product_name: string
  sold_qty?: number
  unit_price?: number
  subtotal?: number
  current_stock?: number
  stock_status?: string
}

export interface PdfExportData {
  title?: string
  file_name?: string
  doc_type?: string
  period?: string
  partner_name?: string
  city?: string
  generated_at?: string
  summary_metrics?: {
    total_units_sold?: number
    total_revenue?: number
    formatted_revenue?: string
    top_product?: string
  }
  items?: PdfExportItem[]
  recommendation?: string
}

function formatRupiah(val?: number): string {
  if (typeof val !== 'number') return '-'
  return `Rp ${val.toLocaleString('id-ID')}`
}

export function generateDaisukiPdf(data: PdfExportData): boolean {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 14
    let y = 16

    // 1. Header Banner
    doc.setFillColor(249, 115, 22) // Primary Orange (#f97316)
    doc.rect(margin, y, pageWidth - margin * 2, 3, 'F')
    y += 8

    // Brand Name
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(24, 24, 27) // ink-900
    doc.text('DAISUKI B2B INVENTORY', margin, y)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(113, 113, 122) // ink-500
    doc.text('Central Kitchen & Multi-Branch Management System', margin, y + 4)

    // Document Type Tag on the right
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(249, 115, 22)
    doc.text('OFFICIAL REPORT', pageWidth - margin - 30, y)

    y += 12
    doc.setDrawColor(228, 228, 231) // border color
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageWidth - margin, y)
    y += 7

    // 2. Document Title & Metadata
    const title = data.title || 'Laporan Rekapitulasi Penjualan & Omset'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(24, 24, 27)
    doc.text(title, margin, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(82, 82, 91)
    const partner = data.partner_name || 'Mitra Cabang'
    const period = data.period || '7 Hari Terakhir'
    const dateStr = data.generated_at || new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })
    const city = data.city ? ` (${data.city})` : ''

    doc.text(`Cabang / Entitas : ${partner}${city}`, margin, y)
    doc.text(`Periode Laporan  : ${period}`, margin, y + 4.5)
    doc.text(`Waktu Cetak       : ${dateStr}`, margin, y + 9)
    y += 15

    // 3. Highlight Cards (Total Sold & Total Revenue)
    const cardWidth = (pageWidth - margin * 2 - 6) / 3
    const cardHeight = 16

    // Card 1: Total Units Sold
    doc.setFillColor(244, 244, 245)
    doc.roundedRect(margin, y, cardWidth, cardHeight, 2, 2, 'F')
    doc.setFontSize(7.5)
    doc.setTextColor(113, 113, 122)
    doc.text('TOTAL TERJUAL', margin + 3, y + 5)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(24, 24, 27)
    const totalSold = data.summary_metrics?.total_units_sold ?? data.items?.reduce((s, i) => s + (i.sold_qty || 0), 0) ?? 0
    doc.text(`${totalSold.toLocaleString('id-ID')} pcs`, margin + 3, y + 12)

    // Card 2: Total Revenue
    doc.setFillColor(254, 242, 242) // light red/orange tint
    doc.roundedRect(margin + cardWidth + 3, y, cardWidth, cardHeight, 2, 2, 'F')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(234, 88, 12)
    doc.text('ESTIMASI TOTAL OMSET', margin + cardWidth + 6, y + 5)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(194, 65, 12)
    const totalRev = data.summary_metrics?.formatted_revenue || formatRupiah(data.summary_metrics?.total_revenue ?? data.items?.reduce((s, i) => s + (i.subtotal || 0), 0))
    doc.text(totalRev, margin + cardWidth + 6, y + 12)

    // Card 3: Top Product
    doc.setFillColor(244, 244, 245)
    doc.roundedRect(margin + (cardWidth + 3) * 2, y, cardWidth, cardHeight, 2, 2, 'F')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(113, 113, 122)
    doc.text('PRODUK TERLARIS', margin + (cardWidth + 3) * 2 + 3, y + 5)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(24, 24, 27)
    const topProd = data.summary_metrics?.top_product || (data.items && data.items.length ? [...data.items].sort((a, b) => (b.sold_qty || 0) - (a.sold_qty || 0))[0]?.product_name : '-') || '-'
    doc.text(topProd.slice(0, 18), margin + (cardWidth + 3) * 2 + 3, y + 12)

    y += cardHeight + 8

    // 4. Items Table
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(24, 24, 27)
    doc.text('Rincian Per Produk', margin, y)
    y += 4

    // Table Header
    const colX = [margin, margin + 45, margin + 70, margin + 102, margin + 138, margin + 165]
    doc.setFillColor(24, 24, 27)
    doc.rect(margin, y, pageWidth - margin * 2, 7, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(255, 255, 255)
    doc.text('PRODUK', colX[0] + 3, y + 4.8)
    doc.text('TERJUAL', colX[1], y + 4.8)
    doc.text('HARGA B2B', colX[2], y + 4.8)
    doc.text('SUBTOTAL OMSET', colX[3], y + 4.8)
    doc.text('SISA STOK', colX[4], y + 4.8)
    doc.text('STATUS', colX[5], y + 4.8)
    y += 7

    // Table Rows
    const items = data.items || []
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)

    items.forEach((item, idx) => {
      // Row zebra background
      if (idx % 2 === 0) {
        doc.setFillColor(250, 250, 250)
        doc.rect(margin, y, pageWidth - margin * 2, 7, 'F')
      }
      doc.setDrawColor(240, 240, 240)
      doc.line(margin, y + 7, pageWidth - margin, y + 7)

      doc.setTextColor(24, 24, 27)
      doc.text(item.product_name, colX[0] + 3, y + 4.8)
      doc.text(`${item.sold_qty ?? 0} pcs`, colX[1], y + 4.8)
      doc.text(formatRupiah(item.unit_price ?? 15000), colX[2], y + 4.8)

      doc.setFont('helvetica', 'bold')
      doc.text(formatRupiah(item.subtotal ?? (item.sold_qty || 0) * (item.unit_price || 15000)), colX[3], y + 4.8)
      doc.setFont('helvetica', 'normal')

      doc.text(`${item.current_stock ?? '-'} pcs`, colX[4], y + 4.8)

      // Status color badge text
      const st = (item.stock_status || 'Aman').toLowerCase()
      if (st.includes('kritis')) {
        doc.setTextColor(220, 38, 38)
      } else if (st.includes('waspada')) {
        doc.setTextColor(217, 119, 6)
      } else {
        doc.setTextColor(22, 101, 52)
      }
      doc.text(item.stock_status || 'Aman', colX[5], y + 4.8)

      y += 7
    })

    y += 8

    // 5. Evaluation / Recommendation Box
    if (data.recommendation) {
      doc.setFillColor(254, 252, 232) // light amber tint
      doc.setDrawColor(254, 240, 138)
      doc.roundedRect(margin, y, pageWidth - margin * 2, 18, 2, 2, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(161, 98, 7)
      doc.text('CATATAN & SARAN PASOKAN AI:', margin + 4, y + 5)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(113, 63, 18)
      const splitText = doc.splitTextToSize(data.recommendation, pageWidth - margin * 2 - 8)
      doc.text(splitText, margin + 4, y + 9.5)

      y += 24
    }

    // 6. Signatures / Footer Verification
    const bottomY = Math.max(y + 10, 260)
    doc.setDrawColor(228, 228, 231)
    doc.line(margin, bottomY, pageWidth - margin, bottomY)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(161, 161, 170)
    doc.text('Dokumen ini digenerate secara otomatis oleh Daisuki AI Assistant & terverifikasi oleh PostgreSQL Neon DB.', margin, bottomY + 5)
    doc.text('PT Daisuki Berkah Pangan Nusantara • Sistem Manajemen Rantai Pasok B2B', margin, bottomY + 9)
    doc.text(`ID: ${Date.now().toString(36).toUpperCase()}`, pageWidth - margin - 22, bottomY + 5)

    // Save PDF file
    const cleanFileName = (data.file_name || `Laporan_Daisuki_${Date.now()}.pdf`).replace(/[^\w.-]/g, '_')
    doc.save(cleanFileName)
    return true
  } catch (err) {
    console.error('[PDF GENERATION ERROR]', err)
    return false
  }
}
