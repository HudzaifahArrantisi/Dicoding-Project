import { Elysia, t } from "elysia";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import {
  auditLogs,
  orders,
  orderItems,
  partners,
  products,
  partnerStocks,
  stockLogs,
  notifications,
} from "../../db/schema";
import { getAuthUser } from "../../plugins/auth";
import {
  canTransition,
  isOrderStatus,
  type OrderStatus,
  ORDER_STATUS_LABEL,
} from "@daisuki/shared";
import { publishInventoryChange } from "../../realtime";
import { saveBase64Image } from "../../lib/storage";

class CentralStockConflictError extends Error {}
function canAdminChangeStatus(from: OrderStatus, to: OrderStatus): boolean {
  return (from === "diproses" && to === "ditolak") ||
    (from === "disetujui" && to === "dipacking") ||
    (from === "dipacking" && to === "dalam_pengiriman");
}
class OrderWorkflowError extends Error {
  constructor(
    public readonly status: 403 | 404 | 409 | 422,
    message: string,
  ) {
    super(message);
  }
}

function validReceiptPhoto(value: string): boolean {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const bytes = Buffer.from(match[1], "base64");
  return (
    bytes.length > 0 &&
    bytes.length <= 512_000 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9
  );
}

export const ordersModule = new Elysia({ prefix: "/orders" })
  .get(
    "/",
    async ({ headers, query, set }) => {
      const user = await getAuthUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      let targetPartnerId: string | null = null;
      if (user.role === "mitra") {
        if (!user.partnerId) {
          set.status = 400;
          return { error: "User mitra belum terhubung ke cabang mitra" };
        }
        targetPartnerId = user.partnerId;
      } else if (user.role === "admin") {
        targetPartnerId = query.partner_id || null;
      }

      const orderList = await db
        .select({
          id: orders.id,
          order_no: orders.order_no,
          partner_id: orders.partner_id,
          partner_name: partners.name,
          partner_type: partners.type,
          partner_address: partners.address,
          status: orders.status,
          distribution_scheme: orders.distribution_scheme,
          payment_status: sql<string | null>`case when ${orders.payment_status} = 'belum_lunas' and ${orders.payment_due_date} < now() then 'jatuh_tempo' else ${orders.payment_status}::text end`,
          payment_due_date: orders.payment_due_date,
          total_amount: orders.total_amount,
          note: orders.note,
          admin_note: orders.admin_note,
          rejected_reason: orders.rejected_reason,
          created_at: orders.created_at,
          approved_at: orders.approved_at,
          shipped_at: orders.shipped_at,
          completed_at: orders.completed_at,
          receipt_photo_present: sql<boolean>`${orders.receipt_photo_data_url} is not null`,
          receipt_proof_requested_at: orders.receipt_proof_requested_at,
          delivery_code: orders.delivery_code,
          delivery_qr_token: orders.delivery_qr_token,
          delivery_code_claimed_at: orders.delivery_code_claimed_at,
          cycle_period: orders.cycle_period,
        })
        .from(orders)
        .innerJoin(partners, eq(orders.partner_id, partners.id))
        .where(
          targetPartnerId ? eq(orders.partner_id, targetPartnerId) : undefined,
        )
        .orderBy(desc(orders.created_at));

      if (orderList.length === 0) {
        return { data: [] };
      }

      const orderIds = orderList.map((o) => o.id);
      const items = await db
        .select({
          id: orderItems.id,
          order_id: orderItems.order_id,
          product_id: orderItems.product_id,
          product_name: products.name,
          product_sku: products.sku,
          product_unit: products.unit,
          central_stock: products.central_stock,
          qty_requested: orderItems.qty_requested,
          qty_approved: orderItems.qty_approved,
          qty_reserved: orderItems.qty_reserved,
          partner_current_stock: partnerStocks.current_qty,
          partner_par_level: partnerStocks.par_level,
        })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.product_id, products.id))
        .innerJoin(orders, eq(orderItems.order_id, orders.id))
        .leftJoin(
          partnerStocks,
          and(
            eq(partnerStocks.partner_id, orders.partner_id),
            eq(partnerStocks.product_id, orderItems.product_id),
          ),
        )
        .where(inArray(orderItems.order_id, orderIds));

      const itemsByOrderId = new Map<string, typeof items>();
      for (const item of items) {
        const list = itemsByOrderId.get(item.order_id) || [];
        list.push(item);
        itemsByOrderId.set(item.order_id, list);
      }

      const formatted = orderList.map((ord) => ({
        ...ord,
        delivery_code: user.role === "admin" ? ord.delivery_code : null,
        delivery_qr_token: user.role === "admin" ? ord.delivery_qr_token : null,
        status_label:
          ORDER_STATUS_LABEL[ord.status as OrderStatus] || ord.status,
        items: itemsByOrderId.get(ord.id) || [],
      }));

      return { data: formatted };
    },
    {
      query: t.Object({
        partner_id: t.Optional(t.String()),
      }),
    },
  )
  .get("/finance/summary", async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (user.role !== "admin" && (user.role !== "mitra" || !user.partnerId)) {
      set.status = 403; return { error: "Akses tidak diizinkan" };
    }
    const partnerId = user.role === "mitra" ? user.partnerId : null;
    const [row] = await db.execute<{
      gross_7d: string; gross_30d: string; unpaid_count: number; overdue_count: number; unpaid_amount: string;
    }>(sql`
      SELECT
        COALESCE(SUM(o.total_amount) FILTER (WHERE o.distribution_scheme = 'beli_putus' AND o.completed_at >= now() - interval '7 days'), 0)::text AS gross_7d,
        COALESCE(SUM(o.total_amount) FILTER (WHERE o.distribution_scheme = 'beli_putus' AND o.completed_at >= now() - interval '30 days'), 0)::text AS gross_30d,
        count(*) FILTER (WHERE o.payment_status = 'belum_lunas')::int AS unpaid_count,
        count(*) FILTER (WHERE o.payment_status = 'belum_lunas' AND o.payment_due_date < now())::int AS overdue_count,
        COALESCE(SUM(o.total_amount) FILTER (WHERE o.payment_status = 'belum_lunas'), 0)::text AS unpaid_amount
      FROM orders o WHERE o.status = 'selesai'
        AND (${partnerId}::uuid IS NULL OR o.partner_id = ${partnerId}::uuid)
    `);
    const [consignment] = await db.execute<{ estimate_7d: string; estimate_30d: string }>(sql`
      SELECT
        COALESCE(SUM(greatest(sl.qty_before - sl.qty_after, 0) * pr.b2b_price)
          FILTER (WHERE sl.created_at >= now() - interval '7 days'), 0)::text AS estimate_7d,
        COALESCE(SUM(greatest(sl.qty_before - sl.qty_after, 0) * pr.b2b_price)
          FILTER (WHERE sl.created_at >= now() - interval '30 days'), 0)::text AS estimate_30d
      FROM stock_logs sl
      JOIN partners pa ON pa.id = sl.partner_id AND pa.distribution_scheme = 'konsinyasi'
      JOIN products pr ON pr.id = sl.product_id
      WHERE sl.source = 'manual_update'
        AND (${partnerId}::uuid IS NULL OR sl.partner_id = ${partnerId}::uuid)
    `);
    return { data: { ...row, consignment_estimate_7d: consignment.estimate_7d,
      consignment_estimate_30d: consignment.estimate_30d } };
  })
  .get("/finance/insights", async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (user.role !== "admin") { set.status = 403; return { error: "Hanya admin yang dapat melihat analisis jaringan" }; }
    const deadstock = await db.execute<{
      partner_id: string; partner_name: string; product_name: string; current_qty: number; inactive_days: number;
    }>(sql`
      SELECT ps.partner_id, pa.name AS partner_name, pr.name AS product_name, ps.current_qty,
        floor(extract(epoch FROM (now() - coalesce(m.last_movement, ps.updated_at))) / 86400)::int AS inactive_days
      FROM partner_stocks ps
      JOIN partners pa ON pa.id = ps.partner_id
      JOIN products pr ON pr.id = ps.product_id
      LEFT JOIN LATERAL (
        SELECT max(sl.created_at) AS last_movement FROM stock_logs sl
        WHERE sl.partner_id = ps.partner_id AND sl.product_id = ps.product_id
          AND sl.qty_before <> sl.qty_after
      ) m ON true
      WHERE ps.current_qty > 0 AND coalesce(m.last_movement, ps.updated_at) < now() - interval '30 days'
      ORDER BY inactive_days DESC, ps.current_qty DESC LIMIT 30
    `);
    const audit = await db.execute<{
      partner_id: string; partner_name: string; stale_days: number; large_changes: number; priority_score: number;
    }>(sql`
      SELECT pa.id AS partner_id, pa.name AS partner_name,
        floor(extract(epoch FROM (now() - max(ps.updated_at))) / 86400)::int AS stale_days,
        count(sl.id) FILTER (WHERE sl.created_at >= now() - interval '30 days'
          AND sl.source IN ('manual_update', 'adjustment') AND abs(sl.qty_after - sl.qty_before) > greatest(10, sl.qty_before * 0.5))::int AS large_changes,
        (greatest(0, floor(extract(epoch FROM (now() - max(ps.updated_at))) / 86400) - 7)
          + 3 * count(sl.id) FILTER (WHERE sl.created_at >= now() - interval '30 days'
          AND sl.source IN ('manual_update', 'adjustment') AND abs(sl.qty_after - sl.qty_before) > greatest(10, sl.qty_before * 0.5)))::int AS priority_score
      FROM partners pa JOIN partner_stocks ps ON ps.partner_id = pa.id
      LEFT JOIN stock_logs sl ON sl.partner_id = ps.partner_id AND sl.product_id = ps.product_id
      GROUP BY pa.id, pa.name
      HAVING max(ps.updated_at) < now() - interval '7 days'
        OR count(sl.id) FILTER (WHERE sl.created_at >= now() - interval '30 days'
          AND sl.source IN ('manual_update', 'adjustment') AND abs(sl.qty_after - sl.qty_before) > greatest(10, sl.qty_before * 0.5)) > 0
      ORDER BY priority_score DESC LIMIT 20
    `);
    const factory = await db.execute<{
      product_id: string; product_name: string; central_stock: number; sold_30d: number; forecast_14d: number; suggested_qty: number;
    }>(sql`
      SELECT pr.id AS product_id, pr.name AS product_name, pr.central_stock,
        coalesce(sum(greatest(sl.qty_before - sl.qty_after, 0)) FILTER
          (WHERE sl.source = 'manual_update' AND sl.created_at >= now() - interval '30 days'), 0)::int AS sold_30d,
        ceil(coalesce(sum(greatest(sl.qty_before - sl.qty_after, 0)) FILTER
          (WHERE sl.source = 'manual_update' AND sl.created_at >= now() - interval '30 days'), 0) * 14.0 / 30)::int AS forecast_14d,
        greatest(0, ceil(coalesce(sum(greatest(sl.qty_before - sl.qty_after, 0)) FILTER
          (WHERE sl.source = 'manual_update' AND sl.created_at >= now() - interval '30 days'), 0) * 14.0 / 30) - pr.central_stock)::int AS suggested_qty
      FROM products pr LEFT JOIN stock_logs sl ON sl.product_id = pr.id
      WHERE pr.is_active = true GROUP BY pr.id, pr.name, pr.central_stock
      ORDER BY suggested_qty DESC, pr.name
    `);
    return { data: { deadstock, audit, factory, method: "Estimasi dari penurunan stok fisik 30 hari; perlu verifikasi lapangan sebelum PO." } };
  })
  .patch("/finance/:id/paid", async ({ headers, params, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (user.role !== "admin") { set.status = 403; return { error: "Hanya admin yang dapat mencatat pembayaran" }; }
    const [updated] = await db.update(orders).set({ payment_status: "lunas" })
      .where(and(eq(orders.id, params.id), eq(orders.status, "selesai"), eq(orders.distribution_scheme, "beli_putus"), eq(orders.payment_status, "belum_lunas")))
      .returning({ id: orders.id, partner_id: orders.partner_id });
    if (!updated) { set.status = 409; return { error: "Tagihan tidak ditemukan atau sudah lunas" }; }
    publishInventoryChange({ partnerId: updated.partner_id, topics: ["orders"] });
    return { status: "ok" };
  }, { params: t.Object({ id: t.String({ format: "uuid" }) }) })
  .patch("/finance/partners/:id/scheme", async ({ headers, params, body, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (user.role !== "admin") { set.status = 403; return { error: "Hanya admin yang dapat mengubah skema distribusi" }; }
    const [updated] = await db.update(partners).set({ distribution_scheme: body.distribution_scheme })
      .where(eq(partners.id, params.id)).returning({ id: partners.id });
    if (!updated) { set.status = 404; return { error: "Mitra tidak ditemukan" }; }
    publishInventoryChange({ partnerId: params.id, topics: ["partners"] });
    return { status: "ok" };
  }, {
    params: t.Object({ id: t.String({ format: "uuid" }) }),
    body: t.Object({ distribution_scheme: t.Union([t.Literal("konsinyasi"), t.Literal("beli_putus")]) }),
  })
  .post(
    "/",
    async ({ headers, body, set }) => {
      const user = await getAuthUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      if (user.role !== "mitra") {
        set.status = 403;
        return { error: "Hanya mitra yang dapat mengajukan restock" };
      }

      const partnerId = user.partnerId;
      if (!partnerId) {
        set.status = 400;
        return { error: "Partner ID wajib disertakan" };
      }

      if (!body.items || body.items.length === 0) {
        set.status = 400;
        return { error: "Pesanan harus memiliki minimal 1 item" };
      }

      if (
        new Set(body.items.map((item) => item.product_id)).size !==
        body.items.length
      ) {
        set.status = 422;
        return { error: "Satu produk hanya boleh muncul sekali dalam pesanan" };
      }

      const [partner] = await db
        .select({ name: partners.name, distribution_scheme: partners.distribution_scheme })
        .from(partners)
        .where(eq(partners.id, partnerId))
        .limit(1);

      if (!partner) {
        set.status = 404;
        return { error: "Cabang mitra tidak ditemukan" };
      }

      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
      const uniqueSuffix = crypto.randomUUID().slice(0, 8).toUpperCase();
      const orderNo = `PO-${dateStr}-${uniqueSuffix}`;

      try {
        await db.transaction(async (tx) => {
          const reservedQuantities = new Map<string, number>();
          let hasBackorder = false;
          for (const item of [...body.items].sort((a, b) => a.product_id.localeCompare(b.product_id))) {
            const [product] = await tx.select({ name: products.name, central_stock: products.central_stock, is_active: products.is_active })
              .from(products).where(eq(products.id, item.product_id)).for("update");
            if (!product || !product.is_active) throw new OrderWorkflowError(422, "Produk tidak ditemukan atau tidak aktif");
            if (!body.allow_backorder && product.central_stock < item.qty_requested) {
              throw new OrderWorkflowError(409, `Stok pusat ${product.name} tersisa ${product.central_stock} pcs. Kurangi jumlah pengajuan atau pilih pre-order pabrik.`);
            }
            const reserve = Math.min(product.central_stock, item.qty_requested);
            if (reserve < item.qty_requested) hasBackorder = true;
            if (reserve > 0) await tx.update(products).set({ central_stock: sql`${products.central_stock} - ${reserve}` }).where(eq(products.id, item.product_id));
            reservedQuantities.set(item.product_id, reserve);
          }
          const [ord] = await tx
          .insert(orders)
          .values({
            order_no: orderNo,
            partner_id: partnerId,
            status: hasBackorder ? "ditunda" : "diproses",
            distribution_scheme: partner.distribution_scheme,
            note: body.note || null,
            created_by: user.userId,
          })
          .returning();

        const itemValues = body.items.map((item) => ({
          order_id: ord.id,
          product_id: item.product_id,
          qty_requested: item.qty_requested,
          qty_approved: null,
          qty_reserved: reservedQuantities.get(item.product_id) ?? 0,
        }));

        const insertedItems = await tx
          .insert(orderItems)
          .values(itemValues)
          .returning();

        await tx.insert(notifications).values({
          audience: "admin",
          type: "new_order",
          partner_id: partnerId,
          title: `Mitra ${partner.name} mau restok barang nih`,
          body: hasBackorder
            ? `${partner.name} mengajukan pre-order ${ord.order_no}. Sebagian stok pusat belum tersedia; pesanan menunggu pasokan pabrik.`
            : `${partner.name} mengajukan restock untuk ${body.items.length} jenis produk (${ord.order_no}). Pesanan menunggu persetujuan pusat.`,
        });

        return {
          ...ord,
          status_label: ORDER_STATUS_LABEL[hasBackorder ? "ditunda" : "diproses"],
          items: insertedItems,
        };
        });
      } catch (error) {
        if (error instanceof OrderWorkflowError) { set.status = error.status; return { error: error.message }; }
        throw error;
      }

      publishInventoryChange({
        partnerId,
        topics: ["orders", "metrics", "notifications"],
      });
      publishInventoryChange({ partnerId: null, topics: ["products"] });

      return { status: "ok" };
    },
    {
      body: t.Object({
        note: t.Optional(t.String()),
        allow_backorder: t.Optional(t.Boolean()),
        items: t.Array(
          t.Object({
            product_id: t.String(),
            qty_requested: t.Integer({ minimum: 1, maximum: 2_147_483_647 }),
          }),
        ),
      }),
    },
  )
  .put("/:id", async ({ headers, params, body, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (user.role !== "mitra" || !user.partnerId) { set.status = 403; return { error: "Hanya mitra yang dapat mengedit pesanan" }; }
    if (new Set(body.items.map((item) => item.product_id)).size !== body.items.length) {
      set.status = 422; return { error: "Produk tidak boleh duplikat" };
    }
    try {
      await db.transaction(async (tx) => {
        const [ord] = await tx.select().from(orders).where(eq(orders.id, params.id)).for("update");
        if (!ord) throw new OrderWorkflowError(404, "Pesanan tidak ditemukan");
        if (ord.partner_id !== user.partnerId) throw new OrderWorkflowError(403, "Pesanan bukan milik cabang ini");
        if (ord.status !== "diproses") throw new OrderWorkflowError(409, "Pesanan hanya dapat diedit sebelum disetujui");
        const previousItems = await tx.select({ product_id: orderItems.product_id, qty_reserved: orderItems.qty_reserved }).from(orderItems).where(eq(orderItems.order_id, ord.id));
        const previousByProduct = new Map(previousItems.map((item) => [item.product_id, item.qty_reserved]));
        const requestedByProduct = new Map(body.items.map((item) => [item.product_id, item.qty_requested]));
        const productIds = [...new Set([...previousByProduct.keys(), ...requestedByProduct.keys()])].sort();
        for (const productId of productIds) {
          const [product] = await tx.select({ name: products.name, central_stock: products.central_stock, is_active: products.is_active })
            .from(products).where(eq(products.id, productId)).for("update");
          if (!product || (requestedByProduct.has(productId) && !product.is_active)) throw new OrderWorkflowError(422, "Produk tidak ditemukan atau tidak aktif");
          const delta = (requestedByProduct.get(productId) ?? 0) - (previousByProduct.get(productId) ?? 0);
          if (delta > product.central_stock) throw new OrderWorkflowError(409, `Stok pusat ${product.name} tersisa ${product.central_stock} pcs. Kurangi jumlah pengajuan dan coba lagi.`);
          if (delta !== 0) await tx.update(products).set({ central_stock: sql`${products.central_stock} - ${delta}` }).where(eq(products.id, productId));
        }
        await tx.delete(orderItems).where(eq(orderItems.order_id, ord.id));
        await tx.insert(orderItems).values(body.items.map((item) => ({ order_id: ord.id, product_id: item.product_id, qty_requested: item.qty_requested, qty_reserved: item.qty_requested })));
        await tx.update(orders).set({ note: body.note?.trim() || null }).where(eq(orders.id, ord.id));
        await tx.insert(auditLogs).values({ actor_id: user.userId, action: "order.edit", target_type: "order", target_id: ord.id });
      });
    } catch (error) {
      if (error instanceof OrderWorkflowError) { set.status = error.status; return { error: error.message }; }
      throw error;
    }
    publishInventoryChange({ partnerId: user.partnerId, topics: ["orders", "metrics", "notifications"] });
    publishInventoryChange({ partnerId: null, topics: ["products"] });
    return { status: "ok" };
  }, { body: t.Object({ note: t.Optional(t.String({ maxLength: 1000 })), items: t.Array(t.Object({ product_id: t.String(), qty_requested: t.Integer({ minimum: 1, maximum: 2_147_483_647 }) }), { minItems: 1 }) }) })
  .patch("/:id/cancel", async ({ headers, params, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (user.role !== "mitra" || !user.partnerId) { set.status = 403; return { error: "Hanya mitra yang dapat membatalkan pesanan" }; }
    try {
      await db.transaction(async (tx) => {
        const [candidate] = await tx.select({ status: orders.status, partner_id: orders.partner_id }).from(orders).where(eq(orders.id, params.id));
        if (!candidate) throw new OrderWorkflowError(404, "Pesanan tidak ditemukan");
        if (candidate.partner_id !== user.partnerId) throw new OrderWorkflowError(403, "Pesanan bukan milik cabang ini");
        if (candidate?.status === "ditunda") {
          const pendingItems = await tx.select({ product_id: orderItems.product_id })
            .from(orderItems).where(eq(orderItems.order_id, params.id));
          for (const item of [...pendingItems].sort((a, b) => a.product_id.localeCompare(b.product_id))) {
            await tx.select({ id: products.id }).from(products).where(eq(products.id, item.product_id)).for("update");
          }
        }
        const [ord] = await tx.select().from(orders).where(eq(orders.id, params.id)).for("update");
        if (!ord) throw new OrderWorkflowError(404, "Pesanan tidak ditemukan");
        if (ord.partner_id !== user.partnerId) throw new OrderWorkflowError(403, "Pesanan bukan milik cabang ini");
        if (ord.status !== "diproses" && ord.status !== "ditunda" && ord.status !== "disetujui") throw new OrderWorkflowError(409, "Pesanan sudah dikirim atau selesai");
        const items = await tx.select({ product_id: orderItems.product_id, qty_reserved: orderItems.qty_reserved }).from(orderItems).where(eq(orderItems.order_id, ord.id));
        for (const item of [...items].sort((a, b) => a.product_id.localeCompare(b.product_id))) {
          if (item.qty_reserved === 0) continue;
          await tx.update(products).set({ central_stock: sql`${products.central_stock} + ${item.qty_reserved}` }).where(eq(products.id, item.product_id));
        }
        await tx.update(orderItems).set({ qty_reserved: 0 }).where(eq(orderItems.order_id, ord.id));
        await tx.update(orders).set({ status: "dibatalkan" }).where(eq(orders.id, ord.id));
        await tx.insert(auditLogs).values({ actor_id: user.userId, action: "order.cancel", target_type: "order", target_id: ord.id });
        await tx.insert(notifications).values({ audience: "admin", type: "order_update", partner_id: ord.partner_id, title: `Pesanan ${ord.order_no} dibatalkan`, body: "Mitra membatalkan pesanan sebelum pengiriman." });
      });
    } catch (error) {
      if (error instanceof OrderWorkflowError) { set.status = error.status; return { error: error.message }; }
      throw error;
    }
    publishInventoryChange({ partnerId: user.partnerId, topics: ["orders", "metrics", "notifications"] });
    publishInventoryChange({ partnerId: null, topics: ["products"] });
    return { status: "ok" };
  })
  .post("/:id/verify-delivery", async ({ headers, params, body, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (user.role !== "mitra" || !user.partnerId) { set.status = 403; return { error: "Hanya mitra penerima yang dapat memverifikasi resi" }; }
    try {
      await db.transaction(async (tx) => {
        const [ord] = await tx.select().from(orders).where(eq(orders.id, params.id)).for("update");
        if (!ord) throw new OrderWorkflowError(404, "Pesanan tidak ditemukan");
        if (ord.partner_id !== user.partnerId) throw new OrderWorkflowError(403, "Resi bukan milik cabang ini");
        if (ord.status !== "dalam_pengiriman" || ord.delivery_code_claimed_at) throw new OrderWorkflowError(409, "Resi sudah digunakan atau pesanan belum dikirim");
        const scanned = body.code.trim();
        if (!scanned || (scanned !== ord.delivery_qr_token && scanned.toUpperCase() !== ord.delivery_code)) {
          throw new OrderWorkflowError(422, "Kode resi tidak cocok dengan pesanan ini");
        }
        const items = await tx.select().from(orderItems).where(eq(orderItems.order_id, ord.id));
        for (const item of items) {
          const qty = item.qty_approved;
          if (qty === null) throw new OrderWorkflowError(409, "Kuantitas persetujuan belum tersedia");
          if (qty === 0) continue;
          await tx.insert(partnerStocks).values({ partner_id: ord.partner_id, product_id: item.product_id, current_qty: 0, par_level: Math.max(1, qty) }).onConflictDoNothing();
          const [stock] = await tx.select().from(partnerStocks).where(and(eq(partnerStocks.partner_id, ord.partner_id), eq(partnerStocks.product_id, item.product_id))).for("update");
          if (!stock) throw new OrderWorkflowError(409, "Stok cabang belum tersedia");
          const before = stock.current_qty;
          const after = before + qty;
          await tx.update(partnerStocks).set({ current_qty: after, updated_at: new Date(), updated_by: user.userId }).where(and(eq(partnerStocks.partner_id, ord.partner_id), eq(partnerStocks.product_id, item.product_id)));
          await tx.insert(stockLogs).values({ partner_id: ord.partner_id, product_id: item.product_id, qty_before: before, qty_after: after, source: "order_received", created_by: user.userId });
        }
        const [amount] = await tx.select({ total: sql<string>`coalesce(sum(${orderItems.qty_approved} * ${products.b2b_price}), 0)::text` })
          .from(orderItems).innerJoin(products, eq(orderItems.product_id, products.id))
          .where(eq(orderItems.order_id, ord.id));
        const completedAt = new Date();
        await tx.update(orders).set({
          status: "selesai", completed_at: completedAt, delivery_code_claimed_at: completedAt,
          total_amount: amount?.total ?? "0",
          payment_status: ord.distribution_scheme === "beli_putus" ? "belum_lunas" : null,
          payment_due_date: ord.distribution_scheme === "beli_putus" ? new Date(completedAt.getTime() + 7 * 86_400_000) : null,
        }).where(eq(orders.id, ord.id));
        const [receivingPartner] = await tx
          .select({ name: partners.name })
          .from(partners)
          .where(eq(partners.id, ord.partner_id))
          .limit(1);

        await tx.insert(notifications).values({
          audience: "admin",
          type: "order_received",
          partner_id: ord.partner_id,
          title: `Mitra ${receivingPartner?.name ?? 'mitra'} sudah menerima barang ${ord.order_no}`,
          body: `Mitra memindai resi ${ord.order_no}. Barang telah diterima dan stok cabang telah diperbarui.`,
        });
      });
    } catch (error) {
      if (error instanceof OrderWorkflowError) { set.status = error.status; return { error: error.message }; }
      throw error;
    }
    publishInventoryChange({ partnerId: user.partnerId, topics: ["orders", "stocks", "logs", "metrics", "notifications"] });
    return { status: "ok" };
  }, { body: t.Object({ code: t.String({ minLength: 1, maxLength: 256 }) }) })
  .patch(
    "/:id/approval",
    async ({ headers, params, body, set }) => {
      const user = await getAuthUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      if (user.role !== "admin") {
        set.status = 403;
        return { error: "Hanya admin yang dapat menyetujui pesanan" };
      }

      try {
        const result = await db.transaction(async (tx) => {
          const [ord] = await tx
            .select()
            .from(orders)
            .where(eq(orders.id, params.id))
            .for("update");

          if (!ord) {
            throw new OrderWorkflowError(404, "Pesanan tidak ditemukan");
          }
          if (ord.status !== "diproses" && ord.status !== "disetujui") {
            throw new OrderWorkflowError(
              409,
              "Pesanan hanya dapat disetujui atau direvisi sebelum pengiriman",
            );
          }

          const requestedItems = await tx
            .select({
              product_id: orderItems.product_id,
              product_name: products.name,
              product_unit: products.unit,
              qty_requested: orderItems.qty_requested,
              qty_approved: orderItems.qty_approved,
              qty_reserved: orderItems.qty_reserved,
            })
            .from(orderItems)
            .innerJoin(products, eq(orderItems.product_id, products.id))
            .where(eq(orderItems.order_id, params.id));

          const approvalByProduct = new Map(
            body.items.map((item) => [item.product_id, item.qty_approved]),
          );
          if (
            approvalByProduct.size !== body.items.length ||
            body.items.length !== requestedItems.length
          ) {
            throw new OrderWorkflowError(
              422,
              "Kuantitas persetujuan wajib diisi satu kali untuk setiap item pesanan",
            );
          }

          let totalApproved = 0;
          let hasAdjustment = false;
          const approvalSummary: string[] = [];

          for (const item of requestedItems) {
            const approvedQty = approvalByProduct.get(item.product_id);
            if (approvedQty === undefined) {
              throw new OrderWorkflowError(
                422,
                `Persetujuan ${item.product_name} belum diisi`,
              );
            }
            if (approvedQty > item.qty_requested) {
              throw new OrderWorkflowError(
                422,
                `Jumlah disetujui untuk ${item.product_name} tidak boleh melebihi jumlah yang diminta`,
              );
            }
            totalApproved += approvedQty;
            hasAdjustment ||= approvedQty !== item.qty_requested;
            approvalSummary.push(
              `${item.product_name} ${approvedQty} ${item.product_unit}`,
            );
          }

          if (totalApproved < 1) {
            throw new OrderWorkflowError(
              422,
              "Minimal satu barang harus disetujui",
            );
          }
          const adminNote = body.admin_note?.trim() || null;
          if (hasAdjustment && !adminNote) {
            throw new OrderWorkflowError(
              422,
              "Catatan admin wajib diisi jika jumlah persetujuan disesuaikan",
            );
          }

          for (const item of [...requestedItems].sort((a, b) => a.product_id.localeCompare(b.product_id))) {
            const approvedQty = approvalByProduct.get(item.product_id)!;
            const delta = approvedQty - item.qty_reserved;
            if (delta === 0) continue;
            const [product] = await tx.select({ central_stock: products.central_stock }).from(products).where(eq(products.id, item.product_id)).for("update");
            if (!product || (delta > 0 && product.central_stock < delta)) {
              throw new OrderWorkflowError(409, `Stok pusat ${item.product_name} tidak cukup untuk revisi persetujuan`);
            }
            await tx.update(products).set({ central_stock: sql`${products.central_stock} - ${delta}` }).where(eq(products.id, item.product_id));
          }

          for (const item of body.items) {
            await tx
              .update(orderItems)
              .set({ qty_approved: item.qty_approved, qty_reserved: item.qty_approved })
              .where(
                and(
                  eq(orderItems.order_id, params.id),
                  eq(orderItems.product_id, item.product_id),
                ),
              );
          }

          const isRevision = ord.status === "disetujui";
          const [updatedOrder] = await tx
            .update(orders)
            .set({
              status: "disetujui",
              approved_at: new Date(),
              approved_by: user.userId,
              admin_note: adminNote,
            })
            .where(eq(orders.id, params.id))
            .returning();

          await tx.insert(notifications).values({
            audience: "mitra",
            type: "order_update",
            partner_id: ord.partner_id,
            title: `${isRevision ? "Persetujuan Direvisi" : "Pesanan Disetujui"}: ${ord.order_no}`,
            body: `${approvalSummary.join(", ")}.${adminNote ? ` Catatan admin: ${adminNote}` : ""}`,
          });
          await tx.insert(auditLogs).values({
            actor_id: user.userId, action: isRevision ? "order.approval.revise" : "order.approve",
            target_type: "order", target_id: ord.id,
          });

          return updatedOrder;
        });

        publishInventoryChange({
          partnerId: result.partner_id,
          topics: ["orders", "metrics", "notifications"],
        });
        publishInventoryChange({ partnerId: null, topics: ["products"] });

        return { status: "ok" };
      } catch (error) {
        if (error instanceof OrderWorkflowError) {
          set.status = error.status;
          return { error: error.message };
        }
        throw error;
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        admin_note: t.Optional(t.String({ maxLength: 1000 })),
        items: t.Array(
          t.Object({
            product_id: t.String(),
            qty_approved: t.Integer({ minimum: 0 }),
          }),
          { minItems: 1 },
        ),
      }),
    },
  )
  .get("/:id/receipt-proof", async ({ headers, params, set }) => {
    const user = await getAuthUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    const [ord] = await db
      .select({
        partner_id: orders.partner_id,
        receipt_photo_data_url: orders.receipt_photo_data_url,
      })
      .from(orders)
      .where(eq(orders.id, params.id))
      .limit(1);
    if (!ord) {
      set.status = 404;
      return { error: "Pesanan tidak ditemukan" };
    }
    if (user.role !== "admin" && ord.partner_id !== user.partnerId) {
      set.status = 403;
      return { error: "Tidak memiliki akses ke bukti pesanan ini" };
    }
    return { data: { photo_data_url: ord.receipt_photo_data_url } };
  })
  .patch(
    "/:id/receipt-proof",
    async ({ headers, params, body, set }) => {
      const user = await getAuthUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      if (user.role !== "mitra" || !user.partnerId) {
        set.status = 403;
        return { error: "Hanya mitra yang dapat mengunggah bukti penerimaan" };
      }
      if (!validReceiptPhoto(body.photo_data_url)) {
        set.status = 422;
        return { error: "Bukti harus berupa foto JPEG maksimal 500 KB" };
      }

      const saved = await saveBase64Image(body.photo_data_url, "receipts", `receipt-${params.id}`);
      const photoUrl = saved.path;

      try {
        await db.transaction(async (tx) => {
          const [ord] = await tx
            .select()
            .from(orders)
            .where(eq(orders.id, params.id))
            .for("update");
          if (!ord) throw new OrderWorkflowError(404, "Pesanan tidak ditemukan");
          if (ord.partner_id !== user.partnerId) {
            throw new OrderWorkflowError(403, "Tidak memiliki akses ke pesanan ini");
          }
          if (ord.status !== "selesai") {
            throw new OrderWorkflowError(409, "Bukti susulan hanya untuk barang yang sudah diterima");
          }
          if (ord.receipt_photo_data_url) {
            throw new OrderWorkflowError(409, "Bukti penerimaan sudah tersedia");
          }
          await tx
            .update(orders)
            .set({
              receipt_photo_data_url: photoUrl,
              receipt_proof_requested_at: null,
            })
            .where(eq(orders.id, ord.id));
          await tx.insert(notifications).values({
            audience: "admin",
            type: "receipt_proof_uploaded",
            partner_id: ord.partner_id,
            title: `Bukti penerimaan ${ord.order_no} telah diunggah`,
            body: `Mitra telah mengunggah foto bukti penerimaan untuk ${ord.order_no}.`,
          });
        });
      } catch (error) {
        if (error instanceof OrderWorkflowError) {
          set.status = error.status;
          return { error: error.message };
        }
        throw error;
      }
      publishInventoryChange({ partnerId: user.partnerId, topics: ["orders", "notifications"] });
      return { status: "ok" };
    },
    { body: t.Object({ photo_data_url: t.String({ maxLength: 700_000 }) }) },
  )
  .patch("/:id/request-receipt-proof", async ({ headers, params, set }) => {
    const user = await getAuthUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (user.role !== "admin") {
      set.status = 403;
      return { error: "Hanya admin yang dapat meminta bukti penerimaan" };
    }
    let partnerId: string;
    try {
      partnerId = await db.transaction(async (tx) => {
        const [ord] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, params.id))
          .for("update");
        if (!ord) throw new OrderWorkflowError(404, "Pesanan tidak ditemukan");
        if (ord.status !== "selesai" || ord.receipt_photo_data_url) {
          throw new OrderWorkflowError(409, "Pesanan ini tidak memerlukan bukti susulan");
        }
        if (ord.receipt_proof_requested_at) {
          throw new OrderWorkflowError(409, "Permintaan bukti sudah dikirim ke mitra");
        }
        await tx
          .update(orders)
          .set({ receipt_proof_requested_at: new Date() })
          .where(eq(orders.id, ord.id));
        await tx.insert(notifications).values({
          audience: "mitra",
          type: "receipt_proof_requested",
          partner_id: ord.partner_id,
          title: `Foto bukti penerimaan diperlukan: ${ord.order_no}`,
          body: `Admin pusat meminta foto barang yang sudah diterima untuk pesanan ${ord.order_no}. Buka riwayat pesanan untuk mengunggahnya.`,
        });
        return ord.partner_id;
      });
    } catch (error) {
      if (error instanceof OrderWorkflowError) {
        set.status = error.status;
        return { error: error.message };
      }
      throw error;
    }
    publishInventoryChange({ partnerId, topics: ["orders", "notifications"] });
    return { status: "ok" };
  })
  .patch(
    "/:id/status",
    async ({ headers, params, body, set }) => {
      const user = await getAuthUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const orderId = params.id;
      if (!isOrderStatus(body.status)) {
        set.status = 422;
        return { error: "Status pesanan tidak dikenal" };
      }
      const targetStatus = body.status;

      const [ord] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!ord) {
        set.status = 404;
        return { error: "Pesanan tidak ditemukan" };
      }

      if (user.role === "mitra") {
        if (ord.partner_id !== user.partnerId) {
          set.status = 403;
          return { error: "Tidak memiliki akses ke pesanan cabang lain" };
        }
        set.status = 403;
        return { error: "Gunakan pemindaian resi untuk menerima barang atau endpoint pembatalan untuk membatalkan pesanan" };
      } else {
        const adminTransitionAllowed = canAdminChangeStatus(ord.status, targetStatus);

        if (!adminTransitionAllowed) {
          set.status = 403;
          return {
            error: "Admin tidak diizinkan melakukan transisi status ini",
          };
        }
      }

      if (!canTransition(ord.status as OrderStatus, targetStatus)) {
        set.status = 400;
        return {
          error: `Transisi status tidak valid dari '${ord.status}' ke '${targetStatus}'`,
        };
      }

      if (targetStatus === "ditolak" && !body.rejected_reason?.trim()) {
        set.status = 422;
        return { error: "Alasan penolakan wajib diisi" };
      }
      if (
        body.receipt_photo_data_url !== undefined &&
        (targetStatus !== "selesai" || !validReceiptPhoto(body.receipt_photo_data_url))
      ) {
        set.status = 422;
        return { error: "Bukti penerimaan harus berupa foto JPEG maksimal 500 KB" };
      }

      const transactionStartedAt = performance.now();
      let lockAcquiredAt: number | null = null;
      try {
        await db.transaction(async (tx) => {
          const [lockedOrder] = await tx
            .select()
            .from(orders)
            .where(eq(orders.id, orderId))
            .for("update");
          lockAcquiredAt = performance.now();

          if (!lockedOrder) {
            throw new OrderWorkflowError(404, "Pesanan tidak ditemukan");
          }
          if (lockedOrder.status !== ord.status) {
            throw new OrderWorkflowError(
              409,
              "Status pesanan telah berubah. Muat ulang data lalu coba lagi",
            );
          }

          const updateData: Partial<typeof orders.$inferInsert> = {
            status: targetStatus,
          };

          if (targetStatus === "dalam_pengiriman") {
            const shipmentItems = await tx
              .select({
                product_name: products.name,
                qty_approved: orderItems.qty_approved,
                qty_reserved: orderItems.qty_reserved,
              })
              .from(orderItems)
              .innerJoin(products, eq(orderItems.product_id, products.id))
              .where(eq(orderItems.order_id, orderId));

            for (const item of shipmentItems) {
              if (item.qty_approved === null || item.qty_reserved !== item.qty_approved) {
                throw new CentralStockConflictError(
                  `Reservasi ${item.product_name} belum sesuai dengan persetujuan`,
                );
              }
            }
            updateData.shipped_at = new Date();
            updateData.delivery_code = `DSK-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
            updateData.delivery_qr_token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
          } else if (targetStatus === "selesai") {
            updateData.completed_at = new Date();
            if (body.receipt_photo_data_url) {
              if (body.receipt_photo_data_url.startsWith("data:image/")) {
                const saved = await saveBase64Image(
                  body.receipt_photo_data_url,
                  "receipts",
                  `receipt-${orderId}`,
                );
                updateData.receipt_photo_data_url = saved.path;
              } else {
                updateData.receipt_photo_data_url = body.receipt_photo_data_url;
              }
            } else if (body.receipt_photo_data_url === null) {
              updateData.receipt_photo_data_url = null;
            }
          } else if (targetStatus === "ditolak") {
            const rejectedItems = await tx.select({ product_id: orderItems.product_id, qty_reserved: orderItems.qty_reserved }).from(orderItems).where(eq(orderItems.order_id, orderId));
            for (const item of [...rejectedItems].sort((a, b) => a.product_id.localeCompare(b.product_id))) {
              if (item.qty_reserved === 0) continue;
              await tx.update(products).set({ central_stock: sql`${products.central_stock} + ${item.qty_reserved}` }).where(eq(products.id, item.product_id));
            }
            await tx.update(orderItems).set({ qty_reserved: 0 }).where(eq(orderItems.order_id, orderId));
            updateData.rejected_reason = body.rejected_reason?.trim();
          }

          await tx
            .update(orders)
            .set(updateData)
            .where(eq(orders.id, orderId));

          if (targetStatus === "selesai") {
            const ordItems = await tx
              .select()
              .from(orderItems)
              .where(eq(orderItems.order_id, orderId));

            for (const item of ordItems) {
              const addQty = item.qty_approved ?? 0;

              const [currentStock] = await tx
                .select({
                  current_qty: partnerStocks.current_qty,
                  par_level: partnerStocks.par_level,
                })
                .from(partnerStocks)
                .where(
                  and(
                    eq(partnerStocks.partner_id, ord.partner_id),
                    eq(partnerStocks.product_id, item.product_id),
                  ),
                )
                .for("update");

              if (currentStock) {
                const qtyBefore = currentStock.current_qty;
                const qtyAfter = qtyBefore + addQty;

                await tx
                  .update(partnerStocks)
                  .set({
                    current_qty: qtyAfter,
                    updated_at: new Date(),
                    updated_by: user.userId,
                  })
                  .where(
                    and(
                      eq(partnerStocks.partner_id, ord.partner_id),
                      eq(partnerStocks.product_id, item.product_id),
                    ),
                  );

                await tx.insert(stockLogs).values({
                  partner_id: ord.partner_id,
                  product_id: item.product_id,
                  qty_before: qtyBefore,
                  qty_after: qtyAfter,
                  source: "order_received",
                  created_by: user.userId,
                });
              }
            }

            const [receivingPartner] = await tx
              .select({ name: partners.name })
              .from(partners)
              .where(eq(partners.id, ord.partner_id))
              .limit(1);

            const hasReceiptPhoto = Boolean(body.receipt_photo_data_url);
            await tx.insert(notifications).values({
              audience: "admin",
              type: hasReceiptPhoto ? "order_received" : "receipt_missing_proof",
              partner_id: ord.partner_id,
              title: hasReceiptPhoto
                ? `Mitra ${receivingPartner?.name ?? 'mitra'} sudah menerima barang ${ord.order_no}`
                : `Barang ${ord.order_no} diterima tanpa foto bukti`,
              body: hasReceiptPhoto
                ? `Mitra telah mengonfirmasi penerimaan dan mengunggah foto bukti untuk ${ord.order_no}. Stok cabang otomatis bertambah.`
                : `Mitra telah mengonfirmasi penerimaan ${ord.order_no}, tetapi belum menyertakan foto bukti. Admin perlu meminta bukti susulan.`,
            });
          }

          if (user.role === "admin") {
            let notifTitle = `Status Pesanan ${ord.order_no}`;
            let notifBody = `Status pesanan Anda telah diubah menjadi '${ORDER_STATUS_LABEL[targetStatus]}'`;

            if (targetStatus === "dalam_pengiriman") {
              notifTitle = `Pesanan Dikirim: ${ord.order_no}`;
              notifBody = `Barang pesanan Anda sedang dalam pengiriman. Pindai QR atau barcode resi saat paket tiba.`;
            } else if (targetStatus === "ditolak") {
              notifTitle = `Pesanan Ditolak: ${ord.order_no}`;
              notifBody = `Permintaan restock ditolak. Alasan: ${body.rejected_reason?.trim()}`;
            }

            await tx.insert(notifications).values({
              audience: "mitra",
              type: "order_update",
              partner_id: ord.partner_id,
              title: notifTitle,
              body: notifBody,
            });
          }

          await tx.insert(auditLogs).values({
            actor_id: user.userId,
            action: `order.status.${targetStatus}`,
            target_type: "order",
            target_id: ord.id,
          });

        });
      } catch (error) {
        if (
          error instanceof CentralStockConflictError ||
          error instanceof OrderWorkflowError
        ) {
          set.status = error instanceof OrderWorkflowError ? error.status : 409;
          return { error: error.message };
        }
        throw error;
      } finally {
        const elapsed = performance.now() - transactionStartedAt;
        if (elapsed > 5_000) {
          console.warn("[SLOW ORDER STATUS]", {
            orderId,
            targetStatus,
            transactionMs: Math.round(elapsed),
            lockWaitMs: lockAcquiredAt === null ? null : Math.round(lockAcquiredAt - transactionStartedAt),
          });
        }
      }

      publishInventoryChange({
        partnerId: ord.partner_id,
        topics:
          targetStatus === "selesai"
            ? ["orders", "stocks", "logs", "metrics", "notifications"]
            : targetStatus === "dalam_pengiriman"
              ? ["orders", "logs", "metrics", "notifications"]
            : ["orders", "metrics", "notifications"],
      });
      if (targetStatus === "ditolak") {
        publishInventoryChange({ partnerId: null, topics: ["products"] });
      }
      return { status: "ok" };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        status: t.Union([
          t.Literal("diproses"),
          t.Literal("disetujui"),
          t.Literal("dipacking"),
          t.Literal("dalam_pengiriman"),
          t.Literal("selesai"),
          t.Literal("ditolak"),
          t.Literal("dibatalkan"),
        ]),
        rejected_reason: t.Optional(t.String()),
        receipt_photo_data_url: t.Optional(t.String({ maxLength: 700_000 })),
      }),
    },
  );
