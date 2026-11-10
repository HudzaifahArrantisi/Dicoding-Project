export type MitraTour = "restock" | "stock_report" | "delivery" | "logs" | "profile";
import { DAISUKI_AI_IDENTITY_REPLY, isAssistantIdentityQuestion } from "./identity";
import { isChitChat, isDeveloperQuery, isGreeting, isOperational, isOutOfScope, matchTourIntent } from "./word-loader";
import { assistantCopy } from "./assistant-copy";

export interface MitraAssistantReply {
  reply: string;
  suggestedTour?: MitraTour;
  tourLabel?: string;
  quickReplies: string[];
}

export const OUT_OF_SCOPE_REPLY = assistantCopy.out_of_scope_reply;


export function answerMitraQuestion(message: string): MitraAssistantReply {
  const normalized = message.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const base = { quickReplies: [...assistantCopy.quick_replies] };

  if (!normalized || isOutOfScope(normalized)) return { ...base, reply: OUT_OF_SCOPE_REPLY };

  if (isAssistantIdentityQuestion(message)) return { ...base, reply: DAISUKI_AI_IDENTITY_REPLY };

  if (isDeveloperQuery(message)) {
    return {
      ...base,
      reply: assistantCopy.developer_reply,
    };
  }

  const intent = matchTourIntent(normalized);
  if (intent) return { ...base, reply: assistantCopy.tours[intent].reply, suggestedTour: intent, tourLabel: assistantCopy.tours[intent].label };

  if (isGreeting(normalized) || isChitChat(message)) {
    return {
      ...base,
      reply: assistantCopy.greeting_reply,
    };
  }

  return { ...base, reply: OUT_OF_SCOPE_REPLY };
}

export function isOutOfScopeQuestion(message: string): boolean {
  return isOutOfScope(message);
}

export function isOperationalQuestion(message: string): boolean {
  const normalized = message.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return isGreeting(normalized) || isChitChat(message) || isAssistantIdentityQuestion(message) || isDeveloperQuery(message) || isOperational(message);
}
