import { sql } from "../../db/client";
import { partnerNameSimilarity } from "./worker-classifier";

const months = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
const monthPattern = "januari|jan|februari|feb|maret|mar|april|apr|mei|juni|jun|juli|jul|agustus|agu|september|sep|oktober|okt|november|nov|desember|des";

export function requestedHistoricalDays(message: string, now = new Date()): string[] {
  const found = new Set<string>();
  for (const match of message.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) found.add(match[0]);
  const wibYear = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric" }).format(now));
  const sharedMonth = new RegExp(`\\b(\\d{1,2})\\s*(?:dan|&|,|serta)\\s*(\\d{1,2})\\s+(${monthPattern})(?:\\s+(\\d{4}))?\\b`, "g");
  for (const match of message.toLowerCase().matchAll(sharedMonth)) {
    const monthIndex = months.findIndex((month) => month.startsWith(match[3]));
    const prefix = `${match[4] ?? wibYear}-${String(monthIndex + 1).padStart(2, "0")}-`;
    found.add(`${prefix}${match[1].padStart(2, "0")}`);
    found.add(`${prefix}${match[2].padStart(2, "0")}`);
  }
  for (const match of message.toLowerCase().matchAll(new RegExp(`\\b(\\d{1,2})\\s+(${monthPattern})(?:\\s+(\\d{4}))?\\b`, "g"))) {
    const monthIndex = months.findIndex((month) => month.startsWith(match[2]));
    found.add(`${match[3] ?? wibYear}-${String(monthIndex + 1).padStart(2, "0")}-${match[1].padStart(2, "0")}`);
  }
  return [...found].filter((day) => !Number.isNaN(Date.parse(`${day}T00:00:00Z`))).slice(0, 2);
}

function normalizeHourWithMeridiem(rawHour: number, meridiem?: string): number {
  const period = (meridiem ?? "").toLowerCase();
  if (period === "malam" || period === "malem") {
    if (rawHour === 12) return 0;
    if (rawHour >= 6 && rawHour <= 11) return rawHour + 12;
  } else if (period === "siang" || period === "sore") {
    if (rawHour >= 1 && rawHour <= 11) return rawHour + 12;
  } else if (period === "pagi" && rawHour === 12) {
    return 0;
  }
  return rawHour;
}

export interface ExactLogRequest {
  partnerName: string;
  day: string;
  hour: number;
  minute: number;
  wholeHour?: boolean;
  endHour?: number;
}

export function parseExactLogRequest(message: string, now = new Date()): ExactLogRequest | null {
  const days = requestedHistoricalDays(message, now);
  if (days.length !== 1) return null;
  const day = days[0];

  const partnerMatch = message.match(
    new RegExp(
      `\\b(?:mitra|cabang)\\s+(.+?)\\s+(?:(?:inin|ini|itu)\\s+)?(?:(?:pada|di|dari)\\s+)?(?:t+a+n*g+a+[lh]+|tgl|jam|pukul|\\d{1,2}\\s+(?:${monthPattern}))\\b`,
      "i",
    ),
  );
  const partner = partnerMatch?.[1]?.replace(/\s+(?:inin|ini|itu)$/i, "").trim();
  if (!partner) return null;

  const rangeMatch = message.match(
    /\b(?:dari\s+)?(?:jam|pukul)\s+(\d{1,2})(?:[.:](\d{2}))?\s*(pagi|siang|sore|malam|malem)?\s*(?:ke|sampai|s\/d|sd|-)\s*(?:jam|pukul)?\s*(\d{1,2})(?:[.:](\d{2}))?\s*(pagi|siang|sore|malam|malem)?\b/i,
  );
  if (rangeMatch) {
    const startHour = normalizeHourWithMeridiem(Number(rangeMatch[1]), rangeMatch[3]);
    const endHour = normalizeHourWithMeridiem(Number(rangeMatch[4]), rangeMatch[6]);
    if (startHour > 23 || endHour > 23) return null;
    return {
      partnerName: partner,
      day,
      hour: Math.min(startHour, endHour),
      minute: 0,
      wholeHour: true,
      endHour: Math.max(startHour, endHour),
    };
  }

  const exactMinute = message.match(/\b(?:jam|pukul)\s+(\d{1,2})[.:](\d{2})(?:\s*WIB)?(?:\s*(pagi|siang|sore|malam|malem))?\b/i);
  if (exactMinute) {
    const hour = normalizeHourWithMeridiem(Number(exactMinute[1]), exactMinute[3]);
    const minute = Number(exactMinute[2]);
    if (hour > 23 || minute > 59) return null;
    return { partnerName: partner, day, hour, minute };
  }

  const wholeHourMatch = message.match(/\b(?:jam|pukul)\s+(\d{1,2})(?:\s*WIB)?(?:\s*(pagi|siang|sore|malam|malem))?\b/i);
  if (wholeHourMatch) {
    const hour = normalizeHourWithMeridiem(Number(wholeHourMatch[1]), wholeHourMatch[2]);
    if (hour > 23) return null;
    return { partnerName: partner, day, hour, minute: 0, wholeHour: true };
  }

  return null;
}

