/**
 * Guardrail percakapan asisten.
 *
 * Tiga berkas kebijakan dibundel saat build lewat apps/api/scripts/bundle-data.mjs,
 * bukan dibaca dari disk maupun diimpor sebagai berkas .md.
 *
 * Dua alasan:
 *   - Workers tidak punya filesystem, jadi readFileSync gagal saat impor.
 *   - esbuild di Wrangler tidak punya loader untuk .md, jadi impor langsung
 *     gagal saat build.
 *
 * Sumber tetap di ai/data/guardrails/. Setelah mengubahnya, jalankan:
 *   bun apps/api/scripts/bundle-data.mjs
 */

import { bundled } from "../../generated/data";
import { isCrossTenant, isInjection, isSystemProbe } from "./word-loader";
import { assistantCopy } from "./assistant-copy";

export { OUT_OF_SCOPE_REPLY } from "./knowledge";
export const TENANT_SCOPE_REPLY = assistantCopy.tenant_scope_reply;

/** Urutan disengaja: privasi, injeksi, lalu batas faktual. */
export const GUARDRAILS_POLICY = [
  bundled.policies["privacy_policy.md"],
  bundled.policies["prompt_injection_policy.md"],
  bundled.policies["factual_boundary_policy.md"],
]
  .filter((policy): policy is string => typeof policy === "string")
  .join("\n\n");

export function isCrossTenantQuestion(message: string): boolean {
  return isCrossTenant(message);
}

export function shouldRefuseMitraMessage(message: string, _previousIntent: string | null): boolean {
  const normalized = message.trim();
  if (isCrossTenantQuestion(normalized)) return true;
  return isInjection(normalized) || isSystemProbe(normalized);
}

export function leaksAssistantInternals(reply: string): boolean {
  return isSystemProbe(reply);
}
