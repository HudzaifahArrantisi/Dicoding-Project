import { expect, test } from "bun:test";
import { isCrossTenantQuestion, leaksAssistantInternals, shouldRefuseMitraMessage } from "./guardrails";
import { loadAssistantFixture } from "./test-data";

type GuardrailsFixture = {
  allowed_messages: Array<{ text: string; previous_intent: string | null }>;
  blocked_messages: Array<{ text: string; previous_intent: string | null }>;
  general_messages: Array<{ text: string; previous_intent: string | null }>;
  cross_tenant_messages: Array<{ text: string; expected: boolean }>;
  allowed_aggregate_messages: Array<{ text: string; previous_intent: string | null; expected: boolean }>;
  leak_cases: Array<{ text: string; expected: boolean }>;
};

const fixture = loadAssistantFixture<GuardrailsFixture>("guardrails_cases.json");

test("sapaan, identitas, dan pertanyaan stok tetap boleh diproses", () => {
  for (const item of fixture.allowed_messages) expect(shouldRefuseMitraMessage(item.text, item.previous_intent)).toBe(false);
});

test("topik luar, jailbreak, dan data cabang lain ditolak", () => {
  for (const item of fixture.blocked_messages) expect(shouldRefuseMitraMessage(item.text, item.previous_intent)).toBe(true);
  for (const item of fixture.general_messages) expect(shouldRefuseMitraMessage(item.text, item.previous_intent)).toBe(false);
  for (const item of fixture.cross_tenant_messages) expect(isCrossTenantQuestion(item.text)).toBe(item.expected);
  for (const item of fixture.allowed_aggregate_messages) expect(shouldRefuseMitraMessage(item.text, item.previous_intent)).toBe(item.expected);
});

test("jawaban yang mengungkap detail internal diblokir", () => {
  for (const item of fixture.leak_cases) expect(leaksAssistantInternals(item.text)).toBe(item.expected);
});
