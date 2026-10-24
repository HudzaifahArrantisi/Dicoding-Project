import { Elysia, t } from "elysia";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../../db/client";
import {
  partnerStocks,
  products,
  partners,
  stockLogs,
  notifications,
  restockRecommendations,
} from "../../db/schema";
import { getAuthUser } from "../../plugins/auth";
import { stockPercent, getStockStatus, isStale } from "@daisuki/shared";
import { publishInventoryChange } from "../../realtime";

export const stocksModule = new Elysia({ prefix: "/stocks" })
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

        if (item.current_qty > stock.par_level) {
          set.status = 422;
          return {
            error: `Jumlah ${stock.product_name} tidak boleh lebih besar dari kapasitas rak (${stock.par_level})`,
          };
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

      return {
        success: true,
        message: "Stok berhasil diperbarui",
        data: results,
      };
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

      const [updated] = await db
        .update(products)
        .set({ central_stock: body.central_stock })
        .where(and(eq(products.id, params.id), eq(products.is_active, true)))
        .returning();

      if (!updated) {
        set.status = 404;
        return { error: "Produk aktif tidak ditemukan" };
      }

      publishInventoryChange({
        partnerId: null,
        topics: ["products"],
      });

      return {
        success: true,
        message: "Stok gudang pusat berhasil diperbarui",
        data: updated,
      };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ central_stock: t.Integer({ minimum: 0 }) }),
    },
  );
