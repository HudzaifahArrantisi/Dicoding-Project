import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isCrossTenant, isInjection, isSystemProbe } from "./word-loader";
import { assistantCopy } from "./assistant-copy";

export { OUT_OF_SCOPE_REPLY } from "./knowledge";
export const TENANT_SCOPE_REPLY = assistantCopy.tenant_scope_reply;
const policyDir = resolve(import.meta.dir, "../../../../../ai/data/guardrails");
export const GUARDRAILS_POLICY = ["privacy_policy.md", "prompt_injection_policy.md", "factual_boundary_policy.md"]
  .map((name) => readFileSync(resolve(policyDir, name), "utf8")).join("\n\n");

export function isCrossTenantQuestion(message: string): boolean {
  return isCrossTenant(message);
}

export function shouldRefuseMitraMessage(message: string, _previousIntent: string | null): boolean {
  const normalized = message.trim();
  return isInjection(normalized) || isSystemProbe(normalized) || isCrossTenantQuestion(normalized);
}

export function leaksAssistantInternals(reply: string): boolean {
  return isSystemProbe(reply);
}
