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
          status: orders.status,
          note: orders.note,
          admin_note: orders.admin_note,
          rejected_reason: orders.rejected_reason,
          created_at: orders.created_at,
          approved_at: orders.approved_at,
          shipped_at: orders.shipped_at,
          completed_at: orders.completed_at,
          receipt_photo_present: sql<boolean>`${orders.receipt_photo_data_url} is not null`,
          receipt_proof_requested_at: orders.receipt_proof_requested_at,
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
        .select({ name: partners.name })
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

      await db.transaction(async (tx) => {
        const [ord] = await tx
          .insert(orders)
          .values({
            order_no: orderNo,
            partner_id: partnerId,
            status: "diproses",
            note: body.note || null,
            created_by: user.userId,
          })
          .returning();

        const itemValues = body.items.map((item) => ({
          order_id: ord.id,
          product_id: item.product_id,
          qty_requested: item.qty_requested,
          qty_approved: null,
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
          body: `${partner.name} mengajukan restock untuk ${body.items.length} jenis produk. Pesanan menunggu persetujuan pusat.`,
        });

        return {
          ...ord,
          status_label: ORDER_STATUS_LABEL["diproses"],
          items: insertedItems,
        };
      });

      publishInventoryChange({
        partnerId,
        topics: ["orders", "metrics", "notifications"],
      });

      return { status: "ok" };
    },
    {
      body: t.Object({
        note: t.Optional(t.String()),
        items: t.Array(
          t.Object({
            product_id: t.String(),
            qty_requested: t.Integer({ minimum: 1 }),
          }),
        ),
      }),
    },
  )
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
              central_stock: products.central_stock,
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
            if (approvedQty > item.central_stock) {
              throw new OrderWorkflowError(
                409,
                `Stok pusat ${item.product_name} hanya tersedia ${item.central_stock} ${item.product_unit}`,
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

          for (const item of body.items) {
            await tx
              .update(orderItems)
              .set({ qty_approved: item.qty_approved })
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
        if (!(
          (ord.status === "dalam_pengiriman" && targetStatus === "selesai") ||
          (ord.status === "diproses" && targetStatus === "dibatalkan")
        )) {
          set.status = 403;
          return {
            error: `Mitra tidak diizinkan mengubah status dari '${ord.status}' menjadi '${targetStatus}'`,
          };
        }
      } else {
        const adminTransitionAllowed =
          (ord.status === "diproses" && targetStatus === "ditolak") ||
          (ord.status === "disetujui" && targetStatus === "dalam_pengiriman");

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

      try {
        await db.transaction(async (tx) => {
          const [lockedOrder] = await tx
            .select()
            .from(orders)
            .where(eq(orders.id, orderId))
            .for("update");

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
                product_id: orderItems.product_id,
                product_name: products.name,
                product_unit: products.unit,
                qty_approved: orderItems.qty_approved,
              })
              .from(orderItems)
              .innerJoin(products, eq(orderItems.product_id, products.id))
              .where(eq(orderItems.order_id, orderId));

            for (const item of shipmentItems) {
              const approvedQty = item.qty_approved;
              if (approvedQty === null) {
                throw new CentralStockConflictError(
                  `Jumlah persetujuan ${item.product_name} belum tersedia`,
                );
              }

              const [centralProduct] = await tx
                .select({ central_stock: products.central_stock })
                .from(products)
                .where(eq(products.id, item.product_id))
                .for("update");

              if (
                !centralProduct ||
                centralProduct.central_stock < approvedQty
              ) {
                throw new CentralStockConflictError(
                  `Stok pusat ${item.product_name} hanya tersedia ${centralProduct?.central_stock ?? 0} ${item.product_unit}. Revisi jumlah persetujuan sebelum mengirim.`,
                );
              }

              await tx
                .update(products)
                .set({
                  central_stock: sql`${products.central_stock} - ${approvedQty}`,
                })
                .where(eq(products.id, item.product_id));
            }
            updateData.shipped_at = new Date();
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
            } else {
              updateData.receipt_photo_data_url = null;
            }
          } else if (targetStatus === "ditolak") {
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
              type: hasReceiptPhoto ? "order_update" : "receipt_missing_proof",
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
              notifBody = `Barang pesanan Anda sedang dalam pengiriman. Mohon klik "Barang Diterima" saat paket tiba.`;
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
      }

      publishInventoryChange({
        partnerId: ord.partner_id,
        topics:
          targetStatus === "selesai"
            ? ["orders", "stocks", "logs", "metrics", "notifications"]
            : ["orders", "metrics", "notifications"],
      });
      if (targetStatus === "dalam_pengiriman") {
        publishInventoryChange({
          partnerId: null,
          topics: ["products"],
        });
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