export interface ExactLogResult extends ExactLogRequest {
  partnerFound: boolean;
  partnerType?: string;
  partnerCity?: string;
  partnerProvince?: string;
  logs: Array<{ product_name: string; qty_before: number; qty_after: number; source: string; time_wib: string }>;
}

export async function loadExactStockLogs(request: ExactLogRequest): Promise<ExactLogResult> {
  type PartnerRow = { id: string; name: string; partner_type: string; regency_name: string; province_name: string };
  let [partner] = await sql<PartnerRow[]>`
    SELECT id::text, name, type::text AS partner_type, COALESCE(regency_name, '') AS regency_name, COALESCE(province_name, '') AS province_name
    FROM partners WHERE lower(name) = lower(${request.partnerName}) LIMIT 1
  `;
  if (!partner) {
    const allPartners = await sql<PartnerRow[]>`
      SELECT id::text, name, type::text AS partner_type, COALESCE(regency_name, '') AS regency_name, COALESCE(province_name, '') AS province_name
      FROM partners WHERE is_active = true
    `;
    const best = [...allPartners]
      .map((row) => ({ row, sim: partnerNameSimilarity(request.partnerName, row.name) }))
      .sort((a, b) => b.sim - a.sim)[0];
    if (best && best.sim >= 0.72) {
      partner = best.row;
    }
  }
  if (!partner) return { ...request, partnerFound: false, logs: [] };
  const hour = String(request.hour).padStart(2, "0");
  const minute = String(request.minute).padStart(2, "0");
  const start = new Date(`${request.day}T${hour}:${minute}:00+07:00`);
  const startIso = start.toISOString();
  const durationMs = request.endHour !== undefined
    ? ((request.endHour - request.hour + 1) * 3_600_000)
    : request.wholeHour
      ? 3_600_000
      : 60_000;
  const endIso = new Date(start.getTime() + durationMs).toISOString();
  const rows = await sql<ExactLogResult["logs"]>`
    SELECT pr.name AS product_name, sl.qty_before::int, sl.qty_after::int, sl.source::text,
      to_char(sl.created_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI:SS') AS time_wib
    FROM stock_logs sl JOIN products pr ON pr.id = sl.product_id
    WHERE sl.partner_id = ${partner.id}::uuid AND sl.created_at >= ${startIso}::timestamptz
      AND sl.created_at < ${endIso}::timestamptz AND sl.qty_before > sl.qty_after
      AND pr.name IN ('Seblak Jadul Instan', 'Basreng Daun Jeruk', 'Makaroni Daun Jeruk', 'Keripik Pisang Rasa Coklat')
    ORDER BY sl.created_at, pr.name
  `;
  return {
    ...request,
    partnerName: partner.name,
    partnerFound: true,
    partnerType: partner.partner_type,
    partnerCity: partner.regency_name,
    partnerProvince: partner.province_name,
    logs: [...rows],
  };
}

