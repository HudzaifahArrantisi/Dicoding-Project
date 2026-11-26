import { createHash } from "node:crypto";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db, sql } from "./client";
import { partnerStocks, partners, products, stockLogs, users } from "./schema";

const productSkus = ["DSK-SB-001", "DSK-BR-002", "DSK-MK-003", "DSK-KP-004"];
const apply = process.argv.includes("--apply");
const reset = process.argv.includes("--reset");

function argDate(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${flag} harus berupa tanggal YYYY-MM-DD`);
  return value;
}

const jakartaDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
});
const dateFormatter = jakartaDay;

function shiftDay(ymd: string, delta: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + delta)).toISOString().slice(0, 10);
}

function seedUuid(kind: "partner" | "user", number: number) {
  const hex = createHash("sha1").update(`daisuki-demo-mitra-2026:${kind}:${number}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function dailyUsage(partnerNumber: number, productIndex: number, dayIndex: number) {
  const base = 2 + ((partnerNumber * 17 + productIndex * 11 + dayIndex * 7) % 6);
  const pattern = partnerNumber % 3;
  if (pattern === 0) return dayIndex >= 5 ? base * 2 + 2 : base;
  if (pattern === 1) return dayIndex >= 1 && dayIndex <= 3 ? base * 2 : Math.max(1, base - 1);
  return base + (dayIndex % 3 === 0 ? 1 : 0);
}

function reportedSlot(partnerNumber: number, productIndex: number, dayIndex: number) {
  const coverage = 1 + ((partnerNumber * 11 + dayIndex * (partnerNumber % 5 + 1)
    + Math.floor(partnerNumber / 7)) % 4);
  const firstProduct = (partnerNumber + dayIndex) % productSkus.length;
  return (productIndex - firstProduct + productSkus.length) % productSkus.length < coverage;
}

try {
  const todayWib = jakartaDay.format(new Date());
  const endDay = argDate("--end") ?? shiftDay(todayWib, -1);
  const startDay = argDate("--start") ?? shiftDay(endDay, -6);
  const dayCount = Math.round((Date.parse(`${endDay}T00:00:00Z`) - Date.parse(`${startDay}T00:00:00Z`)) / 86_400_000) + 1;
  if (dayCount < 1) throw new Error("Rentang tanggal tidak valid");
  const startUtc = new Date(`${startDay}T00:00:00+07:00`);
  const endUtc = new Date(`${shiftDay(endDay, 1)}T00:00:00+07:00`);
  const dayLabels = Array.from({ length: dayCount }, (_, index) => shiftDay(startDay, index));

  const partnerIds = Array.from({ length: 100 }, (_, index) => seedUuid("partner", index + 1));
  const userIds = Array.from({ length: 100 }, (_, index) => seedUuid("user", index + 1));
  const [partnerRows, userRows, productRows] = await Promise.all([
    db.select({ id: partners.id }).from(partners)
      .where(and(inArray(partners.id, partnerIds), eq(partners.is_active, true))),
    db.select({ id: users.id, partner_id: users.partner_id }).from(users)
      .where(and(inArray(users.id, userIds), eq(users.role, "mitra"))),
    db.select({ id: products.id, sku: products.sku }).from(products)
      .where(and(inArray(products.sku, productSkus), eq(products.is_active, true))),
  ]);
  if (partnerRows.length !== 100 || userRows.length !== 100 || productRows.length !== 4) {
    throw new Error(`Butuh 100 mitra demo aktif, 100 akun demo, dan 4 produk aktif; ditemukan ${partnerRows.length}, ${userRows.length}, ${productRows.length}.`);
  }

  const partnerIdSet = new Set(partnerRows.map((row) => row.id));
  const userByPartner = new Map(userRows.filter((row) => row.partner_id && partnerIdSet.has(row.partner_id))
    .map((row) => [row.partner_id!, row.id]));
  if (userByPartner.size !== 100) throw new Error("Akun demo tidak seluruhnya terhubung ke 100 mitra seed.");

  productRows.sort((a, b) => productSkus.indexOf(a.sku) - productSkus.indexOf(b.sku));
  const stockRows = await db.select({ partner_id: partnerStocks.partner_id, product_id: partnerStocks.product_id,
    current_qty: partnerStocks.current_qty }).from(partnerStocks)
    .where(and(inArray(partnerStocks.partner_id, partnerIds), inArray(partnerStocks.product_id, productRows.map((row) => row.id))));
  if (stockRows.length !== 400) throw new Error(`Butuh 400 stok mitra-produk untuk membangun urutan log; ditemukan ${stockRows.length}.`);

  const existing = reset ? [] : await db.select({ partner_id: stockLogs.partner_id, product_id: stockLogs.product_id,
    qty_before: stockLogs.qty_before, qty_after: stockLogs.qty_after, created_at: stockLogs.created_at }).from(stockLogs)
    .where(and(inArray(stockLogs.partner_id, partnerIds), eq(stockLogs.source, "manual_update"),
      inArray(stockLogs.product_id, productRows.map((row) => row.id)),
      gte(stockLogs.created_at, startUtc), lt(stockLogs.created_at, endUtc)));
  const existingBySlot = new Map<string, (typeof existing)[number]>();
  for (const row of existing) {
    const day = dateFormatter.format(row.created_at);
    const key = `${row.partner_id}:${row.product_id}:${day}`;
    const firstLog = existingBySlot.get(key);
    if (!firstLog || row.created_at < firstLog.created_at) existingBySlot.set(key, row);
  }

  const stockByKey = new Map(stockRows.map((row) => [`${row.partner_id}:${row.product_id}`, row.current_qty]));
  const logs: Array<{ partner_id: string; product_id: string; qty_before: number; qty_after: number;
    source: "manual_update"; created_by: string; created_at: Date }> = [];
  const perPartnerCount = new Map<string, number>();

  for (let partnerIndex = 0; partnerIndex < 100; partnerIndex += 1) {
    const partnerNumber = partnerIndex + 1;
    const partnerId = seedUuid("partner", partnerNumber);
    const userId = userByPartner.get(partnerId)!;
    for (let productIndex = 0; productIndex < productRows.length; productIndex += 1) {
      const productId = productRows[productIndex]!.id;
      let qtyAfter = stockByKey.get(`${partnerId}:${productId}`)!;
      for (let dayIndex = dayCount - 1; dayIndex >= 0; dayIndex -= 1) {
        const existingLog = existingBySlot.get(`${partnerId}:${productId}:${dayLabels[dayIndex]}`);
        if (existingLog) {
          qtyAfter = existingLog.qty_before;
          continue;
        }
        if (!reportedSlot(partnerNumber, productIndex, dayIndex)) continue;
        const usage = dailyUsage(partnerNumber, productIndex, dayIndex);
        const qtyBefore = qtyAfter + usage;
        const hour = 9 + ((partnerNumber + productIndex + dayIndex) % 8);
        const created_at = new Date(`${dayLabels[dayIndex]}T${String(hour).padStart(2, "0")}:${String((partnerNumber * 7) % 60).padStart(2, "0")}:00+07:00`);
        logs.push({ partner_id: partnerId, product_id: productId, qty_before: qtyBefore,
          qty_after: qtyAfter, source: "manual_update", created_by: userId, created_at });
        perPartnerCount.set(partnerId, (perPartnerCount.get(partnerId) ?? 0) + 1);
        qtyAfter = qtyBefore;
      }
    }
  }

  const counts = [...perPartnerCount.values()];
  const min = counts.length ? Math.min(...counts) : 0;
  const max = counts.length ? Math.max(...counts) : 0;
  const avg = counts.length ? Math.round((counts.reduce((sum, value) => sum + value, 0) / counts.length) * 10) / 10 : 0;
  console.log(`Periode target: ${startDay} s/d ${endDay} WIB (${dayCount} hari).`);
  console.log(`Rencana: ${logs.length} log baru untuk ${perPartnerCount.size} mitra; per mitra min ${min}, max ${max}, rata-rata ${avg}${reset ? " (mode reset)" : ""}.`);
  if (reset) console.log("Mode --reset: seluruh log manual_update demo di rentang ini akan dihapus lalu diisi ulang.");
  if (!apply) {
    console.log("Mode pratinjau: belum ada data ditulis. Tambahkan --apply untuk menyimpan ke database yang dikonfigurasi.");
  } else {
    await db.transaction(async (tx) => {
      if (reset) {
        await tx.delete(stockLogs).where(and(inArray(stockLogs.partner_id, partnerIds),
          eq(stockLogs.source, "manual_update"), gte(stockLogs.created_at, startUtc), lt(stockLogs.created_at, endUtc)));
      }
      if (logs.length > 0) await tx.insert(stockLogs).values(logs);
    });
    console.log(`Selesai: ${logs.length} log sintetis tersimpan untuk akun mitra demo.`);
  }
} finally {
  await sql.end();
}
