import { Elysia, t } from "elysia";
import { desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db, sql as postgres } from "../../db/client";
import {
  auditLogs,
  orders,
  orderItems,
  partners,
  partnerStocks,
  products,
  restockRecommendations,
  stockLogs,
  users,
} from "../../db/schema";
import { getAuthUser } from "../../plugins/auth";
import { resolveRegion, RegionError } from "../regions";
import { publishInventoryChange } from "../../realtime";

export const adminModule = new Elysia({ prefix: "/admin" })
  .get("/metrics", async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (user.role !== "admin") {
      set.status = 403;
      return { error: "Forbidden: Admin only" };
    }

    const [branchCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(partners)
      .where(eq(partners.is_active, true));

    const [pendingOrders] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.status, "diproses"));

    const criticalRows = await db.execute(sql`
      SELECT DISTINCT partner_id
      FROM partner_stocks
      WHERE par_level > 0 AND (current_qty::float / NULLIF(par_level, 0)::float) < 0.20
    `);

    const criticalItems = await db.execute(sql<{ count: number }>`
      SELECT count(*)::int as count
      FROM partner_stocks
      WHERE par_level > 0 AND (current_qty::float / NULLIF(par_level, 0)::float) < 0.20
    `);

    return {
      totalBranches: branchCount?.count ?? 0,
      criticalBranches: criticalRows.length,
      pendingOrders: pendingOrders?.count ?? 0,
      criticalItemsCount: Number(criticalItems[0]?.count ?? 0),
    };
  })
  .get(
    "/shipment-logs",
    async ({ headers, query, set }) => {
      const user = await getAuthUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      if (user.role !== "admin") {
        set.status = 403;
        return { error: "Forbidden: Admin only" };
      }

      const page = Math.max(1, Math.min(10_000, Math.floor(Number(query.page) || 1)));
      const pageSize = 20;
      const [totalRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(orders)
        .where(isNotNull(orders.shipped_at));
      const rows = await db
        .select({
          id: orders.id,
          order_no: orders.order_no,
          partner_name: partners.name,
          status: orders.status,
          shipped_at: orders.shipped_at,
        })
        .from(orders)
        .innerJoin(partners, eq(orders.partner_id, partners.id))
        .where(isNotNull(orders.shipped_at))
        .orderBy(desc(orders.shipped_at), desc(orders.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const items = rows.length
        ? await db
            .select({
              order_id: orderItems.order_id,
              product_name: products.name,
              product_unit: products.unit,
              qty_approved: orderItems.qty_approved,
            })
            .from(orderItems)
            .innerJoin(products, eq(orderItems.product_id, products.id))
            .where(inArray(orderItems.order_id, rows.map((row) => row.id)))
        : [];
      const itemsByOrder = new Map<string, typeof items>();
      for (const item of items) {
        const group = itemsByOrder.get(item.order_id) ?? [];
        group.push(item);
        itemsByOrder.set(item.order_id, group);
      }

      return {
        data: rows.map((row) => ({ ...row, items: itemsByOrder.get(row.id) ?? [] })),
        total: totalRow?.count ?? 0,
        page,
        page_size: pageSize,
      };
    },
    { query: t.Object({ page: t.Optional(t.String()) }) },
  )
  .get(
    "/partners",
    async ({ headers, query, set }) => {
      const user = await getAuthUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      if (user.role !== "admin") {
        set.status = 403;
        return { error: "Forbidden: Admin only" };
      }

      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(500, Math.max(1, Number(query.limit) || 200));
      const offset = (page - 1) * limit;
      const search = query.search?.trim() || "";
      const type = query.type?.trim() || "";

      // Ekstrak kondisi search dan type menjadi fragment SQL yang dipakai bersama
      const typeFilterClause =
        type && type !== "all" ? sql`AND p.type = ${type}::partner_type` : sql``;

      const searchFilterClause = search
        ? sql`AND (
            p.name ILIKE ${`%${search}%`} OR
            COALESCE(p.pic_name, '') ILIKE ${`%${search}%`} OR
            COALESCE(p.pic_phone, '') ILIKE ${`%${search}%`} OR
            COALESCE(p.address, '') ILIKE ${`%${search}%`} OR
            COALESCE(p.province_name, '') ILIKE ${`%${search}%`} OR
            COALESCE(p.regency_name, '') ILIKE ${`%${search}%`} OR
            COALESCE(p.district_name, '') ILIKE ${`%${search}%`} OR
            COALESCE(p.village_name, '') ILIKE ${`%${search}%`} OR
            COALESCE(u.username, '') ILIKE ${`%${search}%`} OR
            COALESCE(u.email, '') ILIKE ${`%${search}%`}
          )`
        : sql``;

      // Single SQL round-trip query: LEFT JOIN LATERAL deterministik (ORDER BY created_at, id LIMIT 1) & COUNT(*) OVER() untuk total
      const rows = await db.execute<{
        id: string;
        name: string;
        type: string;
        address: string | null;
        pic_name: string | null;
        pic_phone: string | null;
        province_code: string | null;
        province_name: string | null;
        regency_code: string | null;
        regency_name: string | null;
        district_code: string | null;
        district_name: string | null;
        village_code: string | null;
        village_name: string | null;
        username: string | null;
        total_count: number;
      }>(sql`
        SELECT 
          p.id,
          p.name,
          p.type,
          p.address,
          p.pic_name,
          p.pic_phone,
          p.province_code,
          p.province_name,
          p.regency_code,
          p.regency_name,
          p.district_code,
          p.district_name,
          p.village_code,
          p.village_name,
          COALESCE(u.username, u.email) AS username,
          COUNT(*) OVER()::int AS total_count
        FROM partners p
        LEFT JOIN LATERAL (
          SELECT username, email
          FROM users
          WHERE users.partner_id = p.id
          ORDER BY users.created_at ASC, users.id ASC
          LIMIT 1
        ) u ON true
        WHERE p.is_active = true
          ${typeFilterClause}
          ${searchFilterClause}
        ORDER BY p.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

      let total = rows.length > 0 ? rows[0].total_count : 0;

      // Handle edge case: jika page > totalPages (offset > 0 dan rows kosong), jalankan fallback count dengan kondisi identik
      if (total === 0 && offset > 0) {
        const countRows = await db.execute<{ count: number }>(sql`
          SELECT COUNT(*)::int AS count
          FROM partners p
          LEFT JOIN LATERAL (
            SELECT username, email
            FROM users
            WHERE users.partner_id = p.id
            ORDER BY users.created_at ASC, users.id ASC
            LIMIT 1
          ) u ON true
          WHERE p.is_active = true
            ${typeFilterClause}
            ${searchFilterClause}
        `);
        total = countRows[0]?.count ?? 0;
      }

      const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

      const data = rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        address: row.address,
        pic_name: row.pic_name,
        pic_phone: row.pic_phone,
        province_code: row.province_code,
        province_name: row.province_name,
        regency_code: row.regency_code,
        regency_name: row.regency_name,
        district_code: row.district_code,
        district_name: row.district_name,
        village_code: row.village_code,
        village_name: row.village_name,
        username: row.username,
      }));

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    },
    {
      query: t.Optional(
        t.Object({
          search: t.Optional(t.String()),
          type: t.Optional(t.String()),
          status: t.Optional(t.String()),
          page: t.Optional(t.Union([t.String(), t.Number()])),
          limit: t.Optional(t.Union([t.String(), t.Number()])),
        })
      ),
    }
  )
  .post(
    "/partners",
    async ({ headers, body, set }) => {
      const admin = await getAuthUser(headers);
      if (!admin) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      if (admin.role !== "admin") {
        set.status = 403;
        return { error: "Forbidden: Admin only" };
      }

      const name = body.name.trim();
      const address = body.address.trim();
      const picName = body.pic_name.trim();
      const phone = body.phone.trim();
      const username = body.username.toLowerCase().trim();
      if (!name || !address || !picName || !phone || !/^[a-z0-9._-]{3,40}$/.test(username)) {
        set.status = 422;
        return { error: "Lengkapi data mitra dan gunakan username 3–40 karakter (huruf kecil, angka, titik, garis bawah, atau tanda hubung)" };
      }

      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
      if (existing) {
        set.status = 409;
        return { error: "Username sudah digunakan" };
      }

      let region;
      try {
        region = await resolveRegion({
          province_code: body.province_code,
          regency_code: body.regency_code,
          district_code: body.district_code,
          village_code: body.village_code,
        });
      } catch (error) {
        set.status = error instanceof RegionError ? error.status : 503;
        return { error: error instanceof Error ? error.message : "Wilayah belum dapat diperiksa" };
      }
      if (!region.province_code) {
        set.status = 422;
        return { error: "Lengkapi wilayah mitra" };
      }

      const passwordHash = await Bun.password.hash(body.password);
      try {
        const partner = await db.transaction(async (tx) => {
          const [created] = await tx.insert(partners).values({
            name,
            type: body.type,
            address,
            pic_name: picName,
            pic_phone: phone,
            ...region,
          }).returning();
          const accountId = crypto.randomUUID();
          await tx.insert(users).values({
            id: accountId,
            email: `${accountId}@mitra.daisuki.internal`,
            username,
            password_hash: passwordHash,
            role: "mitra",
            partner_id: created.id,
            full_name: picName,
          });
          await tx.insert(auditLogs).values({ actor_id: admin.userId, action: "partner.create", target_type: "partner", target_id: created.id });
          return created;
        });
        set.status = 201;
        publishInventoryChange({
          partnerId: partner.id,
          topics: ["partners", "stocks", "orders", "metrics"],
        });
        return { status: "ok" };
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "23505") {
          set.status = 409;
          return { error: "Username sudah digunakan" };
        }
        throw error;
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2, maxLength: 120 }),
        type: t.Union([t.Literal("hotel"), t.Literal("restoran"), t.Literal("kafe"), t.Literal("minimarket"), t.Literal("lainnya")]),
        address: t.String({ minLength: 5, maxLength: 500 }),
        pic_name: t.String({ minLength: 2, maxLength: 120 }),
        phone: t.String({ minLength: 8, maxLength: 24 }),
        username: t.String({ minLength: 3, maxLength: 40 }),
        password: t.String({ minLength: 8, maxLength: 128 }),
        province_code: t.String({ maxLength: 20 }),
        regency_code: t.String({ maxLength: 20 }),
        district_code: t.String({ maxLength: 20 }),
        village_code: t.String({ maxLength: 20 }),
      }),
    },
  )
  .patch("/partners/:id", async ({ headers, params, body, set }) => {
    const admin = await getAuthUser(headers);
    if (!admin) { set.status = 401; return { error: "Unauthorized" }; }
    if (admin.role !== "admin") { set.status = 403; return { error: "Forbidden: Admin only" }; }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) {
      set.status = 400; return { error: "ID mitra tidak valid" };
    }
    const name = body.name.trim();
    const address = body.address.trim();
    const picName = body.pic_name.trim();
    const phone = body.phone.trim();
    if (name.length < 2 || address.length < 5 || picName.length < 2 || !/^\+?[0-9][0-9 ()-]{7,23}$/.test(phone)) {
      set.status = 422; return { error: "Periksa nama mitra, alamat, PIC, dan nomor telepon" };
    }
    let region;
    try {
      region = await resolveRegion({
        province_code: body.province_code,
        regency_code: body.regency_code,
        district_code: body.district_code,
        village_code: body.village_code,
      });
    } catch (error) {
      set.status = error instanceof RegionError ? error.status : 503;
      return { error: error instanceof Error ? error.message : "Wilayah belum dapat diperiksa" };
    }
    const updated = await db.transaction(async (tx) => {
      const [partner] = await tx.update(partners).set({
        name, type: body.type, address, pic_name: picName, pic_phone: phone, ...region,
      }).where(eq(partners.id, params.id)).returning({ id: partners.id });
      if (!partner) return false;
      await tx.update(users).set({ full_name: picName }).where(eq(users.partner_id, params.id));
      await tx.insert(auditLogs).values({ actor_id: admin.userId, action: "partner.update", target_type: "partner", target_id: params.id });
      return true;
    });
    if (!updated) { set.status = 404; return { error: "Mitra tidak ditemukan" }; }
    publishInventoryChange({
      partnerId: params.id,
      topics: ["partners", "stocks", "orders", "metrics"],
    });
    return { status: "ok" };
  }, {
    body: t.Object({
      name: t.String({ minLength: 2, maxLength: 120 }),
      type: t.Union([t.Literal("hotel"), t.Literal("restoran"), t.Literal("kafe"), t.Literal("minimarket"), t.Literal("lainnya")]),
      address: t.String({ minLength: 5, maxLength: 500 }),
      pic_name: t.String({ minLength: 2, maxLength: 120 }),
      phone: t.String({ minLength: 8, maxLength: 24 }),
      province_code: t.String({ maxLength: 20 }),
      regency_code: t.String({ maxLength: 20 }),
      district_code: t.String({ maxLength: 20 }),
      village_code: t.String({ maxLength: 20 }),
    }),
  })
  .delete("/partners/:id", async ({ headers, params, set }) => {
    const admin = await getAuthUser(headers);
    if (!admin) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (admin.role !== "admin") {
      set.status = 403;
      return { error: "Forbidden: Admin only" };
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) {
      set.status = 400;
      return { error: "ID mitra tidak valid" };
    }
    const deleted = await db.transaction(async (tx) => {
      const [partner] = await tx.select({ id: partners.id }).from(partners).where(eq(partners.id, params.id)).limit(1);
      if (!partner) return false;
      await tx.update(partners).set({ is_active: false }).where(eq(partners.id, params.id));
      await tx.insert(auditLogs).values({ actor_id: admin.userId, action: "partner.deactivate", target_type: "partner", target_id: params.id });
      return true;
    });
    if (!deleted) {
      set.status = 404;
      return { error: "Mitra tidak ditemukan" };
    }
    publishInventoryChange({
      partnerId: params.id,
      topics: ["partners", "stocks", "orders", "metrics"],
    });
    return { status: "ok" };
  })
  .post(
    "/partners/bulk-delete",
    async ({ headers, body, set }) => {
      const admin = await getAuthUser(headers);
      if (!admin) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      if (admin.role !== "admin") {
        set.status = 403;
        return { error: "Forbidden: Admin only" };
      }
      const { ids } = body;
      if (!Array.isArray(ids) || ids.length === 0) {
        set.status = 400;
        return { error: "Pilih minimal 1 mitra untuk dihapus" };
      }
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validIds = ids.filter((id) => uuidRegex.test(id));
      if (validIds.length === 0) {
        set.status = 400;
        return { error: "ID mitra tidak valid" };
      }

      await db.transaction(async (tx) => {
        const deleted = await tx
          .update(partners)
          .set({ is_active: false })
          .where(inArray(partners.id, validIds))
          .returning({ id: partners.id });
        if (deleted.length) {
          await tx.insert(auditLogs).values(deleted.map((partner) => ({
            actor_id: admin.userId, action: "partner.deactivate", target_type: "partner", target_id: partner.id,
          })));
        }
      });

      for (const partnerId of validIds) {
        publishInventoryChange({
          partnerId,
          topics: ["partners", "stocks", "orders", "metrics"],
        });
      }

      return { status: "ok" };
    },
    {
      body: t.Object({
        ids: t.Array(t.String()),
      }),
    },
  )
  .get("/stock-logs", async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (user.role !== "admin") {
      set.status = 403;
      return { error: "Forbidden: Admin only" };
    }

    const rows = await db
      .select({
        id: stockLogs.id,
        partner_name: partners.name,
        product_name: products.name,
        qty_before: stockLogs.qty_before,
        qty_after: stockLogs.qty_after,
        delta: sql<number>`${stockLogs.qty_before} - ${stockLogs.qty_after}`,
        source: stockLogs.source,
        created_at: stockLogs.created_at,
      })
      .from(stockLogs)
      .innerJoin(partners, eq(stockLogs.partner_id, partners.id))
      .innerJoin(products, eq(stockLogs.product_id, products.id))
      .orderBy(desc(stockLogs.created_at))
      .limit(100);

    return { data: rows };
  })
  .get("/stock-logs/partners", async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (user.role !== "admin") {
      set.status = 403;
      return { error: "Forbidden: Admin only" };
    }

    const rows = await db.execute(sql`
      SELECT p.id AS partner_id, p.name AS partner_name,
        COUNT(sl.id)::int AS log_count, MAX(sl.created_at) AS latest_update
      FROM partners p
      JOIN stock_logs sl ON sl.partner_id = p.id
      WHERE p.is_active = true
      GROUP BY p.id, p.name
      ORDER BY MAX(sl.created_at) DESC, p.name ASC
    `);

    return { data: rows };
  })
  .get("/stock-logs/export", async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (user.role !== "admin") {
      set.status = 403;
      return { error: "Forbidden: Admin only" };
    }

    const csvCell = (value: unknown) => {
      const text = value instanceof Date ? value.toISOString() : String(value ?? "");
      const safeText = /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safeText.replaceAll('"', '""')}"`;
    };
    const headersRow = [
      "log_id", "partner_id", "partner_name", "product_id", "product_name",
      "qty_before", "qty_after", "source", "created_at",
    ];
    const cursor = postgres.unsafe(`
      SELECT sl.id AS log_id, sl.partner_id, pa.name AS partner_name,
        sl.product_id, pr.name AS product_name, sl.qty_before, sl.qty_after,
        sl.source, sl.created_at
      FROM stock_logs sl
      JOIN partners pa ON pa.id = sl.partner_id
      JOIN products pr ON pr.id = sl.product_id
      ORDER BY sl.created_at DESC
    `).cursor(500)[Symbol.asyncIterator]();

    set.headers["Content-Type"] = "text/csv; charset=utf-8";
    set.headers["Content-Disposition"] = 'attachment; filename="raw_stock_logs.csv"';
    const encoder = new TextEncoder();
    let headerSent = false;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (!headerSent) {
          headerSent = true;
          controller.enqueue(encoder.encode(`\uFEFF${headersRow.join(",")}\r\n`));
          return;
        }
        const { value, done } = await cursor.next();
        if (done) {
          controller.close();
          return;
        }
        const chunk = (value as Array<Record<string, unknown>>)
          .map((row) => `${headersRow.map((key) => csvCell(row[key])).join(",")}\r\n`)
          .join("");
        controller.enqueue(encoder.encode(chunk));
      },
      async cancel() {
        await cursor.return?.();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="raw_stock_logs.csv"',
      },
    });
  })
  .get("/stock-logs/partners/:partnerId", async ({ headers, params, set }) => {
    const user = await getAuthUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (user.role !== "admin") {
      set.status = 403;
      return { error: "Forbidden: Admin only" };
    }

    const rows = await db
      .select({
        id: stockLogs.id,
        partner_id: stockLogs.partner_id,
        partner_name: partners.name,
        product_name: products.name,
        qty_before: stockLogs.qty_before,
        qty_after: stockLogs.qty_after,
        delta: sql<number>`${stockLogs.qty_before} - ${stockLogs.qty_after}`,
        source: stockLogs.source,
        created_at: stockLogs.created_at,
      })
      .from(stockLogs)
      .innerJoin(partners, eq(stockLogs.partner_id, partners.id))
      .innerJoin(products, eq(stockLogs.product_id, products.id))
      .where(eq(stockLogs.partner_id, params.partnerId))
      .orderBy(desc(stockLogs.created_at))
      .limit(500);

    return { data: rows };
  })
  .get("/weekly-summary", async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (user.role !== "admin") {
      set.status = 403;
      return { error: "Forbidden: Admin only" };
    }

    const [summary] = await db.execute<{
      total_logs_this_week: number;
      active_partners_count: number;
      total_units_consumed: number;
    }>(sql`
      SELECT
        COUNT(*)::int AS total_logs_this_week,
        COUNT(DISTINCT partner_id)::int AS active_partners_count,
        COALESCE(SUM(GREATEST(qty_before - qty_after, 0)), 0)::int AS total_units_consumed
      FROM stock_logs
      WHERE created_at >= NOW() - INTERVAL '7 days'
        AND source = 'manual_update'
    `);
    const daily = await db.execute<{
      day: string;
      active_partners: number;
      log_count: number;
    }>(sql`
      WITH days AS (
        SELECT generate_series(
          (NOW() AT TIME ZONE 'Asia/Jakarta')::date - 6,
          (NOW() AT TIME ZONE 'Asia/Jakarta')::date,
          INTERVAL '1 day'
        )::date AS report_day
      )
      SELECT TO_CHAR(days.report_day, 'YYYY-MM-DD') AS day,
        COUNT(DISTINCT logs.partner_id)::int AS active_partners,
        COUNT(logs.id)::int AS log_count
      FROM days
      LEFT JOIN stock_logs logs
        ON (logs.created_at AT TIME ZONE 'Asia/Jakarta')::date = days.report_day
        AND logs.created_at >= NOW() - INTERVAL '7 days'
        AND logs.source = 'manual_update'
      GROUP BY days.report_day ORDER BY days.report_day
    `);

    return {
      data: {
        total_logs_this_week: Number(summary?.total_logs_this_week ?? 0),
        active_partners_count: Number(summary?.active_partners_count ?? 0),
        total_units_consumed: Number(summary?.total_units_consumed ?? 0),
        daily_update_breakdown: daily,
      },
    };
  })
  .get("/ai-insights", async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (user.role !== "admin") {
      set.status = 403;
      return { error: "Forbidden: Admin only" };
    }

    const analytics = await computeCompanyAiAnalytics();
    return { data: analytics };
  })
  .post("/ai-insights/run", async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (user.role !== "admin") {
      set.status = 403;
      return { error: "Forbidden: Admin only" };
    }

    // 1. Eksekusi pembaruan analitik AI di database
    const analytics = await computeCompanyAiAnalytics();

    // 2. Upsert rekomendasi cerdas ke tabel restock_recommendations
    const productRows = await db
      .select({ id: products.id, central_stock: products.central_stock })
      .from(products)
      .where(eq(products.is_active, true));
    const centralStockMap = new Map(productRows.map((p) => [p.id, p.central_stock]));

    // Ambil daftar stok mitra untuk dihitung alokasi cerdas
    const partnerStockRows = await db
      .select({
        partner_id: partnerStocks.partner_id,
        product_id: partnerStocks.product_id,
        current_qty: partnerStocks.current_qty,
        par_level: partnerStocks.par_level,
      })
      .from(partnerStocks);

    // Kebutuhan alokasi per mitra
    const sortedRecommendations = partnerStockRows.map((ps) => {
      const fastMatch = analytics.fast_moving_products.find(
        (f) => f.partner_id === ps.partner_id && f.product_id === ps.product_id,
      );
      const targetPar = fastMatch?.suggested_par_level ?? ps.par_level;
      const weeklyCons = fastMatch?.weekly_consumption ?? 0;
      const adu = Number((weeklyCons / 7).toFixed(2));
      const safety = Math.max(5, Math.round(adu * 2));
      const idealDemand = Math.max(0, targetPar - ps.current_qty + safety);
      const daysOfCover = adu > 0 ? Number((ps.current_qty / adu).toFixed(1)) : 99;

      return {
        partner_id: ps.partner_id,
        product_id: ps.product_id,
        forecast_qty: Math.round(adu * 6),
        ideal_demand: idealDemand,
        days_of_cover: daysOfCover,
        is_emergency: ps.current_qty <= Math.max(10, ps.par_level * 0.2) || daysOfCover < 2,
      };
    }).sort((a, b) => (a.is_emergency ? -1 : 1) - (b.is_emergency ? -1 : 1) || a.days_of_cover - b.days_of_cover);

    for (const item of sortedRecommendations) {
      const currentCentral = centralStockMap.get(item.product_id) ?? 0;
      const allocated = Math.min(item.ideal_demand, currentCentral);
      centralStockMap.set(item.product_id, Math.max(0, currentCentral - allocated));

      await db
        .insert(restockRecommendations)
        .values({
          partner_id: item.partner_id,
          product_id: item.product_id,
          forecast_qty: item.forecast_qty,
          suggested_qty: allocated,
          days_of_cover: String(item.days_of_cover),
          model_version: "v2.0-ai-company-analytics",
          generated_at: new Date(),
        })
        .onConflictDoUpdate({
          target: [restockRecommendations.partner_id, restockRecommendations.product_id],
          set: {
            forecast_qty: item.forecast_qty,
            suggested_qty: allocated,
            days_of_cover: String(item.days_of_cover),
            model_version: "v2.0-ai-company-analytics",
            generated_at: new Date(),
          },
        });
    }

    // 3. Notifikasi darurat untuk cabang dengan risiko tinggi
    const emergencyBranches = analytics.stockout_deficit_analysis.filter((d) => d.risk_level === "DARURAT").slice(0, 3);
    for (const emg of emergencyBranches) {
      await db.execute(sql`
        INSERT INTO notifications (audience, type, partner_id, title, body)
        SELECT 'admin', 'low_stock', ${emg.partner_id}::uuid, ${`Prioritas Suplai: ${emg.partner_name}`}, ${`Produk ${emg.product_name} di ${emg.partner_name} berisiko habis (sisa ${emg.days_of_cover} hari). ${emg.action_recommendation}`}
        WHERE NOT EXISTS (
          SELECT 1 FROM notifications existing
          WHERE existing.audience = 'admin'
            AND existing.type = 'low_stock'
            AND existing.partner_id = ${emg.partner_id}::uuid
            AND existing.title = ${`Prioritas Suplai: ${emg.partner_name}`}
            AND existing.created_at >= NOW() - INTERVAL '12 hours'
        )
      `);
    }

    // 4. Coba panggil python company_analytics.py di background jika tersedia
    try {
      Bun.spawn(["python", "ai/jobs/company_analytics.py"], {
        stdout: "ignore",
        stderr: "ignore",
      });
    } catch {
      // Python opsional, kalkulasi SQL/TypeScript di atas sudah 100% lengkap
    }

    // Ambil data terbaru setelah upsert
    return { status: "ok" };
  });