export function exactStockLogReply(result: ExactLogResult): string {
  const startHour = String(result.hour).padStart(2, "0");
  const startMinute = String(result.minute).padStart(2, "0");
  const timeLabel = result.endHour !== undefined
    ? `rentang pukul ${startHour}:00–${String(result.endHour).padStart(2, "0")}:59 WIB`
    : result.wholeHour
      ? `rentang pukul ${startHour}:00–${startHour}:59 WIB`
      : `pukul ${startHour}:${startMinute} WIB`;
  const label = `${result.day} ${timeLabel}`;
  if (!result.partnerFound) return `Mitra ${result.partnerName} tidak ditemukan di database.`;
  const profileParts = [result.partnerType, result.partnerCity, result.partnerProvince].filter(Boolean);
  const profileText = profileParts.length ? ` (${profileParts.join(", ")})` : "";
  if (!result.logs.length) {
    const scopeWord = result.endHour !== undefined || result.wholeHour ? "rentang jam tersebut" : "menit tersebut";
    return `Tidak ada log penurunan stok yang tercatat untuk ${result.partnerName}${profileText} pada ${label}. Ini tidak membuktikan bahwa tidak ada penjualan; hanya tidak ada catatan pada ${scopeWord}.`;
  }
  const total = result.logs.reduce((sum, row) => sum + row.qty_before - row.qty_after, 0);
  const lines = result.logs.map((row) => `- ${row.product_name}: ${row.qty_before} → ${row.qty_after} pcs (keluar ${row.qty_before - row.qty_after} pcs; ${row.time_wib} WIB; ${row.source})`);
  return `Pada ${label}, tercatat **${result.logs.length} log minus** (total stok keluar **${total.toLocaleString("id-ID")} pcs**) untuk **${result.partnerName}**${profileText}:\n${lines.join("\n")}`;
}

export function historicalPartnerDayReply(message: string, days: HistoricalDay[]): string | null {
  if (days.length !== 1 || !/\b(?:mitra|cabang)\b/i.test(message) || /paling|tertinggi|terbanyak|terbesar/i.test(message)) {
    return null;
  }
  const day = days[0];
  if (!day.partners.length) return null;
  const best = day.partners
    .map((row) => ({ row, sim: partnerNameSimilarity(message, row.name) }))
    .sort((a, b) => b.sim - a.sim)[0];
  if (!best || best.sim < 0.72) return null;
  return `Pada ${day.day} WIB, **${best.row.name}** mencatat **${best.row.log_count} log minus** dengan total stok keluar **${best.row.units.toLocaleString("id-ID")} pcs**.`;
}

export interface HistoricalDay {
  day: string;
  total_units: number;
  log_count: number;
  partners: Array<{ name: string; units: number; log_count: number }>;
}

export async function loadHistoricalConsumption(message: string): Promise<HistoricalDay[]> {
  const dates = requestedHistoricalDays(message);
  return Promise.all(dates.map(async (day) => {
    const start = new Date(`${day}T00:00:00+07:00`);
    const startIso = start.toISOString();
    const endIso = new Date(start.getTime() + 86_400_000).toISOString();
    const rows = await sql<{ name: string; units: number; log_count: number }[]>`
      SELECT pa.name,
        SUM(GREATEST(sl.qty_before - sl.qty_after, 0))::int AS units,
        COUNT(*)::int AS log_count
      FROM stock_logs sl
      JOIN partners pa ON pa.id = sl.partner_id
      JOIN products pr ON pr.id = sl.product_id
      WHERE sl.source = 'manual_update' AND sl.created_at >= ${startIso}::timestamptz AND sl.created_at < ${endIso}::timestamptz
        AND pr.name IN ('Seblak Jadul Instan', 'Basreng Daun Jeruk', 'Makaroni Daun Jeruk', 'Keripik Pisang Rasa Coklat')
      GROUP BY pa.id, pa.name
      ORDER BY units DESC, pa.name
    `;
    const partners = [...rows];
    return { day, total_units: partners.reduce((sum, row) => sum + row.units, 0),
      log_count: partners.reduce((sum, row) => sum + row.log_count, 0), partners };
  }));
}

export function historicalTopReply(message: string, days: HistoricalDay[]): string | null {
  if (days.length !== 1 || !/mitra|cabang/i.test(message) || !/paling|tertinggi|terbanyak|terbesar/i.test(message)
    || !/konsumsi|stok|stock|terjual/i.test(message)) return null;
  const day = days[0];
  if (!day.partners.length) return null;
  const top = day.partners[0];
  const tied = day.partners.filter((row) => row.units === top.units);
  const label = tied.length === 1 ? `**${top.name}**` : tied.map((row) => `**${row.name}**`).join(", ");
  return `Pada ${day.day} WIB, mitra dengan konsumsi stok tertinggi adalah ${label}: **${top.units.toLocaleString("id-ID")} pcs**. Angka ini dihitung dari ${top.log_count} log stok fisik; total jaringan hari itu ${day.total_units.toLocaleString("id-ID")} pcs.`;
}

