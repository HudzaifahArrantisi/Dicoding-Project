import type { AdminContext } from "./admin-context";
import type { AdminIndexedExcerpt } from "./admin-knowledge";
import type { ModelResult } from "./model";
import { retailPriceReply } from "./retail-price-reply";
import { partnerNameSimilarity } from "./worker-classifier";

export interface AdminAssistantReply {
  reply: string;
  quickReplies: string[];
}

const KNOWN_REGIONS: Array<{ label: string; aliases: string[]; matchPartner: (city: string, name: string) => boolean }> = [
  { label: "Jakarta", aliases: ["jakarta", "dki jakarta", "jaksel", "jakbar", "jaktim", "jakut"], matchPartner: (c, n) => /jakarta|jaksel/i.test(c) || /jakarta|jaksel/i.test(n) },
  { label: "Kota Depok", aliases: ["depok", "kota depok"], matchPartner: (c, n) => /depok/i.test(c) || /depok/i.test(n) },
  { label: "Kota Bandung", aliases: ["bandung", "kota bandung"], matchPartner: (c, n) => /bandung/i.test(c) || /bandung/i.test(n) },
  { label: "Kota Bogor", aliases: ["bogor", "kota bogor", "cijeruk"], matchPartner: (c, n) => /bogor|cijeruk/i.test(c) || /bogor|cijeruk/i.test(n) },
  { label: "Kota Bekasi", aliases: ["bekasi", "kota bekasi"], matchPartner: (c, n) => /bekasi/i.test(c) || /bekasi/i.test(n) },
  { label: "Kota Tangerang", aliases: ["tangerang", "kota tangerang"], matchPartner: (c, n) => (/tangerang/i.test(c) || /tangerang/i.test(n)) && !/selatan/i.test(c) && !/selatan/i.test(n) },
  { label: "Kota Tangerang Selatan", aliases: ["tangerang selatan", "tangsel", "serpong", "bsd"], matchPartner: (c, n) => /tangerang selatan|serpong|bsd/i.test(c) || /tangerang selatan|serpong|bsd/i.test(n) },
  { label: "Kota Denpasar", aliases: ["denpasar", "bali"], matchPartner: (c, n) => /denpasar|bali/i.test(c) || /denpasar/i.test(n) },
  { label: "Kota Balikpapan", aliases: ["balikpapan"], matchPartner: (c, n) => /balikpapan/i.test(c) || /balikpapan/i.test(n) },
  { label: "Kota Surabaya", aliases: ["surabaya"], matchPartner: (c, n) => /surabaya/i.test(c) || /surabaya/i.test(n) },
  { label: "Yogyakarta", aliases: ["yogyakarta", "jogja", "bantul"], matchPartner: (c, n) => /yogyakarta|bantul/i.test(c) || /yogyakarta/i.test(n) },
  { label: "Kota Semarang", aliases: ["semarang"], matchPartner: (c, n) => /semarang/i.test(c) || /semarang/i.test(n) },
  { label: "Kota Solo", aliases: ["solo", "surakarta"], matchPartner: (c, n) => /solo|surakarta/i.test(c) || /solo/i.test(n) },
  { label: "Kota Medan", aliases: ["medan"], matchPartner: (c, n) => /medan/i.test(c) || /medan/i.test(n) },
  { label: "Kota Palembang", aliases: ["palembang"], matchPartner: (c, n) => /palembang/i.test(c) || /palembang/i.test(n) },
  { label: "Kota Makassar", aliases: ["makassar"], matchPartner: (c, n) => /makassar/i.test(c) || /makassar/i.test(n) },
  { label: "Kota Padang", aliases: ["padang"], matchPartner: (c, n) => /padang/i.test(c) || /padang/i.test(n) },
  { label: "Kota Mataram", aliases: ["mataram"], matchPartner: (c, n) => /mataram/i.test(c) || /mataram/i.test(n) },
  { label: "Kabupaten Sidoarjo", aliases: ["sidoarjo"], matchPartner: (c, n) => /sidoarjo/i.test(c) || /sidoarjo/i.test(n) },
  { label: "Kota Cirebon", aliases: ["cirebon"], matchPartner: (c, n) => /cirebon/i.test(c) || /cirebon/i.test(n) },
  { label: "Kota Serang", aliases: ["serang"], matchPartner: (c, n) => /serang/i.test(c) || /serang/i.test(n) },
  { label: "Kota Malang", aliases: ["malang"], matchPartner: (c, n) => /malang/i.test(c) || /malang/i.test(n) },
];

