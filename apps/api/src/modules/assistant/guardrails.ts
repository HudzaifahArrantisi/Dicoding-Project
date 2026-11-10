import { isOperationalQuestion, isOutOfScopeQuestion } from "./knowledge";
import { knowledgeIntent } from "./company-knowledge";

export { OUT_OF_SCOPE_REPLY } from "./knowledge";
export const TENANT_SCOPE_REPLY = "Mohon maaf, demi menjaga kerahasiaan dan privasi bisnis antar-mitra Daisuki, saya tidak memiliki akses ke informasi sisa stok, data operasional, maupun alamat cabang mitra lainnya.";

const courtesy = /^(?:hi|hai|halo|hello|pagi|siang|sore|malam|selamat (?:pagi|siang|sore|malam)|tes|test|permisi|terima kasih|makasih|thanks|oke|ok)[.!?\s]*$/i;
const followUp = /\b(?:yang tadi|yang itu|produk itu|pesanan itu|lanjut|detailnya|bagaimana dengan itu)\b|^(?:berapa|bagaimana|sekarang|terbaru)\s*\??$/i;
const injection = /\b(?:abaikan|lupakan)\s+(?:(?:semua|seluruh)\s+)?(?:instruksi|aturan|perintah)|\bignore\s+(?:all\s+)?(?:previous\s+)?(?:instructions|rules)|\b(?:developer|pengembang)\s+mode|\b(?:system\s+prompt|prompt\s+sistem|instruksi\s+sistem|token\s+jwt|api[_ -]?key|kunci\s+api|skema\s+database)\b/i;
const unrelated = /\b(?:lelucon|joke|resep|memasak|politik|pemilu|matematika|fotosintesis|kompetitor)\b/i;
const otherTenant = /\b(?:mitra|cabang|toko)\s+(?:lain|lainnya|selain|sebelah|paling\s+(?:laris|aktif)|terlaris|(?:nomor|no\.?\s*)?\d+)\b|\bbandingkan\b.{0,40}\b(?:mitra|cabang|toko)\b/i;

export function isCrossTenantQuestion(message: string): boolean {
  return otherTenant.test(message);
}

export function shouldRefuseMitraMessage(message: string, previousIntent: string | null): boolean {
  const normalized = message.trim();
  if (injection.test(normalized) || unrelated.test(normalized) || isOutOfScopeQuestion(normalized) || isCrossTenantQuestion(normalized)) return true;
  if (courtesy.test(normalized) || knowledgeIntent(normalized, previousIntent) || isOperationalQuestion(normalized)) return false;
  return !(previousIntent && followUp.test(normalized));
}

export function leaksAssistantInternals(reply: string): boolean {
  return /\b(?:FAKTA_JSON|MEMORI_PERCAKAPAN|MEMORI_MAINBRAIN_TEREKSTRAK|COMPANY_KNOWLEDGE|system\s+prompt|prompt\s+sistem|instruksi\s+sistem|9router|jwt[_ -]?secret|llm[_ -]?(?:api[_ -]?key|base[_ -]?url)|assistant_conversation_memory|select\s+.{1,80}\s+from\s+|create\s+table)\b|postgres(?:ql)?:\/\/|\bBearer\s+[A-Za-z0-9._-]{10,}\b/i.test(reply);
}
