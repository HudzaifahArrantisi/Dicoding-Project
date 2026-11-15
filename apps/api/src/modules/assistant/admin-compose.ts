import type { AdminContext } from "./admin-context";
import type { AdminIndexedExcerpt } from "./admin-knowledge";
import type { ModelResult } from "./model";

export interface AdminAssistantReply {
  reply: string;
  quickReplies: string[];
}

export function composeAdminFallbackReply(
  message: string,
  context: AdminContext,
  model: ModelResult,
  knowledgeExcerpts: AdminIndexedExcerpt[],
): AdminAssistantReply {
  const normalized = message.toLowerCase();
  const quickReplies = [
    "Ringkasan stok pusat & cabang kritis",
    "Daftar pesanan menunggu persetujuan",
    "Analisis model Naive Bayes & risiko wilayah",
    "Jelaskan temuan Karya Ilmiah Hudzaifah",
  ];

  // 1. Pertanyaan tentang Karya Ilmiah / Jurnal / Penelitian / NLP / SGD / Hudzaifah
  const isResearchQuery = /\b(?:karya\s*ilmiah|jurnal|penelitian|hudzaifah|rantisi|sgd|logistic|regression|nlp|sentimen|sentiment|mbg|makan\s*bergizi|prabowo|jatisi|akurasi|dataset)\b/i.test(normalized);
  if (isResearchQuery && knowledgeExcerpts.length > 0) {
    const researchExcerpt = knowledgeExcerpts.find((e) =>
      /karya|ilmiah|hudzaifah|jatisi|sgd|logistic|refrensi/i.test(e.source) || /karya|ilmiah|hudzaifah|jatisi|sgd|logistic/i.test(e.title)
    ) ?? knowledgeExcerpts[0];

    return {
      reply: `Berikut informasi dari dokumen pengetahuan sistem (**${researchExcerpt.title}**):\n\n${researchExcerpt.excerpt}\n\n*(Sumber: \`${researchExcerpt.source}\`)*`,
      quickReplies,
    };
  }

  // 2. Pertanyaan tentang Stok Gudang Pusat
  if (/\b(?:stok\s*pusat|gudang\s*pusat|persediaan\s*pusat|ready\s*stock)\b/i.test(normalized)) {
    const lines = context.warehouse.map((w) => `• **${w.name}**: ${w.central_stock.toLocaleString("id-ID")} ${w.unit}`);
    return {
      reply: `**Ketersediaan Stok Gudang Pusat Daisuki Saat Ini:**\n\n${lines.join("\n")}\n\nTotal persediaan di gudang pusat: **${context.summary.total_central_stock.toLocaleString("id-ID")} pcs**.`,
      quickReplies,
    };
  }

  // 3. Pertanyaan tentang Cabang Kritis / Butuh Restock
  if (/\b(?:cabang\s*kritis|stok\s*kritis|kritis|waspada|darurat|kehabisan\s*stok)\b/i.test(normalized)) {
    if (context.critical_branches.length === 0) {
      return {
        reply: `Kabar baik! Saat ini **tidak ada cabang mitra yang berada dalam fase kritis** (seluruh stok cabang berada di atas 20% buffer minimal). Total cabang aktif yang terpantau: **${context.summary.total_active_partners} mitra**.`,
        quickReplies,
      };
    }

    const lines = context.critical_branches.slice(0, 10).map((c) =>
      `• **${c.partner_name}** (${c.city}) — *${c.product_name}*: sisa **${c.current_qty} pcs** (Buffer acuan: ${c.par_level} pcs, Status: ${c.status.toUpperCase()}${c.is_stale ? ", laporan >24 jam" : ""})`
    );

    return {
      reply: `**Peringatan Stok Kritis Mitra Cabang:**\n\nTerdeteksi **${context.summary.critical_branches_count} cabang mitra** dengan produk berstatus kritis (≤ 20% buffer):\n\n${lines.join("\n")}\n\nDisarankan segera memprioritaskan persetujuan restock untuk cabang-cabang di atas.`,
      quickReplies,
    };
  }

  // 4. Pertanyaan tentang Pesanan Menunggu Persetujuan (Pending Orders)
  if (/\b(?:pesanan|pending|menunggu|approval|persetujuan|order\s*masuk)\b/i.test(normalized)) {
    if (context.pending_orders.length === 0) {
      return {
        reply: "Saat ini **tidak ada pesanan baru yang menunggu persetujuan**. Seluruh antrean pesanan sudah diproses.",
        quickReplies,
      };
    }

    const lines = context.pending_orders.slice(0, 8).map((o) => {
      const itemsStr = o.items.map((i) => `${i.product_name} (${i.qty_requested} pcs)`).join(", ");
      return `• **${o.order_no}** — **${o.partner_name}** (${o.partner_city}): ${itemsStr}`;
    });

    return {
      reply: `**Antrean Pesanan Menunggu Persetujuan (${context.pending_orders.length} pesanan):**\n\n${lines.join("\n")}\n\nAnda dapat meninjau dan menyetujui kuantitas pesanan melalui menu **Persetujuan pesanan**.`,
      quickReplies,
    };
  }

  // 5. Pertanyaan tentang Model Machine Learning (daisuki.pkl / Naive Bayes)
  if (/\b(?:model|daisuki\.pkl|machine\s*learning|naive\s*bayes|algoritma|klasifikasi|prediksi)\b/i.test(normalized)) {
    return {
      reply: `**Arsitektur Model Machine Learning Daisuki:**\n\n1. **Model Klasifikasi & Risiko Restock (\`daisuki.pkl\`):**\n   • Algoritma: **Multinomial Naive Bayes**.\n   • Peran: Mengklasifikasi intensi pesan mitra serta menghitung prioritas pasokan restok (\`urgent_restock\`, \`regular_order\`, \`normal\`) untuk 4 produk resmi Daisuki.\n   • Status: ${model.available ? "Aktif & Tersinkronisasi" : "Sedang memuat"}.\n\n2. **Model Analisis Spasial Kehabisan Stok Daerah:**\n   • Algoritma: **Multi-Factor Naive Bayes** (fitur: *days of cover*, *daily velocity*, *sales surge ratio*, *lead time stress*).\n   • Mengelompokkan zona risiko wilayah ke dalam **Zona Merah, Kuning, dan Hijau** untuk perencanaan logistik mingguan.`,
      quickReplies,
    };
  }

  // 6. Default / Sapaan
  return {
    reply: `Halo Admin Daisuki Pusat! 👋\n\nBerikut ringkasan operasional realtime jaringan Daisuki saat ini:\n• **Cabang Aktif**: ${context.summary.total_active_partners} mitra\n• **Cabang Kritis**: ${context.summary.critical_branches_count} mitra butuh pasokan\n• **Pesanan Pending**: ${context.summary.pending_orders_count} pesanan menunggu approval\n• **Stok Gudang Pusat**: ${context.summary.total_central_stock.toLocaleString("id-ID")} pcs tersedia\n\nAda informasi operasional, logistik cabang, analisis model, atau dokumen penelitian yang ingin Anda tanyakan?`,
    quickReplies,
  };
}
