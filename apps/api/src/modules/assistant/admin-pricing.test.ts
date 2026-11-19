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

test("fallback admin menjawab harga normal dari aturan aplikasi", () => {
  const reply = composeAdminFallbackReply("Berapa harga seblak?", context, { available: false, predictions: [] }, []);
  expect(reply.reply).toContain("Seblak Jadul Instan: Rp27.500/pcs");
});
