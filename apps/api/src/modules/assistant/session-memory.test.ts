import { expect, test } from "bun:test";
import { addSessionTurn, buildConversationContext, endSession, extractUserGoals, getSession, sessionKey, summarizeSession } from "./session-memory";

function turn(id: string, message: string, reply = "Jawaban") {
  return { id, message, reply, intent: null, source: "llm" as const, feedback: null, created_at: new Date() };
}

test("memori sesi terpisah per mitra dan berakhir tanpa menghapus sesi lain", () => {
  const first = sessionKey("mitra-a", "user-a");
  const second = sessionKey("mitra-b", "user-b");
  addSessionTurn(first, turn("1", "Saya ingin memantau stok setiap pagi"));
  addSessionTurn(second, turn("2", "Bagaimana status kiriman saya?"));
  expect(getSession(first).map((item) => item.id)).toEqual(["1"]);
  expect(endSession(first)).toHaveLength(1);
  expect(getSession(first)).toEqual([]);
  expect(getSession(second)).toHaveLength(1);
  endSession(second);
});

test("konteks aktif terbatas dan ringkasan tujuan mengabaikan sapaan", () => {
  const key = sessionKey("mitra-c", "user-c");
  addSessionTurn(key, turn("1", "halo"));
  addSessionTurn(key, turn("2", "Saya ingin cek restock Basreng Daun Jeruk", "Bisa saya bantu cek."));
  const turns = getSession(key);
  expect(buildConversationContext(turns)).toContain("Asisten: Bisa saya bantu cek.");
  expect(extractUserGoals(turns)).toContain("Saya ingin cek restock Basreng Daun Jeruk");
  expect(extractUserGoals(turns)).not.toContain("halo");
  endSession(key);
});

test("tujuan mitra tetap tersimpan saat 9Router tidak aktif", async () => {
  const enabled = process.env.LLM_ENABLED;
  process.env.LLM_ENABLED = "false";
  try {
    const summary = await summarizeSession([turn("1", "Saya ingin memantau stok Basreng Daun Jeruk")], "");
    expect(summary).toContain("Saya ingin memantau stok Basreng Daun Jeruk");
  } finally {
    if (enabled === undefined) delete process.env.LLM_ENABLED;
    else process.env.LLM_ENABLED = enabled;
  }
});
