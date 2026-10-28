import { Elysia, t } from "elysia";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../db/client";
import { notifications, orderItems, orders, partners, products } from "../../db/schema";
import { getAuthUser } from "../../plugins/auth";

export const adminNotificationModule = new Elysia({ prefix: "/notification" })
  .get("/", async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (user.role !== "admin") {
      set.status = 403;
      return { error: "Akses admin diperlukan" };
    }

    const data = await db
      .select({
        id: notifications.id,
        audience: notifications.audience,
        type: notifications.type,
        partner_id: notifications.partner_id,
        partner_name: partners.name,
        title: notifications.title,
        body: notifications.body,
        read_at: notifications.read_at,
        created_at: notifications.created_at,
      })
      .from(notifications)
      .leftJoin(partners, eq(notifications.partner_id, partners.id))
      .where(eq(notifications.audience, "admin"))
      .orderBy(desc(notifications.created_at))
      .limit(50);

    const partnerIds = [...new Set(data.map((item) => item.partner_id).filter((id): id is string => id !== null))];
    if (partnerIds.length === 0) return { data, orders: [] };

    const relatedOrders = await db
      .select({
        id: orders.id,
        order_no: orders.order_no,
        partner_id: orders.partner_id,
        status: orders.status,
        created_at: orders.created_at,
        rejected_reason: orders.rejected_reason,
      })
      .from(orders)
      .where(inArray(orders.partner_id, partnerIds))
      .orderBy(desc(orders.created_at))
      .limit(200);

    if (relatedOrders.length === 0) return { data, orders: [] };

    const items = await db
      .select({
        order_id: orderItems.order_id,
        product_name: products.name,
        product_unit: products.unit,
        qty_requested: orderItems.qty_requested,
        qty_approved: orderItems.qty_approved,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.product_id, products.id))
      .where(inArray(orderItems.order_id, relatedOrders.map((order) => order.id)));

    const itemsByOrder = new Map<string, typeof items>();
    for (const item of items) {
      const orderItemsForOrder = itemsByOrder.get(item.order_id) ?? [];
      orderItemsForOrder.push(item);
      itemsByOrder.set(item.order_id, orderItemsForOrder);
    }

    return {
      data,
      orders: relatedOrders.map((order) => ({
        ...order,
        items: itemsByOrder.get(order.id) ?? [],
      })),
    };
  })
  .patch(
    "/",
    async ({ headers, body, set }) => {
      const user = await getAuthUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      if (user.role !== "admin") {
        set.status = 403;
        return { error: "Akses admin diperlukan" };
      }

      const readAt = new Date();
      const condition = "id" in body
        ? and(eq(notifications.audience, "admin"), eq(notifications.id, body.id), isNull(notifications.read_at))
        : and(eq(notifications.audience, "admin"), isNull(notifications.read_at));

      const updated = await db
        .update(notifications)
        .set({ read_at: readAt })
        .where(condition)
        .returning({ id: notifications.id });

      if ("id" in body && updated.length === 0) {
        const [existing] = await db
          .select({ id: notifications.id })
          .from(notifications)
          .where(and(eq(notifications.audience, "admin"), eq(notifications.id, body.id)))
          .limit(1);
        if (!existing) {
          set.status = 404;
          return { error: "Notifikasi tidak ditemukan" };
        }
      }

      return { status: "ok", read_at: readAt.toISOString(), ids: updated.map((item) => item.id) };
    },
    {
      body: t.Union([
        t.Object({ id: t.String({ format: "uuid" }) }),
        t.Object({ all: t.Literal(true) }),
      ]),
    },
  );
