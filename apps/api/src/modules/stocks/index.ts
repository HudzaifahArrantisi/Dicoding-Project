import { Elysia, t } from "elysia";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db/client";
import {
  auditLogs,
  partnerStocks,
  products,
  orders,
  orderItems,
  partners,
  stockLogs,
  stockRecalls,
  notifications,
  restockRecommendations,
} from "../../db/schema";
import { getAuthUser } from "../../plugins/auth";
import { stockPercent, getStockStatus, isStale } from "@daisuki/shared";
import { publishInventoryChange } from "../../realtime";

export const stocksModule = new Elysia({ prefix: "/stocks" })
  .get("/recalls", async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (user.role !== "admin") { set.status = 403; return { error: "Hanya admin yang dapat melihat penarikan stok" }; }

    const rows = await db.select({
      id: stockRecalls.id,
      partner_id: stockRecalls.partner_id,
      partner_name: partners.name,
      reason: stockRecalls.reason,
      items: stockRecalls.items,
      status: stockRecalls.status,
      created_at: stockRecalls.created_at,
      completed_at: stockRecalls.completed_at,
    }).from(stockRecalls)
      .innerJoin(partners, eq(stockRecalls.partner_id, partners.id))
      .orderBy(desc(stockRecalls.created_at));
    return { data: rows };
  })
  .post("/partners/:partnerId/recalls", async ({ headers, params, body, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (user.role !== "admin") { set.status = 403; return { error: "Hanya admin yang dapat menarik stok cabang" }; }
    const reason = body.reason.trim();
    if (reason.length < 10) { set.status = 422; return { error: "Alasan penarikan minimal 10 karakter" }; }

    const result = await db.transaction(async (tx) => {
      const [partner] = await tx.select({ id: partners.id, name: partners.name })
        .from(partners).where(eq(partners.id, params.partnerId)).for("update");
      if (!partner) return { error: "Mitra tidak ditemukan", status: 404 as const };

      const [pending] = await tx.select({ id: stockRecalls.id }).from(stockRecalls)
        .where(and(eq(stockRecalls.partner_id, partner.id), eq(stockRecalls.status, "pending"))).limit(1);
      if (pending) return { error: "Penarikan sebelumnya masih menunggu penjemputan", status: 409 as const };

      const stocks = await tx.select().from(partnerStocks)
        .where(eq(partnerStocks.partner_id, partner.id)).for("update");
      const expected = new Map(body.expected_items.map((item) => [item.product_id, item.current_qty]));
      if (expected.size !== stocks.length || stocks.some((stock) => expected.get(stock.product_id) !== stock.current_qty)) {
        return { error: "Stok berubah sejak dialog dibuka. Periksa jumlah terbaru sebelum mengulangi penarikan", status: 409 as const };
      }
      const total = stocks.reduce((sum, stock) => sum + stock.current_qty, 0);
      if (total === 0) return { error: "Seluruh stok mitra sudah 0", status: 422 as const };

      const productRows = await tx.select({ id: products.id, name: products.name }).from(products);
      const names = new Map(productRows.map((product) => [product.id, product.name]));
      const items = stocks.map((stock) => ({
        product_id: stock.product_id,
        product_name: names.get(stock.product_id) ?? "Produk tidak ditemukan",
        quantity: stock.current_qty,
      }));

      await tx.update(partnerStocks).set({ current_qty: 0, updated_at: new Date(), updated_by: user.userId })
        .where(eq(partnerStocks.partner_id, partner.id));
      await tx.insert(stockLogs).values(stocks.filter((stock) => stock.current_qty > 0).map((stock) => ({
        partner_id: partner.id,
        product_id: stock.product_id,
        qty_before: stock.current_qty,
        qty_after: 0,
        source: "adjustment" as const,
        created_by: user.userId,
      })));
      const [recall] = await tx.insert(stockRecalls).values({
        partner_id: partner.id, reason, items, requested_by: user.userId,
      }).returning({ id: stockRecalls.id });
      await tx.insert(auditLogs).values({
        actor_id: user.userId, action: "stock.recall", target_type: "partner", target_id: partner.id,
      });
      return { id: recall.id, total, status: 201 as const };
    });

    set.status = result.status;
    if ("error" in result) return { error: result.error };
    publishInventoryChange({ partnerId: params.partnerId, topics: ["stocks", "logs", "metrics"] });
    return { data: { id: result.id, total: result.total } };
  }, {
    params: t.Object({ partnerId: t.String({ format: "uuid" }) }),
    body: t.Object({
      reason: t.String({ minLength: 10, maxLength: 500 }),
      expected_items: t.Array(t.Object({
        product_id: t.String({ format: "uuid" }),
        current_qty: t.Integer({ minimum: 0 }),
      })),
    }),
  })
  .patch("/recalls/:id/complete", async ({ headers, params, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (user.role !== "admin") { set.status = 403; return { error: "Hanya admin yang dapat menyelesaikan penarikan" }; }

    const recall = await db.transaction(async (tx) => {
      const [updated] = await tx.update(stockRecalls)
        .set({ status: "completed", completed_at: new Date(), completed_by: user.userId })
        .where(and(eq(stockRecalls.id, params.id), eq(stockRecalls.status, "pending")))
        .returning({ id: stockRecalls.id, partner_id: stockRecalls.partner_id });
      if (updated) {
        await tx.insert(auditLogs).values({
          actor_id: user.userId, action: "stock.recall_completed", target_type: "partner", target_id: updated.partner_id,
        });
      }
      return updated;
    });
    if (!recall) { set.status = 404; return { error: "Penarikan aktif tidak ditemukan" }; }
    return { status: "ok" };
  }, { params: t.Object({ id: t.String({ format: "uuid" }) }) })
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

      const rows = await db
        .select({
          partner_id: partnerStocks.partner_id,
          partner_name: partners.name,
          partner_type: partners.type,
          product_id: partnerStocks.product_id,
          product_sku: products.sku,
          product_name: products.name,
          product_unit: products.unit,
          b2b_price: products.b2b_price,
          central_stock: products.central_stock,
          current_qty: partnerStocks.current_qty,
          par_level: partnerStocks.par_level,
          updated_at: partnerStocks.updated_at,
        })
        .from(partnerStocks)
        .innerJoin(products, eq(partnerStocks.product_id, products.id))
        .innerJoin(partners, eq(partnerStocks.partner_id, partners.id))
        .where(
          targetPartnerId
            ? and(
                eq(partnerStocks.partner_id, targetPartnerId),
                eq(products.is_active, true),
              )
            : eq(products.is_active, true),
        )
        .orderBy(partners.name, products.name);

      const items = rows.map((row) => {
        const percentage = Number(
          stockPercent(row.current_qty, row.par_level).toFixed(1),
        );
        const status = getStockStatus(row.current_qty, row.par_level);
        const stale = isStale(row.updated_at);

        return {
          ...row,
          percentage,
          status,
          is_stale: stale,
        };
      });

      return {
        data: items,
        total: items.length,
      };
    },
    {
      query: t.Object({
        partner_id: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/recommendations",
    async ({ headers, query, set }) => {
      const user = await getAuthUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const targetPartnerId =
        user.role === "mitra" ? user.partnerId : query.partner_id || null;

      if (user.role === "mitra" && !targetPartnerId) {
        set.status = 400;
        return { error: "User mitra belum terhubung ke cabang mitra" };
      }

      const rows = await db
        .select({
          id: restockRecommendations.id,
          partner_id: restockRecommendations.partner_id,
          partner_name: partners.name,
          product_id: restockRecommendations.product_id,
          product_name: products.name,
          product_sku: products.sku,
          forecast_qty: restockRecommendations.forecast_qty,
          suggested_qty: restockRecommendations.suggested_qty,
          days_of_cover: restockRecommendations.days_of_cover,
          model_version: restockRecommendations.model_version,
          generated_at: restockRecommendations.generated_at,
        })
        .from(restockRecommendations)
        .innerJoin(products, eq(restockRecommendations.product_id, products.id))
        .innerJoin(partners, eq(restockRecommendations.partner_id, partners.id))
        .where(
          targetPartnerId
            ? eq(restockRecommendations.partner_id, targetPartnerId)
            : undefined,
        )
        .orderBy(desc(restockRecommendations.generated_at));

      return { data: rows };
    },
    {
      query: t.Object({
        partner_id: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/logs",
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

      if (!targetPartnerId) {
        set.status = 400;
        return { error: "Cabang mitra belum ditentukan" };
      }

      const rows = await db
        .select({
          id: stockLogs.id,
          partner_id: stockLogs.partner_id,
          partner_name: partners.name,
          product_id: stockLogs.product_id,
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
        .where(eq(stockLogs.partner_id, targetPartnerId))
        .orderBy(desc(stockLogs.created_at))
        .limit(200);

      return { data: rows };
    },
    {
      query: t.Object({
        partner_id: t.Optional(t.String()),
      }),
    },
  )
  .put(
    "/",
    async ({ headers, body, set }) => {
      const user = await getAuthUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const targetPartnerId =
        user.role === "mitra" ? user.partnerId : body.partner_id;
      if (!targetPartnerId) {
        set.status = 400;
        return { error: "Partner ID wajib ditentukan" };
      }

      const [partner] = await db
        .select({ name: partners.name })
        .from(partners)
        .where(eq(partners.id, targetPartnerId))
        .limit(1);

      if (!partner) {
        set.status = 404;
        return { error: "Cabang mitra tidak ditemukan" };
      }

      const updateItems: Array<{ product_id: string; current_qty: number }> =
        "items" in body
          ? body.items
          : "product_id" in body
            ? [
                {
                  product_id: body.product_id,
                  current_qty: body.current_qty,
                },
              ]
            : [];

      if (updateItems.length === 0) {
        set.status = 400;
        return { error: "Tidak ada data stok yang diupdate" };
      }

      if (
        new Set(updateItems.map((item) => item.product_id)).size !==
        updateItems.length
      ) {
        set.status = 422;
        return {
          error: "Satu produk hanya boleh dikirim sekali dalam laporan stok",
        };
      }

      for (const item of updateItems) {
        const [stock] = await db
          .select({
            product_name: products.name,
            par_level: partnerStocks.par_level,
          })
          .from(partnerStocks)
          .innerJoin(products, eq(partnerStocks.product_id, products.id))
          .where(
            and(
              eq(partnerStocks.partner_id, targetPartnerId),
              eq(partnerStocks.product_id, item.product_id),
            ),
          )
          .limit(1);

        if (!stock) {
          set.status = 404;
          return { error: "Produk stok cabang tidak ditemukan" };
        }

      }

      const results = [];

      for (const item of updateItems) {
        const updatedRow = await db.transaction(async (tx) => {
          const [existing] = await tx
            .select({
              partner_id: partnerStocks.partner_id,
              product_id: partnerStocks.product_id,
              current_qty: partnerStocks.current_qty,
              par_level: partnerStocks.par_level,
              product_name: products.name,
            })
            .from(partnerStocks)
            .innerJoin(products, eq(partnerStocks.product_id, products.id))
            .where(
              and(
                eq(partnerStocks.partner_id, targetPartnerId),
                eq(partnerStocks.product_id, item.product_id),
              ),
            )
            .for("update");

          if (!existing) {
            throw new Error(
              `Stok produk ID ${item.product_id} tidak ditemukan di cabang ini`,
            );
          }

          const qtyBefore = existing.current_qty;
          const qtyAfter = item.current_qty;
          const oldStatus = getStockStatus(qtyBefore, existing.par_level);

          await tx
            .update(partnerStocks)
            .set({
              current_qty: qtyAfter,
              updated_at: new Date(),
              updated_by: user.userId,
            })
            .where(
              and(
                eq(partnerStocks.partner_id, targetPartnerId),
                eq(partnerStocks.product_id, item.product_id),
              ),
            );

          await tx.insert(stockLogs).values({
            partner_id: targetPartnerId,
            product_id: item.product_id,
            qty_before: qtyBefore,
            qty_after: qtyAfter,
            source: "manual_update",
            created_by: user.userId,
          });

          const newStatus = getStockStatus(qtyAfter, existing.par_level);
          const pct = stockPercent(qtyAfter, existing.par_level);

          if (oldStatus !== "kritis" && newStatus === "kritis") {
            await tx.insert(notifications).values({
              audience: "admin",
              type: "low_stock",
              partner_id: targetPartnerId,
              title: `Stok Kritis: ${existing.product_name}`,
              body: `Stok ${existing.product_name} di ${partner.name} tersisa ${qtyAfter}/${existing.par_level} pcs (${pct.toFixed(1)}%). Periksa kebutuhan restock cabang.`,
            });
          }

          return {
            product_id: item.product_id,
            product_name: existing.product_name,
            qty_before: qtyBefore,
            qty_after: qtyAfter,
            par_level: existing.par_level,
            percentage: Number(pct.toFixed(1)),
            status: newStatus,
          };
        });

        results.push(updatedRow);
      }

      publishInventoryChange({
        partnerId: targetPartnerId,
        topics: ["stocks", "logs", "metrics", "notifications"],
      });

      return { status: "ok" };
    },
    {
      body: t.Union([
        t.Object({
          partner_id: t.Optional(t.String()),
          items: t.Array(
            t.Object({
              product_id: t.String(),
              current_qty: t.Integer({ minimum: 0 }),
            }),
          ),
        }),
        t.Object({
          partner_id: t.Optional(t.String()),
          product_id: t.String(),
          current_qty: t.Integer({ minimum: 0 }),
        }),
      ]),
    },
  );

export const productsModule = new Elysia({ prefix: "/products" })
  .get("/", async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const items = await db
      .select()
      .from(products)
      .where(eq(products.is_active, true))
      .orderBy(products.name);

    return { data: items };
  })
  .put(
    "/:id/central-stock",
    async ({ headers, params, body, set }) => {
      const user = await getAuthUser(headers);
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }
      if (user.role !== "admin") {
        set.status = 403;
        return { error: "Hanya admin yang dapat memperbarui stok pusat" };
      }

      const updated = await db.transaction(async (tx) => {
        const [product] = await tx
          .update(products)
          .set({ central_stock: body.central_stock })
          .where(and(eq(products.id, params.id), eq(products.is_active, true)))
          .returning({ id: products.id, central_stock: products.central_stock });
        if (product) {
          let available = product.central_stock;
          const waiting = await tx.select({
            order_id: orders.id,
            item_id: orderItems.id,
            partner_id: orders.partner_id,
            qty_requested: orderItems.qty_requested,
            qty_reserved: orderItems.qty_reserved,
          }).from(orderItems)
            .innerJoin(orders, eq(orderItems.order_id, orders.id))
            .where(and(eq(orderItems.product_id, product.id), eq(orders.status, "ditunda")))
            .orderBy(orders.created_at, orders.id)
            .for("update");
          for (const item of waiting) {
            if (available <= 0) break;
            const reserve = Math.min(available, item.qty_requested - item.qty_reserved);
            if (reserve <= 0) continue;
            await tx.update(orderItems).set({ qty_reserved: item.qty_reserved + reserve }).where(eq(orderItems.id, item.item_id));
            available -= reserve;
            const [remaining] = await tx.select({ count: sql<number>`count(*)::int` }).from(orderItems)
              .where(and(eq(orderItems.order_id, item.order_id), sql`${orderItems.qty_reserved} < ${orderItems.qty_requested}`));
            if (!remaining?.count) {
              await tx.update(orders).set({ status: "diproses" }).where(eq(orders.id, item.order_id));
              await tx.insert(notifications).values({ audience: "mitra", type: "order_update", partner_id: item.partner_id,
                title: "Stok pre-order sudah tersedia", body: "Pesanan Anda siap ditinjau admin Daisuki." });
            }
          }
          if (available !== product.central_stock) {
            await tx.update(products).set({ central_stock: available }).where(eq(products.id, product.id));
          }
          await tx.insert(auditLogs).values({
            actor_id: user.userId, action: "product.central_stock.update",
            target_type: "product", target_id: product.id,
          });
        }
        return product;
      });

      if (!updated) {
        set.status = 404;
        return { error: "Produk aktif tidak ditemukan" };
      }

      publishInventoryChange({
        partnerId: null,
        topics: ["products", "orders", "notifications"],
      });

      return { status: "ok" };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ central_stock: t.Integer({ minimum: 0 }) }),
    },
  );
