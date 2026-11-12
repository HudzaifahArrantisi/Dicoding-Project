import { isOperationalQuestion } from "./knowledge";
import { knowledgeIntent } from "./company-knowledge";
import { isChitChat, isCrossTenant, isDeveloperQuery, isGreeting, isInjection, isSystemProbe } from "./word-loader";
import { assistantCopy } from "./assistant-copy";

export { OUT_OF_SCOPE_REPLY } from "./knowledge";
export const TENANT_SCOPE_REPLY = assistantCopy.tenant_scope_reply;

export function isCrossTenantQuestion(message: string): boolean {
  return isCrossTenant(message);
}

export function shouldRefuseMitraMessage(message: string, previousIntent: string | null): boolean {
  const normalized = message.trim();
  if (isInjection(normalized) || isSystemProbe(normalized) || isCrossTenantQuestion(normalized)) return true;
  if (isGreeting(normalized) || isChitChat(normalized) || isDeveloperQuery(normalized) || knowledgeIntent(normalized, previousIntent) || isOperationalQuestion(normalized)) return false;
  return false;
}

export function leaksAssistantInternals(reply: string): boolean {
  return isSystemProbe(reply);
}
