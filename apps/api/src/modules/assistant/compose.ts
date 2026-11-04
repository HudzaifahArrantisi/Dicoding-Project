import { getStockStatus, isStale } from "@daisuki/shared";
import type { MitraContext, ModelRecord } from "./context";
import { answerMitraQuestion, isOperationalQuestion, isOutOfScopeQuestion, type MitraAssistantReply, type MitraTour } from "./knowledge";
import type { ModelResult } from "./model";

const number = (value: number) => value.toLocaleString("id-ID");
const followUp = /\b(yang tadi|yang itu)\b|^(berapa|bagaimana|detailnya|lanjut|sekarang|terbaru|mana saja)\s*\??$/i;
export type AssistantIntent = MitraTour | "greeting" | "central_stock" | "top_products" | "top_partners" | "top_regions" | "out_of_scope";
const factualIntents = new Set<AssistantIntent>(["central_stock", "top_products", "top_partners", "top_regions"]);
const tours = new Set<AssistantIntent>(["restock", "stock_report", "delivery", "logs", "profile"]);
const factualPatterns: Array<[AssistantIntent, RegExp]> = [
  ["central_stock", /\b(total stok|stok pusat|stok gudang|gudang pusat|persediaan pusat|ketersediaan pusat)\b/i],
  ["top_products", /\b(produk|barang|makanan|kategori)\b.*\b(laris|laku|terjual|populer|tertinggi)\b|\b(laris|laku|terjual)\b.*\b(produk|barang|kategori)\b/i],
  ["top_partners", /\b(mitra|cabang|toko)\b.*\b(laris|laku|terjual|aktif|tertinggi)\b|\b(laris|laku)\b.*\b(mitra|cabang|toko)\b/i],
  ["top_regions", /\b(daerah|wilayah|kota|zona)\b.*\b(aktif|laris|ramai|rawan|risiko|merah|tertinggi)\b/i],
];

function selectedStocks(message: string, stocks: ModelRecord[]): ModelRecord[] {
  const normalized = message.toLowerCase();
  const aliases: Array<[RegExp, string]> = [
    [/seblak/i, "seblak"], [/basreng/i, "basreng"], [/makaroni/i, "makaroni"], [/keripik|pisang/i, "keripik"],
  ];
  const selected = aliases.find(([pattern]) => pattern.test(normalized));
  return selected ? stocks.filter((stock) => stock.product_name.toLowerCase().includes(selected[1])) : stocks;
}

function stockReply(message: string, context: MitraContext): string {
  const stocks = selectedStocks(message, context.stocks);
  if (!stocks.length) return "Data stok toko belum tersedia. Coba buka tab Stok atau hubungi admin pusat.";
  const central = /\b(pusat|gudang)\b/i.test(message);
  const lines = stocks.map((stock) => central
    ? `${stock.product_name}: stok gudang pusat ${number(stock.central_stock)} pcs.`
    : `${stock.product_name}: sisa stok ${number(stock.current_qty)} pcs (${getStockStatus(stock.current_qty, stock.par_level)}${isStale(stock.updated_at) ? ", laporan lebih dari 24 jam" : ""}).`);
  return `${central ? "Stok gudang pusat saat ini:" : "Stok fisik cabang yang terakhir dilaporkan:"}\n${lines.join("\n")}\nBuffer minimal dipakai untuk peringatan, bukan batas maksimum stok toko. Perbarui laporan jika angka fisik sudah berubah.`;
}

