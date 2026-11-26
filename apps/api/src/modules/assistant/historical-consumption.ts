import { sql } from "../../db/client";

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

export interface ExactLogRequest { partnerName: string; day: string; hour: number; minute: number }

export function parseExactLogRequest(message: string, now = new Date()): ExactLogRequest | null {
  const partner = message.match(/\b(?:mitra|cabang)\s+(.+?)\s+(?:pada\s+)?(?:tanggal|tgl)\b/i)?.[1]?.trim();
  const time = message.match(/\b(?:jam|pukul)\s+(\d{1,2})[.:](\d{2})(?:\s*WIB)?\b/i);
  const day = requestedHistoricalDays(message, now)[0];
  if (!partner || !time || !day) return null;
  const hour = Number(time[1]);
  const minute = Number(time[2]);
  if (hour > 23 || minute > 59) return null;
  return { partnerName: partner, day, hour, minute };
}

export interface ExactLogResult extends ExactLogRequest {
  partnerFound: boolean;
  logs: Array<{ product_name: string; qty_before: number; qty_after: number; source: string; time_wib: string }>;
}

export async function loadExactStockLogs(request: ExactLogRequest): Promise<ExactLogResult> {
  const [partner] = await sql<{ id: string }[]>`SELECT id::text FROM partners WHERE lower(name) = lower(${request.partnerName}) LIMIT 1`;
  if (!partner) return { ...request, partnerFound: false, logs: [] };
  const hour = String(request.hour).padStart(2, "0");
  const minute = String(request.minute).padStart(2, "0");
  const start = new Date(`${request.day}T${hour}:${minute}:00+07:00`);
  const startIso = start.toISOString();
  const endIso = new Date(start.getTime() + 60_000).toISOString();
  const rows = await sql<ExactLogResult["logs"]>`
    SELECT pr.name AS product_name, sl.qty_before::int, sl.qty_after::int, sl.source::text,
      to_char(sl.created_at AT TIME ZONE 'Asia/Jakarta', 'HH24:MI:SS') AS time_wib
    FROM stock_logs sl JOIN products pr ON pr.id = sl.product_id
    WHERE sl.partner_id = ${partner.id}::uuid AND sl.created_at >= ${startIso}::timestamptz
      AND sl.created_at < ${endIso}::timestamptz AND sl.qty_before > sl.qty_after
      AND pr.name IN ('Seblak Jadul Instan', 'Basreng Daun Jeruk', 'Makaroni Daun Jeruk', 'Keripik Pisang Rasa Coklat')
    ORDER BY sl.created_at, pr.name
  `;
  return { ...request, partnerFound: true, logs: [...rows] };
}

export function exactStockLogReply(result: ExactLogResult): string {
  const time = `${String(result.hour).padStart(2, "0")}:${String(result.minute).padStart(2, "0")}`;
  const label = `${result.day} pukul ${time} WIB`;
  if (!result.partnerFound) return `Mitra ${result.partnerName} tidak ditemukan di database.`;
  if (!result.logs.length) return `Tidak ada log penurunan stok yang tercatat untuk ${result.partnerName} pada ${label}. Ini tidak membuktikan bahwa tidak ada penjualan; hanya tidak ada catatan pada menit tersebut.`;
  const total = result.logs.reduce((sum, row) => sum + row.qty_before - row.qty_after, 0);
  const lines = result.logs.map((row) => `- ${row.product_name}: ${row.qty_before} → ${row.qty_after} pcs (keluar ${row.qty_before - row.qty_after} pcs; ${row.time_wib} WIB; ${row.source})`);
  return `Pada ${label}, stok keluar yang tercatat untuk **${result.partnerName}** berjumlah **${total.toLocaleString("id-ID")} pcs** dari ${result.logs.length} log:\n${lines.join("\n")}`;
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
  if (days.length !== 2 || !/banding|perbandingan|selisih|perubahan/i.test(message)
    || !/konsumsi|stok|stock|terjual|keluar/i.test(message)) return null;
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
