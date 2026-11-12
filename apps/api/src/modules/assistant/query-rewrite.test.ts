import { expect, test } from "bun:test";
import { needsQueryRewrite, rewriteMitraQuery } from "./query-rewrite";
import type { SessionTurn } from "./session-memory";

const previous: SessionTurn = {
  id: "turn-1", message: "Berapa stok Basreng?", reply: "Stok cabang 100 pcs.",
  intent: "own_stock", source: "llm", feedback: null, created_at: new Date(),
};

test("penulisan ulang hanya dipanggil untuk rujukan yang bergantung pada riwayat", async () => {
  expect(needsQueryRewrite("berapa stok di gudang saya?", [])).toBe(false);
  expect(needsQueryRewrite("berapa stok di gudang saya?", [previous])).toBe(true);
  expect(needsQueryRewrite("berapa stok pusat Basreng?", [previous])).toBe(false);
  expect(await rewriteMitraQuery("berapa stok di gudang saya?", [], "")).toBe("berapa stok di gudang saya?");
});
