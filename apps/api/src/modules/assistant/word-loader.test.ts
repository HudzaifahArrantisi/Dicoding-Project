import { expect, test } from "bun:test";
import { getProductAliases, isGreeting, isIdentityQuery, isOutOfScope, matchTourIntent } from "./word-loader";
import { answerMitraQuestion } from "./knowledge";
import { shouldRefuseMitraMessage } from "./guardrails";

test("kamus eksternal mengenali salam, identitas, produk, dan panduan", () => {
  expect(isGreeting("halo")).toBe(true);
  expect(isIdentityQuery("siapa kah anda")).toBe(true);
  expect(isIdentityQuery("kamu membantu apa")).toBe(true);
  expect(shouldRefuseMitraMessage("kamu membantu apa", null)).toBe(false);
  expect(getProductAliases().get("Seblak Jadul Instan")).toContain("seblak");
  expect(matchTourIntent("stok seblak sisa berapa")).toBe("stock_report");
  expect(answerMitraQuestion("stok seblak sisa berapa").suggestedTour).toBe("stock_report");
});

test("pertanyaan di luar inventaris ditolak sebelum masuk LLM", () => {
  for (const message of ["bagaimana cara membuat rendang", "siapa presiden"]) {
    expect(isOutOfScope(message)).toBe(true);
    expect(shouldRefuseMitraMessage(message, null)).toBe(true);
  }
});
