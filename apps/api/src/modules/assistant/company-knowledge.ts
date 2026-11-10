import { readFile, readdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getStopwords, matchSopSelection, matchesWordPack, matchesWordPattern } from "./word-loader";
import { assistantCopy } from "./assistant-copy";

const dataDir = resolve(import.meta.dir, "../../../../../data/mainbrain");
const mainbrainDir = resolve(dataDir, "context_embeddings");
const companyFile = resolve(dataDir, "corporate_knowledge/company_knowledge.json");
type RagPolicy = { approved_sources: string[]; max_documents: number; max_chars_per_document: number; max_excerpts: number; blocked_content_patterns: string[] };
const ragPolicy = JSON.parse(readFileSync(resolve(dataDir, "corporate_knowledge/rag_policy.json"), "utf8")) as RagPolicy;
const approvedSources = new Set(ragPolicy.approved_sources.filter((name) => name.endsWith(".public.md")));
const blockedContent = ragPolicy.blocked_content_patterns.map((pattern) => new RegExp(pattern, "i"));
export function filterRagDocuments(files: Array<{ name: string; content: string }>): Array<{ name: string; content: string }> {
  return files.filter((file) => approvedSources.has(file.name) && !blockedContent.some((pattern) => pattern.test(file.content)));
}
const companyData: Promise<{ company_profile?: unknown; sop_procedures?: unknown }> = readFile(companyFile, "utf8")
  .then((text) => JSON.parse(text)).catch(() => ({}));
const publicDocuments = readdir(mainbrainDir)
  .then(async (names) => Promise.all(names.filter((name) => approvedSources.has(name)).slice(0, ragPolicy.max_documents)
    .map(async (name) => ({ name, content: (await readFile(resolve(mainbrainDir, name), "utf8")).slice(0, ragPolicy.max_chars_per_document) }))))
  .then(filterRagDocuments)
  .catch(() => [] as Array<{ name: string; content: string }>);
const publicIndex = publicDocuments.then(indexMainbrain);

type SopStep = { step_number: number; name: string; action: string };
type Sop = { title: string; steps: SopStep[]; important_notes?: string[] };
export type CompanyKnowledge = {
  company: Record<string, unknown> | null;
  sop: Sop | null;
  documents: Array<{ source: string; excerpt: string }>;
};

export function knowledgeIntent(message: string, previousIntent: string | null): "company" | "sop" | null {
  if (matchesWordPack("intent/company", message)) return "company";
  if (matchesWordPack("intent/sop", message)) return "sop";
  if (matchesWordPattern("intent/company", "follow_up_patterns", message) && (previousIntent === "company" || previousIntent === "sop")) return previousIntent;
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
  const key = matchSopSelection(message);
  const source = all[key];
  if (!source || !Array.isArray(source.steps)) return null;
  return { title: source.title, steps: source.steps.filter((step) => Number.isInteger(step.step_number) && typeof step.action === "string").slice(0, 8), important_notes: source.important_notes?.filter((note) => !matchesWordPattern("intent/sop", "excluded_note_patterns", note)).slice(0, 3) };
}

type IndexedExcerpt = { source: string; excerpt: string };
type MainbrainIndex = { excerpts: IndexedExcerpt[]; terms: Map<string, Map<number, number>> };

function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}]{4,}/gu) ?? []).filter((word) => !getStopwords().has(word));
}

function indexMainbrain(files: Array<{ name: string; content: string }>): MainbrainIndex {
  const excerpts: IndexedExcerpt[] = [];
  const terms = new Map<string, Map<number, number>>();
  for (const file of files.filter((item) => item.name.endsWith(".public.md"))) {
    for (const part of file.content.split(/\n\s*\n/).filter((item) => item.length >= 40)) {
      const excerpt = part.slice(0, 1200);
      const index = excerpts.push({ source: file.name, excerpt }) - 1;
      for (const word of new Set(words(excerpt))) {
        const postings = terms.get(word) ?? new Map<number, number>();
        postings.set(index, (postings.get(index) ?? 0) + 1);
        terms.set(word, postings);
      }
    }
  }
  return { excerpts, terms };
}

function searchMainbrain(query: string, index: MainbrainIndex): IndexedExcerpt[] {
  const scores = new Map<number, number>();
  for (const word of new Set(words(query))) {
    for (const [id, weight] of index.terms.get(word) ?? []) scores.set(id, (scores.get(id) ?? 0) + weight);
  }
  return [...scores].sort((a, b) => b[1] - a[1]).slice(0, ragPolicy.max_excerpts).map(([id]) => index.excerpts[id]);
}

export function selectMainbrainExcerpts(query: string, files: Array<{ name: string; content: string }>): IndexedExcerpt[] {
  return searchMainbrain(query, indexMainbrain(files));
}

export async function loadCompanyKnowledge(message: string, intent: "company" | "sop"): Promise<CompanyKnowledge> {
  const [raw, index] = await Promise.all([companyData, publicIndex]);
  const documents = searchMainbrain(message, index);
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
  if (matchesWordPattern("intent/company", "developer_patterns", message)) {
    const devDoc = knowledge.documents.find((d) => matchesWordPattern("intent/company", "developer_document_patterns", d.source) || matchesWordPattern("intent/company", "developer_document_patterns", d.excerpt));
    return devDoc ? `${assistantCopy.developer_profile_reply} Pendiri perusahaan yang tercatat: ${company.founder ?? "belum tersedia"}.`
      : `Profil pengembang belum tersedia dalam dokumen publik. Pendiri yang tercatat: ${company.founder ?? "belum tersedia"}.`;
  }
  if (matchesWordPattern("intent/company", "founder_patterns", message)) return `Pendiri yang tercatat: ${company.founder ?? "belum tersedia"}.`;
  if (matchesWordPattern("intent/company", "hours_patterns", message)) {
    const hours = company.operating_hours as Record<string, string> | undefined;
    return hours ? `Jam kantor: ${hours.office}. Jam gudang dan pengiriman: ${hours.warehouse_delivery}.` : "Data jam operasional belum tersedia di sistem kami saat ini.";
  }
  return `${company.brand_name ?? "Daisuki"} tercatat sebagai ${company.legal_entity ?? "perusahaan Daisuki"} di ${company.headquarters ?? "Indonesia"}. ${company.description ?? ""} Visi: ${company.vision ?? "belum tersedia"}`.trim();
}
