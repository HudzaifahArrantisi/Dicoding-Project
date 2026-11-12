import { expect, test } from "bun:test";
import { getProductAliases, isGreeting, isIdentityQuery, isOutOfScope, matchTourIntent } from "./word-loader";
import { answerMitraQuestion } from "./knowledge";
import { shouldRefuseMitraMessage } from "./guardrails";
import { loadAssistantFixture } from "./test-data";

type WordLoaderFixture = { greeting: string; identity: string; identity_help: string; product_alias: { product: string; alias: string }; stock_question: string; out_of_scope: string[] };
const fixture = loadAssistantFixture<WordLoaderFixture>("word_loader_cases.json");

test("kamus eksternal mengenali salam, identitas, produk, dan panduan", () => {
  expect(isGreeting(fixture.greeting)).toBe(true);
  expect(isIdentityQuery(fixture.identity)).toBe(true);
  expect(isIdentityQuery(fixture.identity_help)).toBe(true);
  expect(shouldRefuseMitraMessage(fixture.identity_help, null)).toBe(false);
  expect(getProductAliases().get(fixture.product_alias.product)).toContain(fixture.product_alias.alias);
  expect(matchTourIntent(fixture.stock_question)).toBe("stock_report");
  expect(answerMitraQuestion(fixture.stock_question).suggestedTour).toBe("stock_report");
});

test("pertanyaan umum tetap diteruskan ke LLM, bukan diblokir pre-guardrail", () => {
  for (const message of fixture.out_of_scope) {
    expect(isOutOfScope(message)).toBe(true);
    expect(shouldRefuseMitraMessage(message, null)).toBe(false);
  }
});
