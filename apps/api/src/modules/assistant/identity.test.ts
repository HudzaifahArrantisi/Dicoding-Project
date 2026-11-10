import { expect, test } from "bun:test";
import { DAISUKI_AI_IDENTITY_REPLY, isAssistantIdentityQuestion } from "./identity";
import { answerMitraQuestion } from "./knowledge";
import { resolveMitraIntent } from "./compose";
import { shouldRefuseMitraMessage } from "./guardrails";

test("ragam pertanyaan tentang diri asisten dikenali sebagai identitas Daisuki AI", () => {
  for (const question of ["kamu siapa?", "siapakah dia??", "siapa kah dia", "diri nya apa?", "chatbot ini siapa?", "apa identitasmu?", "perkenalkan dirimu"]) {
    expect(isAssistantIdentityQuestion(question)).toBe(true);
    expect(shouldRefuseMitraMessage(question, null)).toBe(false);
    expect(resolveMitraIntent(question, null)).toBe("identity");
    expect(answerMitraQuestion(question).reply).toBe(DAISUKI_AI_IDENTITY_REPLY);
  }
  expect(isAssistantIdentityQuestion("siapa pendiri Daisuki?")).toBe(false);
  expect(isAssistantIdentityQuestion("stok saya berapa?")).toBe(false);
});
