import { expect, test } from "bun:test";
import type { AdminContext } from "./admin-context";
import { composeAdminFallbackReply } from "./admin-compose";
import { buildAdminRagPrompt } from "./admin-prompt";

const context: AdminContext = {
  warehouse: [{ id: "s1", name: "Seblak Jadul Instan", sku: "DSK-SB-001", central_stock: 10, unit: "pcs" }],
  summary: {
    total_active_partners: 0, critical_branches_count: 0, warning_branches_count: 0,
    safe_branches_count: 0, stale_branches_count: 0, pending_orders_count: 0,
    active_shipments_count: 0, total_central_stock: 10,
  },
  critical_branches: [], pending_orders: [], active_shipments: [], recent_logs: [],
  partners_overview: [], weekly_facts: null,
};

test("prompt admin memuat harga normal resmi untuk seluruh produk", () => {
  const prompt = buildAdminRagPrompt({ context, model: { available: false, predictions: [] }, knowledgeExcerpts: [] });
  expect(prompt).toContain('"Seblak Jadul Instan":27500');
  expect(prompt).toContain('"Keripik Pisang Rasa Coklat":25000');
  expect(prompt).toContain('"retail_unit_price":27500');
});

test("prompt admin memprioritaskan penjualan_dan_omzet_realtime_live di atas snapshot analisis", () => {
  const liveContext: AdminContext = {
    ...context,
    live_sales: {
      today_date_wib: "2026-11-28",
      current_week_number: 4,
      current_week_label: "Minggu 4 (22–30 November 2026)",
      current_week_start_date: "2026-11-22",
      current_week_end_date: "2026-11-30",
      today_units: 10,
      today_revenue: 250_000,
      rolling_7d_units: 7_000,
      rolling_7d_revenue: 179_000_000,
      current_week_units: 7_426,
      current_week_revenue: 190_277_500,
      current_week_partner_count: 102,
      products: [
        {
          product_name: "Seblak Jadul Instan",
          unit_price: 27_500,
          central_stock: 996,
          sold_today: 10,
          revenue_today: 275_000,
          sold_7d: 1_800,
          revenue_7d: 49_500_000,
          sold_current_week: 1_850,
          revenue_current_week: 50_875_000,
        },
      ],
    },
  };
  const prompt = buildAdminRagPrompt({ context: liveContext, model: { available: false, predictions: [] }, knowledgeExcerpts: [] });
  expect(prompt).toContain('"current_week_units":7426');
  expect(prompt).toContain('"current_week_revenue":190277500');
  expect(prompt).toContain('"penjualan_dan_omzet_realtime_live"');
  expect(prompt).toContain("Minggu 4 (22–30 November 2026)");
});

test("fallback admin menjawab harga normal dari aturan aplikasi", () => {
  const reply = composeAdminFallbackReply("Berapa harga seblak?", context, { available: false, predictions: [] }, []);
  expect(reply.reply).toContain("Seblak Jadul Instan: Rp27.500/pcs");
});
