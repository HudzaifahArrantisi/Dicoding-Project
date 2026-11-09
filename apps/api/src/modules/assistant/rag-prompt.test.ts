import { expect, test } from "bun:test";
import type { MitraContext } from "./context";
import type { ModelResult } from "./model";
import { buildMitraRagPrompt, isGroundedLlmReply } from "./rag-prompt";

const context = {
  partner: { name: "Toko A", type: "kafe", type_other: null, pic_name: "Sari", pic_phone: null, address: null, province_name: null, regency_name: "Bandung", district_name: null, village_name: null },
  stocks: [{
    partner_id: "p1", partner_name: "Toko A", partner_type: "kafe", product_id: "b1", product_name: "Basreng Daun Jeruk",
    current_qty: 8, par_level: 50, central_stock: 90, sold_7d: 35, sold_prev_7d: 0, sold_30d: 35,
    report_count: 7, critical_count: 1, requested_30d: 0, approved_30d: 0, has_active_order: true, updated_at: new Date(),
  }],
  orders: [{ id: "o1", order_no: "PO-TEST-123", status: "dalam_pengiriman", created_at: new Date(), admin_note: null, items: [{ product_name: "Basreng Daun Jeruk", qty_requested: 12, qty_approved: 10 }] }],
  logs: [], weeklyFacts: null,
} as MitraContext;
const model: ModelResult = { available: true, predictions: [{ product_id: "b1", label: "urgent_restock", confidence: 0.91 }] };

test("prompt memakai fakta mitra dan model tanpa batas stok tetap", () => {
  const prompt = buildMitraRagPrompt(context, model, "restock");
  expect(prompt).toContain('"current_stock":8');
  expect(prompt).toContain('"model_risk_prediction":"urgent_restock"');
  expect(prompt).toContain('"order_no":"PO-TEST-123"');
  expect(prompt).toContain("Stok toko tidak memiliki batas maksimum tetap");
  expect(prompt).not.toContain("40 pcs");
});

test("memori percakapan dipisah dari fakta operasional terbaru", () => {
  const prompt = buildMitraRagPrompt(context, model, "restock", { summary: "Mitra ingin memantau produk ini", recent: "Mitra: Bagaimana dengan itu?" });
  expect(prompt).toContain("MEMORI_PERCAKAPAN");
  expect(prompt).toContain("bukan bukti angka stok");
  expect(prompt).toContain("Mitra: Bagaimana dengan itu?");
});

test("jawaban LLM dengan angka atau PO di luar fakta ditolak", () => {
  expect(isGroundedLlmReply("Basreng Daun Jeruk tersisa 8 pcs. Pesanan PO-TEST-123 sedang dalam pengiriman.", context, model)).toBe(true);
  expect(isGroundedLlmReply("Basreng Daun Jeruk tersisa 99 pcs.", context, model)).toBe(false);
  expect(isGroundedLlmReply("Pesanan PO-KARANGAN-999 sedang dikirim.", context, model)).toBe(false);
  expect(isGroundedLlmReply("Basreng baru tersisa 8 pcs.", context, model)).toBe(false);
  expect(isGroundedLlmReply("Basreng Daun Jeruk: sisa stok 90 pcs di toko.", context, model)).toBe(false);
  expect(isGroundedLlmReply("PO-TEST-123 sudah selesai.", context, model)).toBe(false);
  expect(isGroundedLlmReply("Stok Basreng Daun Jeruk aman.", context, model)).toBe(false);
  expect(isGroundedLlmReply("Saya sudah membuat pesanan untuk toko Anda.", context, model)).toBe(false);
});

test("produk di luar empat nama resmi tidak masuk konteks RAG", () => {
  const mixed = { ...context, stocks: [...context.stocks, { ...context.stocks[0], product_id: "x", product_name: "Produk Lain" }] } as MitraContext;
  const prompt = buildMitraRagPrompt(mixed, model);
  expect(prompt).not.toContain("Produk Lain");
});

test("prompt memuat identitas resmi model daisuki.pkl", () => {
  const prompt = buildMitraRagPrompt(context, model);
  expect(prompt).toContain('"artifact":"daisuki.pkl"');
  expect(prompt).toContain('"algorithm":"Multinomial Naive Bayes"');
  expect(prompt).toContain("Daisuki AI Assistant");
});

