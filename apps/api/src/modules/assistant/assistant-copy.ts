/**
 * Teks balasan asisten.
 *
 * Dibundel saat build lewat apps/api/scripts/bundle-data.mjs, bukan dibaca dari
 * disk. `readFileSync` di level modul akan menggagalkan impor di Cloudflare
 * Workers sebelum satu permintaan pun dilayani, dan `import.meta.dir` juga
 * tidak tersedia di sana.
 *
 * Sumber tetap di ai/data/mainbrain/corporate_knowledge/assistant_copy.json.
 * Setelah mengubahnya, jalankan: bun apps/api/scripts/bundle-data.mjs
 */

import { bundled } from "../../generated/data";
import type { MitraTour } from "./knowledge";

type Copy = {
  out_of_scope_reply: string;
  identity_reply: string;
  developer_reply: string;
  developer_profile_reply: string;
  tenant_scope_reply: string;
  greeting_reply: string;
  quick_replies: string[];
  tours: Record<MitraTour, { reply: string; label: string }>;
};

const source = bundled.corporateKnowledge["assistant_copy.json"] as
  | (Copy & { category?: string; name?: string; version?: string })
  | undefined;

if (!source) {
  throw new Error(
    "assistant_copy.json tidak ada di data terbundel. Jalankan: bun apps/api/scripts/bundle-data.mjs",
  );
}

export const assistantCopy = source as Copy;