function restockReply(message: string, context: MitraContext, model: ModelResult): string {
  const stocks = selectedStocks(message, context.stocks);
  if (!stocks.length) return "Produk toko belum tersedia untuk dianalisis. Periksa tab Stok atau hubungi admin pusat.";
  const scores = new Map(model.predictions.map((item) => [item.product_id, item]));
  const priority = { urgent_restock: 0, regular_order: 1, normal: 2 } as const;
  const ordered = [...stocks].sort((a, b) =>
    (priority[scores.get(a.product_id)?.label ?? "normal"] - priority[scores.get(b.product_id)?.label ?? "normal"]) || a.product_name.localeCompare(b.product_name));
  const lines = ordered.map((stock) => {
    const prediction = scores.get(stock.product_id);
    const label = prediction?.label === "urgent_restock" ? "prioritas segera" : prediction?.label === "regular_order" ? "pantau dan pesan teratur" : prediction ? "cukup aman saat ini" : "prediksi belum tersedia";
    const dailyUse = stock.sold_7d / 7;
    const suggested = stock.report_count > 0 ? Math.min(stock.central_stock, Math.max(0, Math.ceil(dailyUse * 10) - stock.current_qty)) : null;
    const advice = suggested === null ? "belum cukup laporan konsumsi untuk menghitung saran jumlah" : `saran pengajuan sekitar ${number(suggested)} pcs berdasarkan konsumsi 7 hari dan persediaan 10 hari`;
    return `${stock.product_name}: sisa ${number(stock.current_qty)} pcs, gudang pusat ${number(stock.central_stock)} pcs; ${label}; ${advice}.`;
  });
  const modelNote = model.available ? "Penilaian prioritas berasal dari model daisuki.pkl." : "Model daisuki.pkl sedang tidak tersedia; angka stok dan konsumsi tetap berasal dari data toko.";
  return `${modelNote}\n${lines.join("\n")}\nJumlah akhir boleh disesuaikan dengan kebutuhan toko dan hanya dibatasi stok gudang pusat saat pengajuan.`;
}

function deliveryReply(context: MitraContext): string {
  const shipment = context.orders.find((order) => order.status === "dalam_pengiriman");
  if (shipment) return `Pesanan ${shipment.order_no} sedang Dalam Pengiriman. Setelah dus fisik tiba, buka detail pesanan di Riwayat dan pindai resi. Stok toko baru bertambah sesuai jumlah disetujui ketika verifikasi berhasil dan status menjadi Selesai.`;
  const latest = context.orders[0];
  return latest
    ? `Belum ada pesanan Dalam Pengiriman. Pesanan terbaru ${latest.order_no} berstatus ${latest.status.replaceAll("_", " ")}. Penerimaan dan penambahan stok hanya dapat dilakukan setelah barang dikirim dan resinya diverifikasi.`
    : "Belum ada pesanan cabang. Ajukan restock dari tab Restock/Pesan; tombol pindai resi baru tersedia setelah pesanan Dalam Pengiriman.";
}

function logsReply(context: MitraContext): string {
  const orderLines = context.orders.map((order) => `${order.order_no}: ${order.status.replaceAll("_", " ")}${order.admin_note ? `, catatan admin: ${order.admin_note}` : ""}`).join("\n");
  const logLines = context.logs.map((log) => `${log.product_name}: ${number(log.qty_before)} → ${number(log.qty_after)} pcs (${log.source === "order_received" ? "barang diterima" : log.source === "manual_update" ? "laporan fisik" : "penyesuaian"})`).join("\n");
  return `Pesanan terbaru:\n${orderLines || "Belum ada pesanan."}\nLog stok terbaru:\n${logLines || "Belum ada perubahan stok."}\nBuka Riwayat atau Log untuk rincian dan filter.`;
}

function profileReply(context: MitraContext): string {
  const partner = context.partner;
  if (!partner) return "Profil cabang belum dapat dimuat. Coba buka tab Profil lagi.";
  const region = [partner.village_name, partner.district_name, partner.regency_name, partner.province_name].filter(Boolean).join(", ");
  return `Profil ${partner.name}: PIC ${partner.pic_name || "belum diisi"}; nomor telepon ${partner.pic_phone ? "sudah diisi" : "belum diisi"}; wilayah ${region || "belum lengkap"}. Periksa alamat dan lengkapi wilayah di tab Profil agar tujuan pengiriman jelas.`;
}