function cleanExcerptText(excerpt: string): string {
  const trimmed = excerpt.trim();
  const jsonMatch = trimmed.match(/^(.*?):\s*(\{.*\}|\[.*\])\s*$/s);
  if (!jsonMatch) return trimmed.replace(/\s*\{[^{}]*"weekly_units"[^{}]*\}\s*$/, "");
  const prefix = jsonMatch[1].trim();
  try {
    const parsed = JSON.parse(jsonMatch[2]) as unknown;
    const formatObj = (obj: Record<string, unknown>) => {
      const parts: string[] = [];
      if (obj.regency_name || obj.province_name) parts.push(`Wilayah: **${[obj.regency_name, obj.province_name].filter(Boolean).join(", ")}**`);
      if (obj.partner_name) parts.push(`Mitra: **${obj.partner_name}**`);
      if (obj.product_name) parts.push(`Produk: **${obj.product_name}**`);
      if (obj.weekly_units !== undefined) parts.push(`Konsumsi: **${Number(obj.weekly_units).toLocaleString("id-ID")} pcs**`);
      if (obj.share_pct !== undefined) parts.push(`Pangsa: **${obj.share_pct}%**`);
      if (obj.log_count !== undefined) parts.push(`Laporan: **${obj.log_count} log**`);
      if (obj.active_partners !== undefined && obj.partner_count !== undefined) {
        parts.push(`Mitra aktif: **${obj.active_partners} dari ${obj.partner_count} mitra**`);
      }
      if (obj.restock_frequency !== undefined) parts.push(`Frekuensi restock: **${obj.restock_frequency} kali**`);
      return parts.join(" · ") || prefix;
    };
    if (Array.isArray(parsed)) {
      const lines = parsed.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object")).map((item) => `• ${formatObj(item)}`);
      return `${prefix}:\n${lines.join("\n")}`;
    }
    if (parsed && typeof parsed === "object") {
      return `${prefix} — ${formatObj(parsed as Record<string, unknown>)}.`;
    }
  } catch {
    // Biarkan teks asli bila bukan JSON valid
  }
  return trimmed;
}

