import { expect, test } from "bun:test";
import { DAISUKI_AI_IDENTITY_REPLY, isAssistantIdentityQuestion } from "./identity";
import { answerMitraQuestion } from "./knowledge";
import { resolveMitraIntent } from "./compose";
import { shouldRefuseMitraMessage } from "./guardrails";
import { loadAssistantFixture } from "./test-data";

type KnowledgeFixture = { identity_cases: Array<{ question: string }>; identity_negative_cases: string[] };
const fixture = loadAssistantFixture<KnowledgeFixture>("knowledge_cases.json");

test("ragam pertanyaan tentang diri asisten dikenali sebagai identitas Daisuki AI", () => {
  for (const { question } of fixture.identity_cases) {
    expect(isAssistantIdentityQuestion(question)).toBe(true);
    expect(shouldRefuseMitraMessage(question, null)).toBe(false);
    expect(resolveMitraIntent(question, null)).toBe("identity");
    expect(answerMitraQuestion(question).reply).toBe(DAISUKI_AI_IDENTITY_REPLY);
  }
  for (const question of fixture.identity_negative_cases) expect(isAssistantIdentityQuestion(question)).toBe(false);
});