export function historicalComparisonReply(message: string, days: HistoricalDay[]): string | null {
  if (!/banding|perbandingan|selisih|perubahan|\bvs\b/i.test(message)
    || !/konsumsi|stok|stock|terjual|keluar|penjualan|log/i.test(message)) return null;
  if (days.length === 1) {
    const day = days[0];
    const matched = day.partners
      .map((row) => ({ row, sim: partnerNameSimilarity(message, row.name) }))
      .filter((item) => item.sim >= 0.72)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 2);
    if (matched.length === 2) {
      const [firstPartner, secondPartner] = matched.map((item) => item.row);
      const diff = firstPartner.units - secondPartner.units;
      const leader = diff > 0
        ? `**${firstPartner.name}** lebih tinggi **${Math.abs(diff).toLocaleString("id-ID")} pcs**.`
        : diff < 0
          ? `**${secondPartner.name}** lebih tinggi **${Math.abs(diff).toLocaleString("id-ID")} pcs**.`
          : "Keduanya mencatat jumlah stok keluar yang sama.";
      return `Perbandingan stok keluar pada ${day.day} WIB:\n- **${firstPartner.name}**: **${firstPartner.units.toLocaleString("id-ID")} pcs** (${firstPartner.log_count} log)\n- **${secondPartner.name}**: **${secondPartner.units.toLocaleString("id-ID")} pcs** (${secondPartner.log_count} log)\n${leader}`;
    }
    return null;
  }
  if (days.length !== 2) return null;
  const [first, second] = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const normalizedMessage = message.toLocaleLowerCase("id-ID");
  const partner = [...new Set([...first.partners, ...second.partners].map((row) => row.name))]
    .sort((a, b) => b.length - a.length)
    .find((name) => {
      const escaped = name.toLocaleLowerCase("id-ID").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "u").test(normalizedMessage);
    });
  if (partner) {
    const firstRow = first.partners.find((row) => row.name.toLocaleLowerCase("id-ID") === partner.toLocaleLowerCase("id-ID"));
    const secondRow = second.partners.find((row) => row.name.toLocaleLowerCase("id-ID") === partner.toLocaleLowerCase("id-ID"));
    if (!firstRow || !secondRow) {
      const available = firstRow ?? secondRow;
      const availableDay = firstRow ? first.day : second.day;
      const missingDay = firstRow ? second.day : first.day;
      return `Untuk **${partner}**, ${availableDay} tercatat **${available?.units.toLocaleString("id-ID")} pcs** keluar dari ${available?.log_count} log. Pada ${missingDay} tidak ada log penurunan stok; selisih kedua tanggal belum dapat dihitung dari catatan yang tersedia.`;
    }
    const difference = secondRow.units - firstRow.units;
    const higher = difference > 0 ? second.day : difference < 0 ? first.day : "sama";
    return `Stok keluar **${partner}**: ${first.day} **${firstRow.units.toLocaleString("id-ID")} pcs** (${firstRow.log_count} log), ${second.day} **${secondRow.units.toLocaleString("id-ID")} pcs** (${secondRow.log_count} log). ${higher === "sama" ? "Keduanya sama." : `${higher} lebih tinggi **${Math.abs(difference).toLocaleString("id-ID")} pcs**.`}`;
  }
  if (/\bmitra\b|\bcabang\b/i.test(message) && !/semua|seluruh|jaringan/i.test(message)) return null;
  if (!first.partners.length || !second.partners.length) return null;
  const difference = second.total_units - first.total_units;
  const direction = difference > 0 ? "naik" : difference < 0 ? "turun" : "tetap";
  return `Konsumsi stok seluruh mitra pada ${first.day} adalah **${first.total_units.toLocaleString("id-ID")} pcs**, sedangkan ${second.day} **${second.total_units.toLocaleString("id-ID")} pcs**. Perubahannya ${direction} **${Math.abs(difference).toLocaleString("id-ID")} pcs** berdasarkan log stok fisik.`;
}
