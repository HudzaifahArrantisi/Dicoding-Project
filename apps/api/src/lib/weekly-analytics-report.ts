import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(import.meta.dir, "../../../../data-science/reports/weekly_analytics_summary.json");

export interface WeeklyAnalyticsReport {
  metadata: { generated_at: string; period_days: number; start_date: string; end_date: string };
  network_sales: { total_sold_7d: number; total_sold_prev_7d: number; requested_restock_units: number; approved_restock_units: number };
  products: Array<{ product_id: string; product_name: string; weekly_units: number; share_pct: number }>;
  partners: Array<{ partner_id: string; partner_name: string; province_name: string; regency_name: string; weekly_units: number; log_count: number; active_days: number; critical_frequency: number; stockout_events: number; restock_requests: number }>;
  regions: Array<{ province_name: string; regency_name: string; weekly_units: number; restock_frequency: number; active_partners: number }>;
  warehouse: Array<{ product_id: string; product_name: string; central_stock: number; suggested_factory_batch_order: number }>;
  risk_records: Array<{ partner_id: string; partner_name: string; partner_type: string; product_id: string; product_name: string; product_sku: string; current_qty: number; par_level: number; units_7d: number; daily_velocity: number; days_of_cover: number; critical_events: number; turnover_rate: number; rop: number }>;
  daily_reporting: Array<{ day: string; active_partners: number; log_count: number }>;
  partner_daily_log_breakdown: Array<{ day: string; partner_id: string; partner_name: string; log_count: number }>;
}

export async function loadWeeklyAnalyticsReport(): Promise<WeeklyAnalyticsReport | null> {
  try {
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    if (!value || typeof value !== "object") throw new Error("Laporan Data Science bukan objek");
    const report = value as WeeklyAnalyticsReport;
    if (!report.metadata?.generated_at || !Number.isFinite(Date.parse(report.metadata.generated_at)) ||
      !Array.isArray(report.products) || !Array.isArray(report.partners) || !Array.isArray(report.regions) ||
      !Array.isArray(report.risk_records) || !Array.isArray(report.daily_reporting)) {
      throw new Error("Laporan Data Science tidak valid");
    }
    return report;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
