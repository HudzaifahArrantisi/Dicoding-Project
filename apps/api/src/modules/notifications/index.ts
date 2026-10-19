import { Elysia, t } from "elysia";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db/client";
import { notifications, partners } from "../../db/schema";
import { getAuthUser } from "../../plugins/auth";

export const notificationsModule = new Elysia({ prefix: "/notifications" })
  .get("/", async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    if (user.role === "mitra" && !user.partnerId) {
      set.status = 400;
      return { error: "User mitra belum terhubung ke cabang mitra" };
    }

    let condition;
    if (user.role === "mitra") {
      condition = and(
        eq(notifications.audience, "mitra"),
        user.partnerId
          ? eq(notifications.partner_id, user.partnerId)
          : undefined,
      );
    } else {
      condition = eq(notifications.audience, "admin");
    }

    const items = await db
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
      .where(condition)
      .orderBy(desc(notifications.created_at))
      .limit(50);

    return { data: items };
  })
  .patch(
    "/:id/read",
    async ({ headers, params, set }) => {
      const user = await getAuthUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      if (user.role === "mitra" && !user.partnerId) {
        set.status = 400;
        return { error: "User mitra belum terhubung ke cabang mitra" };
      }

      const accessCondition =
        user.role === "admin"
          ? and(
              eq(notifications.id, params.id),
              eq(notifications.audience, "admin"),
            )
          : and(
              eq(notifications.id, params.id),
              eq(notifications.audience, "mitra"),
              user.partnerId
                ? eq(notifications.partner_id, user.partnerId)
                : undefined,
            );

      const [updated] = await db
        .update(notifications)
        .set({ read_at: new Date() })
        .where(accessCondition)
        .returning({ id: notifications.id });

      if (!updated) {
        set.status = 404;
        return { error: "Notifikasi tidak ditemukan" };
      }

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  );