function factReply(intent: AssistantIntent, context: MitraContext): string {
  const facts = context.weeklyFacts;
  if (!facts) return "Ringkasan mingguan belum tersedia. Minta admin menjalankan Perbarui Saran di tab AI Insights, lalu coba lagi.";
  const when = new Date(facts.metadata.generated_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
  const stamp = `Data dihitung pada ${when} WIB; stok dan penjualan bisa berubah setelah waktu itu.`;
  if (intent === "central_stock") {
    const lines = facts.central_warehouse.products.map((item) => `${item.name}: ${number(item.central_stock)} pcs.`);
    return `Total stok gudang pusat pada snapshot: ${number(facts.central_warehouse.total_stock_units)} pcs.\n${lines.join("\n")}\n${stamp}`;
  }
  if (intent === "top_products") {
    if (!facts.top_selling_products.length) return `Belum ada konsumsi produk yang tercatat untuk 7 hari ini. ${stamp}`;
    const lines = facts.top_selling_products.map((item) => `${item.rank}. ${item.product_name} (${item.category}): ${number(item.weekly_units)} pcs, ${item.share_pct}%.`);
    const categories = facts.top_selling_categories.map((item) => `${item.category} ${number(item.weekly_units)} pcs`).join(", ");
    return `Produk paling laku dalam 7 hari sebelum snapshot:\n${lines.join("\n")}\nKategori: ${categories || "belum ada"}.\n${stamp}`;
  }
  if (intent === "top_partners") {
    if (!facts.top_performers_partners.length) return `Belum ada konsumsi mitra yang tercatat untuk 7 hari ini. ${stamp}`;
    return `Mitra dengan konsumsi tercatat terbesar dalam 7 hari:\n${facts.top_performers_partners.map((item) => `${item.rank}. ${item.partner_name} (${item.region}): ${number(item.weekly_units)} pcs, ${item.percentage}%.`).join("\n")}\n${stamp}`;
  }
  if (!facts.regional_hotspots.length) return `Analisis wilayah belum memiliki hasil. ${stamp}`;
  return `Wilayah menurut konsumsi tercatat dalam 7 hari:\n${[...facts.regional_hotspots].sort((a, b) => b.weekly_units - a.weekly_units).map((item) => `${item.region}, ${item.province}: ${number(item.weekly_units)} pcs dari ${item.active_partners} mitra, ${item.status.replaceAll("_", " ")}, risiko puncak ${item.stockout_probability}%.`).join("\n")}\n${stamp}`;
}

export function resolveMitraIntent(message: string, previousIntent: AssistantIntent | null, classified?: { label: string; confidence: number } | null): AssistantIntent | null {
  if (isOutOfScopeQuestion(message) || !isOperationalQuestion(message) && !followUp.test(message)) return null;
  const normalized = message.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (/^(hi|hai|halo|helo|hello|pagi|siang|sore|malam|selamat (pagi|siang|sore|malam)|assalamualaikum|permisi)( semua| admin| kak)?$/.test(normalized)) return "greeting";
  for (const [intent, pattern] of factualPatterns) if (pattern.test(normalized)) return intent;
  if (classified?.label === "out_of_scope" && classified.confidence >= 0.35) return null;
  if (classified?.confidence && classified.confidence >= 0.35 &&
    (factualIntents.has(classified.label as AssistantIntent) || tours.has(classified.label as AssistantIntent))) {
    return classified.label as AssistantIntent;
  }
  return answerMitraQuestion(message).suggestedTour ?? (followUp.test(message) ? previousIntent : null);
}

export function composeMitraReply(message: string, context: MitraContext, model: ModelResult, previousIntent: AssistantIntent | null, classified?: { label: string; confidence: number } | null): MitraAssistantReply {
  const base = answerMitraQuestion(message);
  const intent = resolveMitraIntent(message, previousIntent, classified);
  if (!intent) return base;
  if (intent === "greeting") return { ...base, reply: `Halo, ${context.partner?.name ?? "mitra Daisuki"}! Ada yang ingin kamu cek hari ini? Saya bisa bantu stok toko, restock, pengiriman, dan ringkasan jaringan minggu ini.` };
  if (factualIntents.has(intent)) return { reply: factReply(intent, context), quickReplies: ["Stok pusat berapa?", "Produk apa paling laku?", "Mitra paling laris?", "Wilayah mana paling aktif?", "Stok saya sekarang berapa?"] };
  const reply = intent === "stock_report" ? stockReply(message, context)
    : intent === "restock" ? restockReply(message, context, model)
    : intent === "delivery" ? deliveryReply(context)
    : intent === "logs" ? logsReply(context)
    : profileReply(context);
  const withSteps = /\b(bagaimana|gimana|cara|langkah)\b/i.test(message)
    ? `${base.reply}\n\n${reply}`
    : reply;
  const quickReplies = ["Stok saya sekarang berapa?", "Produk mana perlu restock?", "Ada kiriman dalam pengiriman?", "Status pesanan terbaru?", "Bagaimana profil toko saya?"];
  return { ...base, reply: withSteps, suggestedTour: intent as MitraTour, tourLabel: base.tourLabel ?? answerMitraQuestion(intent === "stock_report" ? "lapor stok" : intent === "delivery" ? "scan resi" : intent === "logs" ? "lihat log" : intent === "profile" ? "profil toko" : "restock").tourLabel, quickReplies };
}
