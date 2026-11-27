import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { orderItems, orders, partners, products, stockLogs } from "../../db/schema";
import { loadWeeklyFacts, type WeeklyFacts } from "./facts";
import { OFFICIAL_PRODUCTS } from "./official-products";
import { getStockStatus, isStale } from "@daisuki/shared";
import { retryTransientRead } from "../../lib/db-retry";

export interface AdminWarehouseStock {
  id: string;
  name: string;
  sku: string;
  central_stock: number;
  unit: string;
}

export interface AdminCriticalBranchItem {
  partner_id: string;
  partner_name: string;
  partner_type: string;
  city: string;
  province: string;
  product_name: string;
  current_qty: number;
  par_level: number;
  status: "aman" | "waspada" | "kritis";
  is_stale: boolean;
  sold_7d: number;
}

export interface AdminPendingOrder {
  order_id: string;
  order_no: string;
  partner_name: string;
  partner_city: string;
  created_at: string;
  note: string | null;
  items: Array<{ product_name: string; qty_requested: number }>;
}

export interface AdminActiveShipment {
  order_id: string;
  order_no: string;
  partner_name: string;
  shipped_at: string | null;
  items: Array<{ product_name: string; qty_approved: number | null }>;
}

export interface AdminRecentLog {
  partner_name: string;
  product_name: string;
  qty_before: number;
  qty_after: number;
  source: string;
  created_at: string;
}

export interface AdminPartnerSummary {
  partner_id: string;
  partner_name: string;
  partner_type: string;
  city: string;
  province: string;
  stocks: Array<{
    product_name: string;
    current_qty: number;
    par_level: number;
    status: "aman" | "waspada" | "kritis";
    sold_7d: number;
    logs_7d?: number;
  }>;
}

export interface AdminContext {
  warehouse: AdminWarehouseStock[];
  summary: {
    total_active_partners: number;
    critical_branches_count: number;
    warning_branches_count: number;
    safe_branches_count: number;
    stale_branches_count: number;
    pending_orders_count: number;
    active_shipments_count: number;
    total_central_stock: number;
  };
  critical_branches: AdminCriticalBranchItem[];
  pending_orders: AdminPendingOrder[];
  active_shipments: AdminActiveShipment[];
  recent_logs: AdminRecentLog[];
  partners_overview: AdminPartnerSummary[];
  weekly_facts: WeeklyFacts | null;
}

