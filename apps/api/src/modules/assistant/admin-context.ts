import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { orderItems, orders, partners, products, stockLogs } from "../../db/schema";
import { loadWeeklyFacts, type WeeklyFacts } from "./facts";
import { OFFICIAL_PRODUCTS } from "./official-products";
import { getStockStatus, isStale, RETAIL_PRICE_OTHER, RETAIL_PRICE_SEBLAK, retailPriceForProduct } from "@daisuki/shared";
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

export interface AdminLiveProductSales {
  product_name: string;
  unit_price: number;
  central_stock: number;
  sold_today: number;
  revenue_today: number;
  sold_7d: number;
  revenue_7d: number;
  sold_current_week: number;
  revenue_current_week: number;
}

export interface AdminLiveSalesSummary {
  today_date_wib: string;
  current_week_number: number;
  current_week_label: string;
  current_week_start_date: string;
  current_week_end_date: string;
  today_units: number;
  today_revenue: number;
  rolling_7d_units: number;
  rolling_7d_revenue: number;
  current_week_units: number;
  current_week_revenue: number;
  current_week_partner_count: number;
  products: AdminLiveProductSales[];
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
  live_sales?: AdminLiveSalesSummary;
}

export async function loadAdminContext(): Promise<AdminContext> {
  return retryTransientRead(async () => {
    const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const year = nowWib.getUTCFullYear();
    const monthNumber = nowWib.getUTCMonth() + 1;
    const monthStr = `${year}-${String(monthNumber).padStart(2, "0")}`;
    const todayDay = nowWib.getUTCDate();
    const todayDateWib = `${monthStr}-${String(todayDay).padStart(2, "0")}`;
    const currentWeekNumber = todayDay <= 7 ? 1 : todayDay <= 14 ? 2 : todayDay <= 21 ? 3 : 4;
    const weekStartDay = currentWeekNumber === 1 ? 1 : currentWeekNumber === 2 ? 8 : currentWeekNumber === 3 ? 15 : 22;
    const nextYear = monthNumber === 12 ? year + 1 : year;
    const nextMonthNumber = monthNumber === 12 ? 1 : monthNumber + 1;
    const lastDay = new Date(Date.UTC(nextYear, nextMonthNumber - 1, 0)).getUTCDate();
    const weekEndDay = currentWeekNumber === 1 ? 7 : currentWeekNumber === 2 ? 14 : currentWeekNumber === 3 ? 21 : lastDay;
    const weekStartDate = `${monthStr}-${String(weekStartDay).padStart(2, "0")}`;
    const weekEndDate = `${monthStr}-${String(weekEndDay).padStart(2, "0")}`;
    const weekStartIso = `${weekStartDate}T00:00:00+07:00`;
    const nextMonthStartIso = `${nextYear}-${String(nextMonthNumber).padStart(2, "0")}-01T00:00:00+07:00`;
    const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(year, monthNumber - 1, 1)));

    const [
      warehouseRows,
      partnerRows,
      stockRows,
      pendingOrderRows,
      shipmentOrderRows,
      logRows,
      weeklyFacts,
      liveProductSalesRows,
      liveWeekPartnerRows,
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

      // 7. Fakta Analisis Mingguan (snapshot run terbit)
      loadWeeklyFacts(),

      // 8. Penjualan & Omzet Live Per Produk (sinkron dengan /orders/finance/summary & /orders/finance/weekly-history)
      db.execute<{
        product_name: string;
        central_stock: number;
        sold_today: number;
        revenue_today: string;
        sold_7d: number;
        revenue_7d: string;
        sold_current_week: number;
        revenue_current_week: string;
      }>(sql`
        SELECT
          pr.name AS product_name,
          pr.central_stock::int AS central_stock,
          COALESCE(SUM(sl.qty_before - sl.qty_after)
            FILTER (WHERE sl.created_at >= ((now() AT TIME ZONE 'Asia/Jakarta')::date::timestamp AT TIME ZONE 'Asia/Jakarta')), 0)::int AS sold_today,
          COALESCE(SUM((sl.qty_before - sl.qty_after) *
            CASE WHEN pr.sku = 'DSK-SB-001' THEN ${RETAIL_PRICE_SEBLAK}::bigint ELSE ${RETAIL_PRICE_OTHER}::bigint END)
            FILTER (WHERE sl.created_at >= ((now() AT TIME ZONE 'Asia/Jakarta')::date::timestamp AT TIME ZONE 'Asia/Jakarta')), 0)::text AS revenue_today,
          COALESCE(SUM(sl.qty_before - sl.qty_after)
            FILTER (WHERE sl.created_at >= now() - interval '7 days'), 0)::int AS sold_7d,
          COALESCE(SUM((sl.qty_before - sl.qty_after) *
            CASE WHEN pr.sku = 'DSK-SB-001' THEN ${RETAIL_PRICE_SEBLAK}::bigint ELSE ${RETAIL_PRICE_OTHER}::bigint END)
            FILTER (WHERE sl.created_at >= now() - interval '7 days'), 0)::text AS revenue_7d,
          COALESCE(SUM(sl.qty_before - sl.qty_after)
            FILTER (WHERE sl.created_at >= ${weekStartIso}::timestamptz AND sl.created_at < ${nextMonthStartIso}::timestamptz), 0)::int AS sold_current_week,
          COALESCE(SUM((sl.qty_before - sl.qty_after) *
            CASE WHEN pr.sku = 'DSK-SB-001' THEN ${RETAIL_PRICE_SEBLAK}::bigint ELSE ${RETAIL_PRICE_OTHER}::bigint END)
            FILTER (WHERE sl.created_at >= ${weekStartIso}::timestamptz AND sl.created_at < ${nextMonthStartIso}::timestamptz), 0)::text AS revenue_current_week
        FROM products pr
        LEFT JOIN stock_logs sl
          ON sl.product_id = pr.id
          AND sl.source = 'manual_update'
          AND sl.qty_before > sl.qty_after
          AND sl.created_at >= LEAST(now() - interval '7 days', ${weekStartIso}::timestamptz)
        WHERE pr.is_active = true
          AND pr.sku IN ('DSK-SB-001', 'DSK-BR-002', 'DSK-MK-003', 'DSK-KP-004')
        GROUP BY pr.id, pr.name, pr.central_stock
        ORDER BY sold_current_week DESC, sold_7d DESC, pr.name
      `),

      // 9. Jumlah Mitra Aktif Melapor Pada Pekan Berjalan
      db.execute<{ partner_count: number }>(sql`
        SELECT COUNT(DISTINCT sl.partner_id)::int AS partner_count
        FROM stock_logs sl
        JOIN products pr ON pr.id = sl.product_id
        WHERE sl.source = 'manual_update'
          AND sl.qty_before > sl.qty_after
          AND sl.created_at >= ${weekStartIso}::timestamptz
          AND sl.created_at < ${nextMonthStartIso}::timestamptz
          AND pr.sku IN ('DSK-SB-001', 'DSK-BR-002', 'DSK-MK-003', 'DSK-KP-004')
      `),
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

    const liveProducts: AdminLiveProductSales[] = (
      liveProductSalesRows as unknown as Array<{
        product_name: string;
        central_stock: number | string;
        sold_today: number | string;
        revenue_today: string;
        sold_7d: number | string;
        revenue_7d: string;
        sold_current_week: number | string;
        revenue_current_week: string;
      }>
    ).map((row) => ({
      product_name: String(row.product_name),
      unit_price: retailPriceForProduct(String(row.product_name)) ?? RETAIL_PRICE_OTHER,
      central_stock: Number(row.central_stock),
      sold_today: Number(row.sold_today),
      revenue_today: Number(row.revenue_today),
      sold_7d: Number(row.sold_7d),
      revenue_7d: Number(row.revenue_7d),
      sold_current_week: Number(row.sold_current_week),
      revenue_current_week: Number(row.revenue_current_week),
    }));

    const livePartnerRow = (liveWeekPartnerRows as unknown as Array<{ partner_count: number | string }>)[0];
    const liveSales: AdminLiveSalesSummary = {
      today_date_wib: todayDateWib,
      current_week_number: currentWeekNumber,
      current_week_label: `Minggu ${currentWeekNumber} (${weekStartDay}–${weekEndDay} ${monthLabel})`,
      current_week_start_date: weekStartDate,
      current_week_end_date: weekEndDate,
      today_units: liveProducts.reduce((s, p) => s + p.sold_today, 0),
      today_revenue: liveProducts.reduce((s, p) => s + p.revenue_today, 0),
      rolling_7d_units: liveProducts.reduce((s, p) => s + p.sold_7d, 0),
      rolling_7d_revenue: liveProducts.reduce((s, p) => s + p.revenue_7d, 0),
      current_week_units: liveProducts.reduce((s, p) => s + p.sold_current_week, 0),
      current_week_revenue: liveProducts.reduce((s, p) => s + p.revenue_current_week, 0),
      current_week_partner_count: Number(livePartnerRow?.partner_count ?? 0),
      products: liveProducts,
    };

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
      live_sales: liveSales,
    };
  });
}
