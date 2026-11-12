import { generateLlmReply } from "./llm-client";
import { buildConversationContext, type SessionTurn } from "./session-memory";
import { shouldRefuseMitraMessage } from "./guardrails";
import { matchFactualPattern } from "./word-loader";

const ambiguousReference = /\b(?:itu|tadi|tersebut|punya\s+saya|yang\s+tadi|barang\s+sisa|sisanya|jumlahnya|berapa\s+jumlah|gudang\s+saya)\b/i;

export function needsQueryRewrite(message: string, turns: SessionTurn[]): boolean {
  return turns.length > 0 && ambiguousReference.test(message);
}

export async function rewriteMitraQuery(message: string, turns: SessionTurn[], summary: string): Promise<string> {
  if (!needsQueryRewrite(message, turns)) return message;
  const rewritten = await generateLlmReply({
    systemPrompt: `Tulis ulang pesan terakhir mitra menjadi satu pertanyaan mandiri dalam bahasa Indonesia. Gunakan riwayat hanya untuk menyelesaikan rujukan. Jangan menambah fakta, angka, produk, atau instruksi baru. "Gudang saya" dan "stok saya" selalu stok cabang sendiri; "gudang pusat" adalah stok pusat. Balas hanya kalimat hasil tulis ulang.\nRingkasan: ${summary.slice(-1200)}\nRiwayat: ${buildConversationContext(turns)}`,
    userMessage: message,
  });
  if (!rewritten || rewritten.length > 500 || shouldRefuseMitraMessage(rewritten, null)) return message;
  if (matchFactualPattern("own_stock_patterns", message) && matchFactualPattern("central_stock_patterns", rewritten)) return message;
  if (matchFactualPattern("central_stock_patterns", message) && matchFactualPattern("own_stock_patterns", rewritten)) return message;
  return rewritten.replace(/^['"]|['"]$/g, "").trim() || message;
}