export function composeAdminFallbackReply(
  message: string,
  context: AdminContext,
  model: ModelResult,
  knowledgeExcerpts: AdminIndexedExcerpt[],
): AdminAssistantReply {
  const normalized = message.toLowerCase();
  const priceReply = retailPriceReply(message);
  const quickReplies = [
    "Ringkasan stok pusat & cabang kritis",
    "Daftar pesanan menunggu persetujuan",
    "Analisis model Naive Bayes & risiko wilayah",
    "Jelaskan temuan Karya Ilmiah Hudzaifah",
  ];

  if (priceReply) return { reply: priceReply, quickReplies };

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

  const matchedPartners = context.partners_overview
    .map((p) => ({
      partner: p,
      sim: partnerNameSimilarity(message, p.partner_name),
      totalStock: p.stocks.reduce((sum, s) => sum + s.current_qty, 0),
      totalSold7d: p.stocks.reduce((sum, s) => sum + s.sold_7d, 0),
    }))
    .filter((item) => item.sim >= 0.72)
    .sort((a, b) => b.sim - a.sim);

  if (matchedPartners.length >= 2 && /banding|perbandingan|selisih|\bvs\b/i.test(normalized)) {
    const [first, second] = matchedPartners;
    const diffSold = first.totalSold7d - second.totalSold7d;
    const diffStock = first.totalStock - second.totalStock;
    const soldLeader = diffSold > 0
      ? `**${first.partner.partner_name}** lebih tinggi **${Math.abs(diffSold).toLocaleString("id-ID")} pcs**`
      : diffSold < 0
        ? `**${second.partner.partner_name}** lebih tinggi **${Math.abs(diffSold).toLocaleString("id-ID")} pcs**`
        : "konsumsi 7 hari keduanya sama";
    return {
      reply: `**Perbandingan Realtime Mitra (Database):**\n- **${first.partner.partner_name}** (${first.partner.partner_type}, ${first.partner.city}): Sisa stok **${first.totalStock.toLocaleString("id-ID")} pcs**, konsumsi 7 hari terakhir **${first.totalSold7d.toLocaleString("id-ID")} pcs**.\n- **${second.partner.partner_name}** (${second.partner.partner_type}, ${second.partner.city}): Sisa stok **${second.totalStock.toLocaleString("id-ID")} pcs**, konsumsi 7 hari terakhir **${second.totalSold7d.toLocaleString("id-ID")} pcs**.\n\nSelisih konsumsi 7 hari: ${soldLeader} (selisih sisa stok: **${Math.abs(diffStock).toLocaleString("id-ID")} pcs**).`,
      quickReplies,
    };
  }

  if (matchedPartners.length === 1 && /\b(?:stok|stock|konsumsi|penjualan|terjual|sisa|kondisi)\b/i.test(normalized)) {
    const { partner, totalStock, totalSold7d } = matchedPartners[0];
    const items = partner.stocks.map((s) => `- ${s.product_name}: sisa **${s.current_qty} pcs** (${s.status}, terjual 7 hari: ${s.sold_7d} pcs)`).join("\n");
    return {
      reply: `**Status Realtime ${partner.partner_name}** (${partner.partner_type}, ${partner.city}):\nTotal sisa stok **${totalStock.toLocaleString("id-ID")} pcs** · Konsumsi 7 hari terakhir **${totalSold7d.toLocaleString("id-ID")} pcs**\n${items}`,
      quickReplies,
    };
  }

  const mentionedRegions = KNOWN_REGIONS.filter((region) =>
    region.aliases.some((alias) => new RegExp(`(^|[^a-z0-9])${alias}(?=$|[^a-z0-9])`, "i").test(normalized)),
  );
  if (mentionedRegions.length >= 1) {
    const stats = mentionedRegions.map((region) => {
      const partners = context.partners_overview.filter((p) => region.matchPartner(p.city, p.partner_name));
      const totalStock = partners.reduce((sum, p) => sum + p.stocks.reduce((s, item) => s + item.current_qty, 0), 0);
      const totalSold7d = partners.reduce((sum, p) => sum + p.stocks.reduce((s, item) => s + item.sold_7d, 0), 0);
      const totalLogs7d = partners.reduce((sum, p) => sum + p.stocks.reduce((s, item) => s + (item.logs_7d ?? 0), 0), 0);
      const activeSoldPartners = partners.filter((p) => p.stocks.some((s) => (s.logs_7d ?? s.sold_7d) > 0)).length;
      return { label: region.label, partnerCount: partners.length, activeSoldPartners, totalStock, totalSold7d, totalLogs7d, partners };
    });

    if (stats.length >= 2) {
      const [first, second] = stats;
      const diffLogs = first.totalLogs7d - second.totalLogs7d;
      const diffSold = first.totalSold7d - second.totalSold7d;
      const diffPartners = first.partnerCount - second.partnerCount;
      const logLeaderText = diffLogs > 0
        ? `**${first.label}** memiliki **${Math.abs(diffLogs).toLocaleString("id-ID")} log lebih banyak**`
        : diffLogs < 0
          ? `**${second.label}** memiliki **${Math.abs(diffLogs).toLocaleString("id-ID")} log lebih banyak**`
          : "kedua wilayah memiliki jumlah log yang sama";
      return {
        reply: `**Perbandingan Wilayah ${first.label} vs ${second.label} (7 Hari Terakhir):**\n` +
          `• **${first.label}**: **${first.totalLogs7d.toLocaleString("id-ID")} log** dari **${first.partnerCount} mitra** (${first.activeSoldPartners} mitra aktif melapor), total konsumsi **${first.totalSold7d.toLocaleString("id-ID")} pcs**, sisa stok **${first.totalStock.toLocaleString("id-ID")} pcs**.\n` +
          `• **${second.label}**: **${second.totalLogs7d.toLocaleString("id-ID")} log** dari **${second.partnerCount} mitra** (${second.activeSoldPartners} mitra aktif melapor), total konsumsi **${second.totalSold7d.toLocaleString("id-ID")} pcs**, sisa stok **${second.totalStock.toLocaleString("id-ID")} pcs**.\n\n` +
          `Kesimpulan: ${logLeaderText} dan selisih konsumsi **${Math.abs(diffSold).toLocaleString("id-ID")} pcs** (selisih jumlah mitra: **${Math.abs(diffPartners)} mitra**).`,
        quickReplies,
      };
    }

    const single = stats[0];
    if (single.partnerCount > 0) {
      const topPartners = [...single.partners]
        .map((p) => ({
          name: p.partner_name,
          stock: p.stocks.reduce((s, i) => s + i.current_qty, 0),
          sold: p.stocks.reduce((s, i) => s + i.sold_7d, 0),
          logs: p.stocks.reduce((s, i) => s + (i.logs_7d ?? 0), 0),
        }))
        .sort((a, b) => b.logs - a.logs || b.sold - a.sold)
        .slice(0, 8)
        .map((p) => `• **${p.name}**: **${p.logs} log**, konsumsi 7 hari **${p.sold.toLocaleString("id-ID")} pcs**, sisa stok **${p.stock.toLocaleString("id-ID")} pcs**`);
      return {
        reply: `**Ringkasan Wilayah ${single.label}** (**${single.totalLogs7d.toLocaleString("id-ID")} log** dari **${single.partnerCount} mitra**, total konsumsi 7 hari **${single.totalSold7d.toLocaleString("id-ID")} pcs**, sisa stok **${single.totalStock.toLocaleString("id-ID")} pcs**):\n${topPartners.join("\n")}`,
        quickReplies,
      };
    }
  }

  const privateReference = knowledgeExcerpts.find((item) => item.version === "daisuki.pkl");
  if (privateReference) {
    return {
      reply: `Menurut referensi privat **${privateReference.title}**:\n\n${cleanExcerptText(privateReference.excerpt).slice(0, 1000)}\n\nSumber: ${privateReference.source}`,
      quickReplies,
    };
  }

  if (knowledgeExcerpts.length) {
    const partnerDaily = knowledgeExcerpts.find((item) => item.source.includes("partner_daily_consumption"));
    const reference = partnerDaily ?? knowledgeExcerpts[0];
    return {
      reply: `Menurut dokumen **${reference.title}**:\n\n${cleanExcerptText(reference.excerpt).slice(0, 1000)}\n\nSumber: ${reference.source}`,
      quickReplies,
    };
  }

  // 6. Default / Sapaan
  return {
    reply: `Halo Admin Daisuki Pusat! 👋\n\nBerikut ringkasan operasional realtime jaringan Daisuki saat ini:\n• **Cabang Aktif**: ${context.summary.total_active_partners} mitra\n• **Cabang Kritis**: ${context.summary.critical_branches_count} mitra butuh pasokan\n• **Pesanan Pending**: ${context.summary.pending_orders_count} pesanan menunggu approval\n• **Stok Gudang Pusat**: ${context.summary.total_central_stock.toLocaleString("id-ID")} pcs tersedia\n\nAda informasi operasional, logistik cabang, analisis model, atau dokumen penelitian yang ingin Anda tanyakan?`,
    quickReplies,
  };
}
