import { isIdentityQuery } from "./word-loader";
import { assistantCopy } from "./assistant-copy";

export const DAISUKI_AI_IDENTITY_REPLY = assistantCopy.identity_reply;

export function isAssistantIdentityQuestion(message: string): boolean {
  return isIdentityQuery(message);
}
