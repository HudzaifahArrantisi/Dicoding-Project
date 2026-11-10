import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

const path = resolve(import.meta.dir, "../../../../../ai/data/mainbrain/corporate_knowledge/assistant_copy.json");
export const assistantCopy = JSON.parse(readFileSync(path, "utf8")) as Copy;
