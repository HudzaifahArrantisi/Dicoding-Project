import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { orderItems, orders, partners, products, stockLogs } from "../../db/schema";
import { loadWeeklyFacts, type WeeklyFacts } from "./facts";
import { OFFICIAL_PRODUCTS, isOfficialProduct } from "./official-products";

export interface ModelRecord {
  partner_id: string;
  partner_name: string;
  partner_type: string;
  product_id: string;
  product_name: string;
  current_qty: number;
  par_level: number;
  central_stock: number;
  sold_7d: number;
  sold_prev_7d: number;
  sold_30d: number;
  report_count: number;
  critical_count: number;
  requested_30d: number;
  approved_30d: number;
  has_active_order: boolean;
  updated_at: Date;
}

export async function loadMitraContext(partnerId: string) {
  const [stockRows, [partner], latestOrders, activeOrders, latestLogs, weeklyFacts] = await Promise.all([
    db.execute(sql<ModelRecord>`
      with sales as (
        select product_id,
          coalesce(sum(qty_before - qty_after) filter (where created_at >= now() - interval '7 days'), 0)::int as sold_7d,
          coalesce(sum(qty_before - qty_after) filter (where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days'), 0)::int as sold_prev_7d,
          coalesce(sum(qty_before - qty_after), 0)::int as sold_30d,
          count(*)::int as report_count
        from stock_logs
        where partner_id = ${partnerId}::uuid and source = 'manual_update'
          and qty_before > qty_after and created_at >= now() - interval '30 days'
        group by product_id
      ), critical as (
        select ps.product_id, count(sl.id)::int as critical_count
        from partner_stocks ps
        left join stock_logs sl on sl.partner_id = ps.partner_id and sl.product_id = ps.product_id
          and sl.created_at >= now() - interval '30 days'
          and sl.qty_after <= greatest(10, ps.par_level * 0.2)
        where ps.partner_id = ${partnerId}::uuid
        group by ps.product_id
      ), order_summary as (
        select oi.product_id,
          coalesce(sum(oi.qty_requested) filter (where o.created_at >= now() - interval '30 days'), 0)::int as requested_30d,
          coalesce(sum(oi.qty_approved) filter (where o.created_at >= now() - interval '30 days' and o.status in ('disetujui', 'dalam_pengiriman', 'selesai')), 0)::int as approved_30d,
          bool_or(o.status in ('diproses', 'disetujui', 'dalam_pengiriman')) as has_active_order
        from orders o join order_items oi on oi.order_id = o.id
        where o.partner_id = ${partnerId}::uuid
          and (o.created_at >= now() - interval '30 days' or o.status in ('diproses', 'disetujui', 'dalam_pengiriman'))
        group by oi.product_id
      )
      select ps.partner_id::text, pa.name as partner_name, pa.type::text as partner_type,
        ps.product_id::text, pr.name as product_name, ps.current_qty, ps.par_level,
        pr.central_stock, ps.updated_at,
        coalesce(s.sold_7d, 0)::int as sold_7d,
        coalesce(s.sold_prev_7d, 0)::int as sold_prev_7d,
        coalesce(s.sold_30d, 0)::int as sold_30d,
        coalesce(s.report_count, 0)::int as report_count,
        coalesce(c.critical_count, 0)::int as critical_count,
        coalesce(os.requested_30d, 0)::int as requested_30d,
        coalesce(os.approved_30d, 0)::int as approved_30d,
        coalesce(os.has_active_order, false) as has_active_order
      from partner_stocks ps
      join partners pa on pa.id = ps.partner_id and pa.is_active = true
      join products pr on pr.id = ps.product_id and pr.is_active = true
        and pr.name in ('Seblak Jadul Instan', 'Basreng Daun Jeruk', 'Makaroni Daun Jeruk', 'Keripik Pisang Rasa Coklat')
      left join sales s on s.product_id = ps.product_id
      left join critical c on c.product_id = ps.product_id
      left join order_summary os on os.product_id = ps.product_id
      where ps.partner_id = ${partnerId}::uuid
      order by pr.name
    `),
    db.select({ name: partners.name, type: partners.type, type_other: partners.type_other, pic_name: partners.pic_name, pic_phone: partners.pic_phone, address: partners.address, province_name: partners.province_name, regency_name: partners.regency_name, district_name: partners.district_name, village_name: partners.village_name }).from(partners).where(eq(partners.id, partnerId)).limit(1),
    db.select({ id: orders.id, order_no: orders.order_no, status: orders.status, created_at: orders.created_at, admin_note: orders.admin_note }).from(orders).where(eq(orders.partner_id, partnerId)).orderBy(desc(orders.created_at)).limit(3),
    db.select({ id: orders.id, order_no: orders.order_no, status: orders.status, created_at: orders.created_at, admin_note: orders.admin_note }).from(orders).where(and(eq(orders.partner_id, partnerId), inArray(orders.status, ["diproses", "disetujui", "dalam_pengiriman"]))).orderBy(desc(orders.created_at)).limit(10),
    db.select({ product_name: products.name, qty_before: stockLogs.qty_before, qty_after: stockLogs.qty_after, source: stockLogs.source, created_at: stockLogs.created_at }).from(stockLogs).innerJoin(products, eq(stockLogs.product_id, products.id)).where(and(eq(stockLogs.partner_id, partnerId), eq(products.is_active, true), inArray(products.name, OFFICIAL_PRODUCTS))).orderBy(desc(stockLogs.created_at)).limit(10),
    loadWeeklyFacts(),
  ]);
  const stocks: ModelRecord[] = Array.from(stockRows, (row) => ({
    partner_id: String(row.partner_id),
    partner_name: String(row.partner_name),
    partner_type: String(row.partner_type),
    product_id: String(row.product_id),
    product_name: String(row.product_name),
    current_qty: Number(row.current_qty),
    par_level: Number(row.par_level),
    central_stock: Number(row.central_stock),
    sold_7d: Number(row.sold_7d),
    sold_prev_7d: Number(row.sold_prev_7d),
    sold_30d: Number(row.sold_30d),
    report_count: Number(row.report_count),
    critical_count: Number(row.critical_count),
    requested_30d: Number(row.requested_30d),
    approved_30d: Number(row.approved_30d),
    has_active_order: row.has_active_order === true,
    updated_at: row.updated_at instanceof Date ? row.updated_at : new Date(String(row.updated_at)),
  }));
  const relevantOrders = [...new Map([...latestOrders, ...activeOrders].map((order) => [order.id, order])).values()];
  const orderRows = relevantOrders.length ? await db.select({
    order_id: orderItems.order_id,
    product_name: products.name,
    qty_requested: orderItems.qty_requested,
    qty_approved: orderItems.qty_approved,
  }).from(orderItems)
    .innerJoin(products, eq(orderItems.product_id, products.id))
    .where(and(inArray(orderItems.order_id, relevantOrders.map((order) => order.id)), inArray(products.name, OFFICIAL_PRODUCTS))) : [];
  const ordersWithItems = relevantOrders.map((order) => ({
    ...order,
    items: orderRows.filter((item) => item.order_id === order.id).map(({ product_name, qty_requested, qty_approved }) => ({ product_name, qty_requested, qty_approved })),
  }));
  const filteredFacts: WeeklyFacts | null = weeklyFacts ? {
    ...weeklyFacts,
    central_warehouse: {
      ...weeklyFacts.central_warehouse,
      products: weeklyFacts.central_warehouse.products.filter((item) => isOfficialProduct(item.name)),
      total_stock_units: weeklyFacts.central_warehouse.products.filter((item) => isOfficialProduct(item.name)).reduce((total, item) => total + item.central_stock, 0),
    },
    top_selling_products: weeklyFacts.top_selling_products.filter((item) => isOfficialProduct(item.product_name)),
    top_performers_partners: [],
    top_log_partners: [],
    regional_hotspots: [],
  } : null;
  return { stocks, partner, orders: ordersWithItems, logs: latestLogs, weeklyFacts: filteredFacts };
}

export type MitraContext = Awaited<ReturnType<typeof loadMitraContext>>;