async function computeCompanyAiAnalytics() {
  // 1. Existing frequentStockouts for backwards-compatibility
  const frequentStockouts = await db.execute(sql`
    SELECT ps.partner_id, pa.name AS partner_name, ps.product_id,
      pr.name AS product_name, ps.current_qty, ps.par_level,
      COUNT(*) FILTER (WHERE sl.qty_after <= GREATEST(10, ps.par_level * 0.2))::int AS critical_log_count
    FROM partner_stocks ps
    JOIN partners pa ON pa.id = ps.partner_id AND pa.is_active = true
    JOIN products pr ON pr.id = ps.product_id AND pr.is_active = true
    LEFT JOIN stock_logs sl ON sl.partner_id = ps.partner_id
      AND sl.product_id = ps.product_id
      AND sl.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY ps.partner_id, pa.name, ps.product_id, pr.name, ps.current_qty, ps.par_level
    HAVING ps.current_qty < ps.par_level * 0.2
      OR (COUNT(*) FILTER (WHERE sl.qty_after <= GREATEST(10, ps.par_level * 0.2))) > 0
    ORDER BY critical_log_count DESC, ps.current_qty ASC
    LIMIT 100
  `);

  // 2. Existing recommendations
  const recommendations = await db
    .select({
      partner_id: restockRecommendations.partner_id,
      partner_name: partners.name,
      product_id: restockRecommendations.product_id,
      product_name: products.name,
      forecast_qty: restockRecommendations.forecast_qty,
      suggested_qty: restockRecommendations.suggested_qty,
      days_of_cover: restockRecommendations.days_of_cover,
      model_version: restockRecommendations.model_version,
      generated_at: restockRecommendations.generated_at,
    })
    .from(restockRecommendations)
    .innerJoin(partners, eq(restockRecommendations.partner_id, partners.id))
    .innerJoin(products, eq(restockRecommendations.product_id, products.id))
    .orderBy(desc(restockRecommendations.generated_at))
    .limit(200);

  // 3. Overall 3-Pillar Aggregates (Sales & Restock Fulfillment)
  const [salesSummary] = await db.execute(sql<{
    total_7d: number;
    total_prev_7d: number;
    fulfillment_rate: number;
  }>`
    SELECT
      COALESCE((
        SELECT SUM(qty_before - qty_after)
        FROM stock_logs
        WHERE source = 'manual_update'
          AND created_at >= NOW() - INTERVAL '7 days'
          AND qty_before > qty_after
      ), 0)::int as total_7d,
      COALESCE((
        SELECT SUM(qty_before - qty_after)
        FROM stock_logs
        WHERE source = 'manual_update'
          AND created_at >= NOW() - INTERVAL '14 days'
          AND created_at < NOW() - INTERVAL '7 days'
          AND qty_before > qty_after
      ), 0)::int as total_prev_7d,
      COALESCE((
        SELECT (SUM(oi.qty_approved)::float / NULLIF(SUM(oi.qty_requested), 0)::float) * 100
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.created_at >= NOW() - INTERVAL '30 days'
          AND o.status IN ('disetujui', 'dalam_pengiriman', 'selesai')
      ), 100.0)::float as fulfillment_rate
  `);

  const totalSales7d = Number(salesSummary?.total_7d ?? 0);
  const totalSalesPrev7d = Number(salesSummary?.total_prev_7d ?? 0);
  const fulfillmentRate = Number(Number(salesSummary?.fulfillment_rate ?? 100).toFixed(1));
  const salesGrowthPct = totalSalesPrev7d > 0
    ? Number((((totalSales7d - totalSalesPrev7d) / totalSalesPrev7d) * 100).toFixed(1))
    : 0;

  // 4. Detailed Branch Stocks & Consumption Velocity
  const branchStockDetails = await db.execute<{
    partner_id: string;
    partner_name: string;
    partner_type: string;
    product_id: string;
    product_name: string;
    product_sku: string;
    current_qty: number;
    par_level: number;
    weekly_consumption: number;
    critical_frequency: number;
    has_active_order: boolean;
  }>(sql`
    WITH sales_7d AS (
      SELECT partner_id, product_id,
        COALESCE(SUM(qty_before - qty_after), 0)::int as sold_7d
      FROM stock_logs
      WHERE source = 'manual_update'
        AND created_at >= NOW() - INTERVAL '7 days'
        AND qty_before > qty_after
      GROUP BY partner_id, product_id
    ),
    crit_logs AS (
      SELECT ps.partner_id, ps.product_id,
        COUNT(sl.id)::int as critical_count
      FROM partner_stocks ps
      LEFT JOIN stock_logs sl ON sl.partner_id = ps.partner_id
        AND sl.product_id = ps.product_id
        AND sl.created_at >= NOW() - INTERVAL '30 days'
        AND sl.qty_after <= GREATEST(10, ps.par_level * 0.2)
      GROUP BY ps.partner_id, ps.product_id
    ),
    active_orders AS (
      SELECT DISTINCT partner_id
      FROM orders
      WHERE status IN ('diproses', 'disetujui', 'dalam_pengiriman')
    )
    SELECT ps.partner_id, pa.name as partner_name, pa.type as partner_type,
      ps.product_id, pr.name as product_name, pr.sku as product_sku,
      ps.current_qty, ps.par_level,
      COALESCE(s7.sold_7d, 0)::int as weekly_consumption,
      COALESCE(cl.critical_count, 0)::int as critical_frequency,
      (ao.partner_id IS NOT NULL) as has_active_order
    FROM partner_stocks ps
    JOIN partners pa ON pa.id = ps.partner_id AND pa.is_active = true
    JOIN products pr ON pr.id = ps.product_id AND pr.is_active = true
    LEFT JOIN sales_7d s7 ON s7.partner_id = ps.partner_id AND s7.product_id = ps.product_id
    LEFT JOIN crit_logs cl ON cl.partner_id = ps.partner_id AND cl.product_id = ps.product_id
    LEFT JOIN active_orders ao ON ao.partner_id = ps.partner_id
  `);

  const fastMovingProducts: Array<{
    partner_id: string;
    partner_name: string;
    partner_type: string;
    product_id: string;
    product_name: string;
    product_sku: string;
    current_qty: number;
    par_level: number;
    weekly_consumption: number;
    daily_velocity: number;
    critical_frequency: number;
    turnover_rate: number;
    suggested_par_level: number;
    par_delta: number;
    reason: string;
  }> = [];

  const stockoutDeficitAnalysis: Array<{
    partner_id: string;
    partner_name: string;
    partner_type: string;
    product_id: string;
    product_name: string;
    current_qty: number;
    par_level: number;
    days_of_cover: number;
    critical_frequency: number;
    root_cause: 'UNDER_CAPACITY' | 'LATE_REORDER' | 'SUPPLY_DEFICIT';
    root_cause_label: string;
    risk_level: 'DARURAT' | 'WASPADA';
    action_recommendation: string;
  }> = [];

  for (const row of branchStockDetails) {
    const currentQty = Number(row.current_qty);
    const parLevel = Number(row.par_level);
    const weeklyConsumption = Number(row.weekly_consumption);
    const dailyVelocity = Number((weeklyConsumption / 7).toFixed(2));
    const critFreq = Number(row.critical_frequency);
    const turnoverRate = parLevel > 0 ? Number(((weeklyConsumption / parLevel) * 100).toFixed(1)) : 0;
    const daysOfCover = dailyVelocity > 0 ? Number((currentQty / dailyVelocity).toFixed(1)) : (currentQty > 0 ? 99 : 0);

    // Hitung Par Level Dinamis AI (Lead Time 6 hari + 3 hari buffer + safety stock)
    const safetyStock = Math.max(5, Math.round(dailyVelocity * 2));
    let suggestedPar = Math.max(parLevel, Math.round(dailyVelocity * 9 + safetyStock));
    if (suggestedPar > 20) {
      suggestedPar = Math.ceil(suggestedPar / 5) * 5;
    }
    const parDelta = suggestedPar - parLevel;

    // Deteksi Fast Moving (Kritis = Laris)
    const isFastMoving = (turnoverRate >= 50 || critFreq >= 2) && dailyVelocity >= 1;
    if (isFastMoving || parDelta > 0) {
      fastMovingProducts.push({
        partner_id: row.partner_id,
        partner_name: row.partner_name,
        partner_type: row.partner_type,
        product_id: row.product_id,
        product_name: row.product_name,
        product_sku: row.product_sku,
        current_qty: currentQty,
        par_level: parLevel,
        weekly_consumption: weeklyConsumption,
        daily_velocity: dailyVelocity,
        critical_frequency: critFreq,
        turnover_rate: turnoverRate,
        suggested_par_level: suggestedPar,
        par_delta: parDelta,
        reason: parDelta > 0
          ? `Barang sangat laku (terjual ${weeklyConsumption} pcs/minggu). Kapasitas rak saat ini (${parLevel} pcs) terlalu kecil sehingga ${critFreq}x berstatus kritis. Disarankan naikkan ke ${suggestedPar} pcs.`
          : `Perputaran barang cepat (omzet ${turnoverRate}% dari kapasitas rak per minggu).`,
      });
    }

    // Deteksi Defisit & Rawan Kehabisan Stok
    const isAtRisk = currentQty <= Math.max(10, parLevel * 0.2) || daysOfCover < 3 || critFreq >= 2;
    if (isAtRisk) {
      let rootCause: 'UNDER_CAPACITY' | 'LATE_REORDER' | 'SUPPLY_DEFICIT' = 'SUPPLY_DEFICIT';
      let rootCauseLabel = 'Fluktuasi Pasokan & Kebutuhan Darurat';
      let actionRec = 'Prioritaskan suplai darurat dari stok gudang pusat.';

      if (parLevel < Math.round(dailyVelocity * 6)) {
        rootCause = 'UNDER_CAPACITY';
        rootCauseLabel = 'Kapasitas Rak Kurang (Under-Capacity)';
        actionRec = `Kapasitas rak tidak menampung kebutuhan 6 hari pengiriman. Naikkan par level ke ${suggestedPar} pcs.`;
      } else if (!row.has_active_order && daysOfCover < 3) {
        rootCause = 'LATE_REORDER';
        rootCauseLabel = 'Keterlambatan Pesan Restok';
        actionRec = 'Stok mendekati habis dan belum ada pesanan aktif. Hubungi PIC cabang untuk segera order restok.';
      }

      stockoutDeficitAnalysis.push({
        partner_id: row.partner_id,
        partner_name: row.partner_name,
        partner_type: row.partner_type,
        product_id: row.product_id,
        product_name: row.product_name,
        current_qty: currentQty,
        par_level: parLevel,
        days_of_cover: daysOfCover,
        critical_frequency: critFreq,
        root_cause: rootCause,
        root_cause_label: rootCauseLabel,
        risk_level: (daysOfCover < 2 || currentQty <= 5) ? 'DARURAT' : 'WASPADA',
        action_recommendation: actionRec,
      });
    }
  }

  fastMovingProducts.sort((a, b) => b.par_delta - a.par_delta || b.critical_frequency - a.critical_frequency || b.weekly_consumption - a.weekly_consumption);
  stockoutDeficitAnalysis.sort((a, b) => (a.risk_level === 'DARURAT' ? -1 : 1) - (b.risk_level === 'DARURAT' ? -1 : 1) || a.days_of_cover - b.days_of_cover);

  // 5. Factory Procurement Forecast
  const factoryRows = await db.execute(sql<{
    product_id: string;
    product_name: string;
    product_sku: string;
    central_stock: number;
    weekly_demand: number;
  }>`
    SELECT pr.id as product_id, pr.name as product_name, pr.sku as product_sku,
      pr.central_stock,
      COALESCE(SUM(sl.qty_before - sl.qty_after), 0)::int as weekly_demand
    FROM products pr
    LEFT JOIN stock_logs sl ON sl.product_id = pr.id
      AND sl.source = 'manual_update'
      AND sl.created_at >= NOW() - INTERVAL '7 days'
      AND sl.qty_before > sl.qty_after
    WHERE pr.is_active = true
    GROUP BY pr.id, pr.name, pr.sku, pr.central_stock
    ORDER BY pr.name ASC
  `);

  let totalCentralStock = 0;
  let totalWeeklyDemandAll = 0;

  const factoryProcurementForecast = factoryRows.map((row) => {
    const cStock = Number(row.central_stock);
    const wDemand = Number(row.weekly_demand);
    totalCentralStock += cStock;
    totalWeeklyDemandAll += wDemand;

    const dailyDem = wDemand > 0 ? wDemand / 7 : 0.5;
    const runoutDays = Number((cStock / dailyDem).toFixed(1));

    // Target buffer: Lead time pabrik 7 hari + 14 hari cadangan = 21 hari
    const targetBuffer = Math.round(dailyDem * 21);
    let suggestedBatch = Math.max(0, targetBuffer - cStock);
    if (suggestedBatch > 0) {
      suggestedBatch = Math.ceil(suggestedBatch / 50) * 50;
    }

    const urgency: 'CRITICAL' | 'WARNING' | 'HEALTHY' =
      runoutDays <= 7 ? 'CRITICAL' : runoutDays <= 14 ? 'WARNING' : 'HEALTHY';

    return {
      product_id: row.product_id,
      product_name: row.product_name,
      product_sku: row.product_sku,
      central_stock: cStock,
      total_partner_demand_weekly: wDemand,
      estimated_runout_days: runoutDays,
      suggested_factory_batch_order: suggestedBatch,
      urgency,
    };
  });

  factoryProcurementForecast.sort((a, b) => {
    const uA = a.urgency === 'CRITICAL' ? 0 : a.urgency === 'WARNING' ? 1 : 2;
    const uB = b.urgency === 'CRITICAL' ? 0 : b.urgency === 'WARNING' ? 1 : 2;
    return uA - uB || a.estimated_runout_days - b.estimated_runout_days;
  });

  const dailyDemandAll = totalWeeklyDemandAll > 0 ? totalWeeklyDemandAll / 7 : 1;
  const centralStockHealthDays = Number((totalCentralStock / dailyDemandAll).toFixed(1));

  // 6. AI Digest
  const topFast = fastMovingProducts[0];
  const criticalProcure = factoryProcurementForecast.filter(f => f.urgency === 'CRITICAL');

  const procurementText = criticalProcure.length > 0
    ? `Perhatian: ${criticalProcure.length} produk (${criticalProcure.slice(0, 2).map(p => p.product_name).join(', ')}) memiliki stok gudang pusat ≤ 7 hari. Segera order batch produksi pabrik.`
    : `Kesiapan stok gudang pusat dalam kondisi sehat (daya tahan rata-rata ${centralStockHealthDays} hari).`;

  const aiDigest = {
    headline: `Perkembangan Bisnis: ${totalSales7d} pcs Terjual Minggu Ini (${salesGrowthPct >= 0 ? '+' : ''}${salesGrowthPct}%)`,
    sales_insight: topFast
      ? `Produk berstatus sering kritis terbukti merupakan produk paling laris. Contoh: ${topFast.product_name} di ${topFast.partner_name} mencatatkan penjualan ${topFast.weekly_consumption} pcs/minggu. Disarankan menaikkan kapasitas rak.`
      : `Konsumsi produk di seluruh mitra terpantau stabil.`,
    restock_insight: `Tingkat pemenuhan pesanan restok jaringan mencapai ${fulfillmentRate}% dari seluruh permohonan cabang.`,
    procurement_insight: procurementText,
    generated_at: new Date().toISOString(),
  };

  return {
    engine_status: {
      is_active: true,
      last_run_at: recommendations[0]?.generated_at ?? new Date().toISOString(),
      version: 'v2.0-ai-company-analytics',
    },
    kpi_summary: {
      weekly_sales_units: totalSales7d,
      sales_growth_percentage: salesGrowthPct,
      restock_fulfillment_rate: fulfillmentRate,
      central_stock_health_days: centralStockHealthDays,
      critical_high_turnover_count: fastMovingProducts.length,
      stockout_risk_count: stockoutDeficitAnalysis.length,
    },
    fast_moving_products: fastMovingProducts.slice(0, 30),
    stockout_deficit_analysis: stockoutDeficitAnalysis.slice(0, 30),
    factory_procurement_forecast: factoryProcurementForecast,
    frequent_stockouts: frequentStockouts,
    recommendations,
    ai_digest: aiDigest,
  };
}