export async function loadAdminContext(): Promise<AdminContext> {
  return retryTransientRead(async () => {
    const [
      warehouseRows,
      partnerRows,
      stockRows,
      pendingOrderRows,
      shipmentOrderRows,
      logRows,
      weeklyFacts,
    ] = await Promise.all([
      // 1. Gudang Pusat
      db.select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        central_stock: products.central_stock,
        unit: products.unit,
      })
      .from(products)
      .where(and(eq(products.is_active, true), inArray(products.name, OFFICIAL_PRODUCTS)))
      .orderBy(products.name),

      // 2. Seluruh Mitra Aktif
      db.select({
        id: partners.id,
        name: partners.name,
        type: partners.type,
        regency_name: partners.regency_name,
        province_name: partners.province_name,
      })
      .from(partners)
      .where(eq(partners.is_active, true))
      .orderBy(partners.name),

      // 3. Stok Mitra Seluruh Cabang + Konsumsi 7 Hari
      db.execute(sql<{
        partner_id: string;
        partner_name: string;
        partner_type: string;
        city: string;
        province: string;
        product_id: string;
        product_name: string;
        current_qty: number;
        par_level: number;
        updated_at: Date;
        sold_7d: number;
        logs_7d: number;
      }>`
        WITH sales AS (
          SELECT partner_id, product_id,
            COALESCE(SUM(qty_before - qty_after) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0)::int AS sold_7d,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS logs_7d
          FROM stock_logs
          WHERE source = 'manual_update' AND qty_before > qty_after AND created_at >= NOW() - INTERVAL '7 days'
          GROUP BY partner_id, product_id
        )
        SELECT 
          ps.partner_id::text, pa.name AS partner_name, pa.type::text AS partner_type,
          COALESCE(pa.regency_name, '-')::text AS city, COALESCE(pa.province_name, '-')::text AS province,
          ps.product_id::text, pr.name AS product_name, ps.current_qty::int, ps.par_level::int,
          ps.updated_at, COALESCE(s.sold_7d, 0)::int AS sold_7d, COALESCE(s.logs_7d, 0)::int AS logs_7d
        FROM partner_stocks ps
        JOIN partners pa ON pa.id = ps.partner_id AND pa.is_active = true
        JOIN products pr ON pr.id = ps.product_id AND pr.is_active = true
          AND pr.name IN ('Seblak Jadul Instan', 'Basreng Daun Jeruk', 'Makaroni Daun Jeruk', 'Keripik Pisang Rasa Coklat')
        LEFT JOIN sales s ON s.partner_id = ps.partner_id AND s.product_id = ps.product_id
        ORDER BY pa.name, pr.name
      `),

      // 4. Pesanan Menunggu Approval Admin
      db.select({
        id: orders.id,
        order_no: orders.order_no,
        partner_name: partners.name,
        partner_city: partners.regency_name,
        created_at: orders.created_at,
        note: orders.note,
      })
      .from(orders)
      .innerJoin(partners, eq(orders.partner_id, partners.id))
      .where(sql`${orders.status}::text in ('ditunda', 'diproses')`)
      .orderBy(desc(orders.created_at))
      .limit(20),

      // 5. Pesanan Dalam Pengiriman
      db.select({
        id: orders.id,
        order_no: orders.order_no,
        partner_name: partners.name,
        shipped_at: orders.shipped_at,
      })
      .from(orders)
      .innerJoin(partners, eq(orders.partner_id, partners.id))
      .where(eq(orders.status, "dalam_pengiriman"))
      .orderBy(desc(orders.shipped_at))
      .limit(15),

      // 6. Log Mutasi Stok Terbaru Seluruh Cabang
      db.select({
        partner_name: partners.name,
        product_name: products.name,
        qty_before: stockLogs.qty_before,
        qty_after: stockLogs.qty_after,
        source: stockLogs.source,
        created_at: stockLogs.created_at,
      })
      .from(stockLogs)
      .innerJoin(partners, eq(stockLogs.partner_id, partners.id))
      .innerJoin(products, eq(stockLogs.product_id, products.id))
      .where(inArray(products.name, OFFICIAL_PRODUCTS))
      .orderBy(desc(stockLogs.created_at))
      .limit(20),

      // 7. Fakta Analisis Mingguan
      loadWeeklyFacts(),
    ]);

    // Ambil item pesanan untuk pending dan shipments
    const rawStockRows = (stockRows as unknown as Array<{
      partner_id: string;
      partner_name: string;
      partner_type: string;
      city: string;
      province: string;
      product_id: string;
      product_name: string;
      current_qty: number | string;
      par_level: number | string;
      updated_at: Date | string;
      sold_7d: number | string;
      logs_7d?: number | string;
    }>);

    const orderIds = [...pendingOrderRows.map((o) => o.id), ...shipmentOrderRows.map((o) => o.id)];
    const items = orderIds.length ? await db.select({
      order_id: orderItems.order_id,
      product_name: products.name,
      qty_requested: orderItems.qty_requested,
      qty_approved: orderItems.qty_approved,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.product_id, products.id))
    .where(and(inArray(orderItems.order_id, orderIds), inArray(products.name, OFFICIAL_PRODUCTS))) : [];

    const itemsByOrder = new Map<string, typeof items>();
    for (const item of items) {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push(item);
      itemsByOrder.set(item.order_id, list);
    }

    const pendingOrders: AdminPendingOrder[] = pendingOrderRows.map((o) => ({
      order_id: o.id,
      order_no: o.order_no,
      partner_name: o.partner_name,
      partner_city: o.partner_city || "-",
      created_at: o.created_at.toISOString(),
      note: o.note,
      items: (itemsByOrder.get(o.id) ?? []).map((i) => ({ product_name: i.product_name, qty_requested: i.qty_requested })),
    }));

    const activeShipments: AdminActiveShipment[] = shipmentOrderRows.map((o) => ({
      order_id: o.id,
      order_no: o.order_no,
      partner_name: o.partner_name,
      shipped_at: o.shipped_at ? o.shipped_at.toISOString() : null,
      items: (itemsByOrder.get(o.id) ?? []).map((i) => ({ product_name: i.product_name, qty_approved: i.qty_approved })),
    }));

    // Kelompokkan stok mitra
    const criticalBranches: AdminCriticalBranchItem[] = [];
    const partnerOverviewMap = new Map<string, AdminPartnerSummary>();
    let criticalPartnersCount = 0;
    let warningPartnersCount = 0;
    let safePartnersCount = 0;
    let stalePartnersCount = 0;

    const partnerWorstStatus = new Map<string, "aman" | "waspada" | "kritis">();
    const partnerHasStale = new Map<string, boolean>();

    for (const row of rawStockRows) {
      const status = getStockStatus(Number(row.current_qty), Number(row.par_level));
      const stale = isStale(new Date(row.updated_at));

      if (status === "kritis") {
        criticalBranches.push({
          partner_id: String(row.partner_id),
          partner_name: String(row.partner_name),
          partner_type: String(row.partner_type),
          city: String(row.city),
          province: String(row.province),
          product_name: String(row.product_name),
          current_qty: Number(row.current_qty),
          par_level: Number(row.par_level),
          status,
          is_stale: stale,
          sold_7d: Number(row.sold_7d),
        });
      }

      // Track partner worst status
      const prevWorst = partnerWorstStatus.get(row.partner_id);
      if (!prevWorst || status === "kritis" || (status === "waspada" && prevWorst === "aman")) {
        partnerWorstStatus.set(row.partner_id, status);
      }
      if (stale) {
        partnerHasStale.set(row.partner_id, true);
      }

      // Group into partner summary
      let summary = partnerOverviewMap.get(row.partner_id);
      if (!summary) {
        summary = {
          partner_id: String(row.partner_id),
          partner_name: String(row.partner_name),
          partner_type: String(row.partner_type),
          city: String(row.city),
          province: String(row.province),
          stocks: [],
        };
        partnerOverviewMap.set(row.partner_id, summary);
      }
      summary.stocks.push({
        product_name: String(row.product_name),
        current_qty: Number(row.current_qty),
        par_level: Number(row.par_level),
        status,
        sold_7d: Number(row.sold_7d),
        logs_7d: Number(row.logs_7d ?? 0),
      });
    }

    for (const [, status] of partnerWorstStatus) {
      if (status === "kritis") criticalPartnersCount++;
      else if (status === "waspada") warningPartnersCount++;
      else safePartnersCount++;
    }
    for (const [, hasStale] of partnerHasStale) {
      if (hasStale) stalePartnersCount++;
    }

    const warehouseStocks: AdminWarehouseStock[] = warehouseRows.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      central_stock: p.central_stock,
      unit: p.unit,
    }));

    const totalCentralStock = warehouseStocks.reduce((sum, item) => sum + item.central_stock, 0);

    return {
      warehouse: warehouseStocks,
      summary: {
        total_active_partners: partnerRows.length,
        critical_branches_count: criticalPartnersCount,
        warning_branches_count: warningPartnersCount,
        safe_branches_count: safePartnersCount,
        stale_branches_count: stalePartnersCount,
        pending_orders_count: pendingOrders.length,
        active_shipments_count: activeShipments.length,
        total_central_stock: totalCentralStock,
      },
      critical_branches: criticalBranches,
      pending_orders: pendingOrders,
      active_shipments: activeShipments,
      recent_logs: logRows.map((l) => ({
        partner_name: l.partner_name,
        product_name: l.product_name,
        qty_before: l.qty_before,
        qty_after: l.qty_after,
        source: l.source,
        created_at: l.created_at.toISOString(),
      })),
      partners_overview: Array.from(partnerOverviewMap.values()),
      weekly_facts: weeklyFacts,
    };
  });
}
