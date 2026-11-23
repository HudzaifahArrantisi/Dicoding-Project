import { createHash } from "node:crypto";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db, sql } from "./client";
import { partnerStocks, partners, products, stockLogs, users } from "./schema";

const productSkus = ["DSK-SB-001", "DSK-BR-002", "DSK-MK-003", "DSK-KP-004"];
const startUtc = new Date("2026-11-15T17:00:00.000Z");
const endUtc = new Date("2026-11-22T17:00:00.000Z");
const apply = process.argv.includes("--apply");

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

try {
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

  const existing = await db.select({ partner_id: stockLogs.partner_id, product_id: stockLogs.product_id,
    qty_before: stockLogs.qty_before, qty_after: stockLogs.qty_after, created_at: stockLogs.created_at }).from(stockLogs)
    .where(and(inArray(stockLogs.partner_id, partnerIds), eq(stockLogs.source, "manual_update"),
      inArray(stockLogs.product_id, productRows.map((row) => row.id)),
      gte(stockLogs.created_at, startUtc), lt(stockLogs.created_at, endUtc)));
  const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
  const existingBySlot = new Map<string, (typeof existing)[number]>();
  for (const row of existing) {
    const day = dateFormatter.format(row.created_at);
    const key = `${row.partner_id}:${row.product_id}:${day}`;
    if (existingBySlot.has(key)) throw new Error("Ada lebih dari satu log manual per produk-mitra-hari; tidak ada data yang diubah.");
    existingBySlot.set(key, row);
  }
  if (existing.length > 0 && existing.length < 2800) {
    const anchorPartners = new Set(existing.map((row) => row.partner_id));
    const onlyTuesdayAnchors = existing.length === 8 && anchorPartners.size === 2 &&
      existing.every((row) => dateFormatter.format(row.created_at) === "2026-11-17") &&
      new Set(existing.map((row) => `${row.partner_id}:${row.product_id}`)).size === 8 &&
      [...anchorPartners].every((partnerId) => productRows.every((product) =>
        existing.some((row) => row.partner_id === partnerId && row.product_id === product.id)));
    if (!onlyTuesdayAnchors) throw new Error(`Ditemukan ${existing.length} log lama pada rentang target dengan pola parsial yang belum aman dilengkapi otomatis; tidak ada data yang diubah.`);
  }
  if (existing.length > 2800) throw new Error("Jumlah log pada rentang target melebihi 2.800; tidak ada data yang diubah.");

  if (existing.length === 2800) {
    console.log("Cakupan 2.800 log untuk 100 mitra x 4 produk x 7 hari sudah lengkap. Tidak ada data ditulis.");
  } else {

  const stockByKey = new Map(stockRows.map((row) => [`${row.partner_id}:${row.product_id}`, row.current_qty]));
  const logs: Array<{ partner_id: string; product_id: string; qty_before: number; qty_after: number;
    source: "manual_update"; created_by: string; created_at: Date }> = [];

  for (let partnerIndex = 0; partnerIndex < 100; partnerIndex += 1) {
    const partnerId = seedUuid("partner", partnerIndex + 1);
    const userId = userByPartner.get(partnerId)!;
    for (let productIndex = 0; productIndex < productRows.length; productIndex += 1) {
      const productId = productRows[productIndex]!.id;
      const keyForDay = (dayIndex: number) => `${partnerId}:${productId}:2026-11-${String(16 + dayIndex).padStart(2, "0")}`;
      let qtyAfter = stockByKey.get(`${partnerId}:${productId}`)!;
      for (let dayIndex = 6; dayIndex >= 0; dayIndex -= 1) {
        if (existingBySlot.has(keyForDay(dayIndex))) continue;
        const usage = dailyUsage(partnerIndex + 1, productIndex, dayIndex);
        const qtyBefore = qtyAfter + usage;
        const date = new Date(Date.UTC(2026, 10, 16 + dayIndex, 2 + ((partnerIndex + productIndex + dayIndex) % 8)));
        logs.push({ partner_id: partnerId, product_id: productId, qty_before: qtyBefore,
          qty_after: qtyAfter, source: "manual_update", created_by: userId, created_at: date });
        qtyAfter = qtyBefore;
      }
    }
  }

    console.log(`Pratinjau: total target 2.800 slot; ${existing.length} log sudah ada dan ${logs.length} log akan ditambahkan.`);
    console.log("Periode: 16-22 November 2026 WIB. Stok partner_stocks tidak diubah; data dibatasi ke 100 akun demo sintetis.");
    if (!apply) {
      console.log("Mode pratinjau: belum ada data ditulis. Tambahkan --apply untuk menyimpan ke database yang dikonfigurasi.");
    } else {
      await db.transaction(async (tx) => { await tx.insert(stockLogs).values(logs); });
      console.log(`Selesai: ${logs.length} log sintetis tersimpan untuk akun mitra demo.`);
    }
  }
} finally {
  await sql.end();
}
