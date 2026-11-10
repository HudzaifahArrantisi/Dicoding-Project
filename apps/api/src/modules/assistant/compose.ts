import { getStockStatus, isStale } from "@daisuki/shared";
import type { MitraContext, ModelRecord } from "./context";
import { answerMitraQuestion, isOperationalQuestion, isOutOfScopeQuestion, type MitraAssistantReply, type MitraTour } from "./knowledge";
import type { ModelResult } from "./model";
import { DAISUKI_AI_IDENTITY_REPLY, isAssistantIdentityQuestion } from "./identity";

const number = (value: number) => value.toLocaleString("id-ID");
const followUp = /\b(yang tadi|yang itu)\b|^(berapa|bagaimana|detailnya|lanjut|sekarang|terbaru|mana saja)\s*\??$/i;
export type AssistantIntent = MitraTour | "greeting" | "central_stock" | "top_products" | "top_partners" | "top_regions" | "identity" | "out_of_scope" | "company" | "sop";
const factualIntents = new Set<AssistantIntent>(["central_stock", "top_products", "top_partners", "top_regions"]);
const tours = new Set<AssistantIntent>(["restock", "stock_report", "delivery", "logs", "profile"]);
const identityPattern = /\b(siapa(?:\s*kah)?\s+(?:kamu|anda|dirimu|ini|nih)|(?:kamu|anda|dirimu)\s+(?:ini\s+)?siapa(?:\s*kah)?|siapa(?:\s*kah)?\s+nama(?:mu|\s+(?:kamu|anda))|nama(?:mu|\s+(?:kamu|anda))\s+siapa(?:\s*kah)?|perkenalkan\s+diri(?:mu)?|kenalan\s+dong|dengan\s+siapa\s+saya\s+bicara|(?:kamu|anda)\s+(?:sistem|robot|bot|ai)\s+apa|apakah\s+(?:kamu|anda)\s+ai|tentang\s+(?:kamu|anda|asisten|bot)|profil\s+(?:ai|asisten|kamu|anda)|apa\s+itu\s+daisuki(?:\.pkl)?|daisuki\.?pkl)\b/i;
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

function factReply(intent: AssistantIntent, context: MitraContext, message: string): string {
  if (intent === "central_stock") {
    if (!context.stocks.length) return "Data stok gudang pusat untuk produk cabang Anda belum tersedia di sistem kami saat ini. Buka tab Restock untuk mengecek kembali.";
    return `Stok gudang pusat untuk produk cabang Anda:\n${context.stocks.map((stock) => `${stock.product_name}: ${number(stock.central_stock)} pcs.`).join("\n")}`;
  }
  if (intent === "top_products") {
    if (/\b(?:jaringan|seluruh|semua|nasional|daisuki)\b/i.test(message) && !/\b(?:cabang|toko)\s+saya\b/i.test(message)) {
      const products = context.weeklyFacts?.top_selling_products ?? [];
      return products.length
        ? `Performa produk Daisuki dari ringkasan jaringan terbaru:\n${products.map((item) => `${item.product_name}: ${number(item.weekly_units)} pcs dalam periode ringkasan.`).join("\n")}`
        : "Ringkasan performa produk jaringan belum tersedia di sistem kami saat ini.";
    }
    const ranked = [...context.stocks].filter((stock) => stock.report_count > 0).sort((a, b) => b.sold_7d - a.sold_7d);
    if (!ranked.length) return "Data konsumsi mingguan cabang Anda belum tersedia di sistem kami saat ini. Isi Laporan Harian untuk mulai mencatat perubahan stok.";
    return `Produk dengan konsumsi tercatat tertinggi di cabang Anda dalam 7 hari:\n${ranked.map((stock) => `${stock.product_name}: ${number(stock.sold_7d)} pcs.`).join("\n")}`;
  }
  if (intent === "top_regions") {
    const regions = context.weeklyFacts?.regional_hotspots.filter((item) => item.active_partners >= 3) ?? [];
    return regions.length
      ? `Tren wilayah agregat dari ringkasan terbaru:\n${regions.map((item) => `${item.region}, ${item.province}: ${number(item.weekly_units)} pcs konsumsi tercatat.`).join("\n")}`
      : "Tren wilayah agregat yang aman untuk ditampilkan belum tersedia di sistem kami saat ini.";
  }
  return "Maaf, saya hanya dapat menampilkan data inventaris cabang Anda sendiri.";
}

export function resolveMitraIntent(message: string, previousIntent: AssistantIntent | null, classified?: { label: string; confidence: number } | null): AssistantIntent | null {
  if (isOutOfScopeQuestion(message) || !isOperationalQuestion(message) && !followUp.test(message)) return null;
  const normalized = message.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (isAssistantIdentityQuestion(message) || identityPattern.test(message) || identityPattern.test(normalized)) return "identity";
  if (/^(hi|hai|halo|helo|hello|pagi|siang|sore|malam|selamat (pagi|siang|sore|malam)|assalamualaikum|permisi)( semua| admin| kak)?$/.test(normalized)) return "greeting";
  for (const [intent, pattern] of factualPatterns) if (pattern.test(normalized)) return intent;
  if (classified?.label === "out_of_scope" && classified.confidence >= 0.35) return null;
  if (classified?.label === "identity" && classified.confidence >= 0.35) return "identity";
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
  if (intent === "identity") {
    return {
      ...base,
      reply: isAssistantIdentityQuestion(message) ? DAISUKI_AI_IDENTITY_REPLY : base.reply,
      quickReplies: ["Stok saya sekarang berapa?", "Produk mana perlu restock?", "Stok pusat berapa?", "Produk apa paling laku?"],
    };
  }
  if (intent === "greeting") return { ...base, reply: `Halo, ${context.partner?.name ?? "mitra Daisuki"}! Ada yang ingin kamu cek hari ini? Saya bisa bantu stok toko, restock, pengiriman, dan konsumsi cabang Anda.` };
  if (factualIntents.has(intent)) return { reply: factReply(intent, context, message), quickReplies: ["Stok pusat berapa?", "Produk apa paling laku di cabang saya?", "Stok saya sekarang berapa?"] };
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
