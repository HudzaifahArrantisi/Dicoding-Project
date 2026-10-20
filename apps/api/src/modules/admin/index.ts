import { Elysia } from "elysia";
import { desc, eq, sql } from "drizzle-orm";
import { db, sql as postgres } from "../../db/client";
import {
  orders,
  partners,
  products,
  restockRecommendations,
  stockLogs,
} from "../../db/schema";
import { getAuthUser } from "../../plugins/auth";

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
      WHERE (current_qty::float / par_level::float) < 0.20
    `);

    const criticalItems = await db.execute(sql<{ count: number }>`
      SELECT count(*)::int as count 
      FROM partner_stocks 
      WHERE (current_qty::float / par_level::float) < 0.20
    `);

    return {
      totalBranches: branchCount?.count ?? 0,
      criticalBranches: criticalRows.length,
      pendingOrders: pendingOrders?.count ?? 0,
      criticalItemsCount: Number(criticalItems[0]?.count ?? 0),
    };
  })
  .get("/partners", async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (user.role !== "admin") {
      set.status = 403;
      return { error: "Forbidden: Admin only" };
    }

    const partnerList = await db
      .select()
      .from(partners)
      .where(eq(partners.is_active, true))
      .orderBy(partners.name);

    return { data: partnerList };
  })
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
      return `"${text.replaceAll('"', '""')}"`;
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

    return { data: { frequent_stockouts: frequentStockouts, recommendations } };
  });
