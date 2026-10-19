import { Elysia } from "elysia";
import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { partners, orders } from "../../db/schema";
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
  });
