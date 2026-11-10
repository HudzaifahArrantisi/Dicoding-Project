import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const dataDir = resolve(import.meta.dir, "../../../../../ai/data");
const mainbrainDir = resolve(dataDir, "mainbrain");
const companyFile = resolve(dataDir, "company_knowledge.json");

type SopStep = { step_number: number; name: string; action: string };
type Sop = { title: string; steps: SopStep[]; important_notes?: string[] };
export type CompanyKnowledge = {
  company: Record<string, unknown> | null;
  sop: Sop | null;
  documents: Array<{ source: string; excerpt: string }>;
};

const companyQuestion = /\b(?:perusahaan|pendiri|founder|founding|sejarah|visi|misi|legalitas|badan hukum|kantor pusat|jam operasional|profil tim|tim pengembang|siapa yang membuat|tentang daisuki)\b/i;
const sopQuestion = /\b(?:sop|panduan|tutorial|langkah|prosedur)\b|\b(?:cara|bagaimana|gimana)\b.{0,60}\b(?:scan|pindai|barcode|resi|lapor|input|restock|ajukan|pengajuan|pesan|stok fisik|profil)\b/i;
const followUp = /\b(?:yang tadi|itu|tersebut|lebih detail|lanjut|siapa saja|kapan|di mana)\b/i;

export function knowledgeIntent(message: string, previousIntent: string | null): "company" | "sop" | null {
  if (companyQuestion.test(message)) return "company";
  if (sopQuestion.test(message)) return "sop";
  if (followUp.test(message) && (previousIntent === "company" || previousIntent === "sop")) return previousIntent;
  return null;
}

function cleanProfile(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const profile = raw as Record<string, unknown>;
  const allowed = ["brand_name", "legal_entity", "founding_year", "founder", "headquarters", "business_model", "description", "vision", "mission", "operating_hours"];
  return Object.fromEntries(allowed.filter((key) => profile[key] != null).map((key) => [key, profile[key]]));
}

function selectSop(raw: unknown, message: string): Sop | null {
  if (!raw || typeof raw !== "object") return null;
  const all = raw as Record<string, Sop>;
  const key = /(?:resi|barcode|pindai|scan|barang sampai|penerimaan)/i.test(message) ? "scan_barcode_delivery"
    : /(?:restock|restok|ajukan|pengajuan|pesan)/i.test(message) ? "restock_order_submission"
      : /(?:lapor|laporan|stok fisik|harian|cek stok)/i.test(message) ? "daily_stock_reporting"
      : /(?:profil|alamat|pic)/i.test(message) ? "profile_update"
        : "restock_order_submission";
  const source = all[key];
  if (!source || !Array.isArray(source.steps)) return null;
  return { title: source.title, steps: source.steps.filter((step) => Number.isInteger(step.step_number) && typeof step.action === "string").slice(0, 8), important_notes: source.important_notes?.filter((note) => !/40 pcs|dipotong saat admin/i.test(note)).slice(0, 3) };
}

export function selectMainbrainExcerpts(query: string, files: Array<{ name: string; content: string }>): Array<{ source: string; excerpt: string }> {
  const words = [...new Set(query.toLowerCase().match(/[\p{L}]{4,}/gu) ?? [])];
  return files.filter((file) => file.name.endsWith(".public.md"))
    .flatMap((file) => file.content.split(/\n\s*\n/).filter((part) => part.length >= 40).map((part) => ({ source: file.name, excerpt: part.slice(0, 1200), score: words.filter((word) => part.toLowerCase().includes(word)).length })))
    .filter((part) => part.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ source, excerpt }) => ({ source, excerpt }));
}

export async function loadCompanyKnowledge(message: string, intent: "company" | "sop"): Promise<CompanyKnowledge> {
  let raw: { company_profile?: unknown; sop_procedures?: unknown } = {};
  try { raw = JSON.parse(await readFile(companyFile, "utf8")); } catch { /* source unavailable */ }
  let documents: Array<{ source: string; excerpt: string }> = [];
  try {
    const names = (await readdir(mainbrainDir)).filter((name) => name.endsWith(".public.md")).slice(0, 20);
    const files = await Promise.all(names.map(async (name) => ({ name, content: (await readFile(resolve(mainbrainDir, name), "utf8")).slice(0, 20_000) })));
    documents = selectMainbrainExcerpts(message, files);
  } catch { /* public mainbrain not populated */ }
  return {
    company: intent === "company" ? cleanProfile(raw.company_profile) : null,
    sop: intent === "sop" ? selectSop(raw.sop_procedures, message) : null,
    documents,
  };
}

export function composeKnowledgeReply(knowledge: CompanyKnowledge, intent: "company" | "sop", message: string): string {
  if (intent === "sop") {
    if (!knowledge.sop) return "Panduan untuk topik tersebut belum tersedia di sistem kami saat ini.";
    return `${knowledge.sop.title}:\n${knowledge.sop.steps.map((step) => `${step.step_number}. **${step.name}**: ${step.action}`).join("\n")}`;
  }
  const company = knowledge.company;
  if (!company) return "Data profil perusahaan belum tersedia di sistem kami saat ini.";
  if (/\b(?:tim|pengembang|biografi|siapa saja)\b/i.test(message)) return `Profil individu tim belum tersedia dalam dokumen yang dapat diakses mitra. Pendiri yang tercatat: ${company.founder ?? "belum tersedia"}.`;
  if (/\b(?:pendiri|founder)\b/i.test(message)) return `Pendiri yang tercatat: ${company.founder ?? "belum tersedia"}.`;
  if (/\b(?:jam|operasional)\b/i.test(message)) {
    const hours = company.operating_hours as Record<string, string> | undefined;
    return hours ? `Jam kantor: ${hours.office}. Jam gudang dan pengiriman: ${hours.warehouse_delivery}.` : "Data jam operasional belum tersedia di sistem kami saat ini.";
  }
  return `${company.brand_name ?? "Daisuki"} tercatat sebagai ${company.legal_entity ?? "perusahaan Daisuki"} di ${company.headquarters ?? "Indonesia"}. ${company.description ?? ""} Visi: ${company.vision ?? "belum tersedia"}`.trim();
}
