import { getStopwords, matchSopSelection, matchesWordPack, matchesWordPattern } from "./word-loader";
import { assistantCopy } from "./assistant-copy";
import { isStaleCatalogExcerpt } from "./retail-price-reply";
import { bundled } from "../../generated/data";

/**
 * Seluruh pengetahuan dibundel saat build lewat apps/api/scripts/bundle-data.mjs.
 *
 * Versi lama membaca disk dengan readFileSync, readdir, dan statSync. Ketiganya
 * tidak tersedia di Cloudflare Workers, dan import.meta.dir juga tidak ada —
 * mengevaluasinya di level modul menggagalkan impor seluruh aplikasi.
 *
 * Sumber tetap di ai/data/mainbrain/. Setelah mengubahnya, jalankan:
 *   bun apps/api/scripts/bundle-data.mjs
 */

type RagPolicy = { version: string; approved_sources: string[]; max_documents: number; max_chars_per_document: number; max_excerpts: number; blocked_content_patterns: string[] };

const policySource = bundled.corporateKnowledge["rag_policy.json"] as RagPolicy | undefined;
if (!policySource) {
  throw new Error("rag_policy.json tidak ada di data terbundel. Jalankan: bun apps/api/scripts/bundle-data.mjs");
}

const policy: RagPolicy = policySource;
const approvedSources = new Set(policy.approved_sources.filter((name) => name.endsWith(".public.md")));
const blockedContent = policy.blocked_content_patterns.map((pattern) => new RegExp(pattern, "i"));

/** Isi kebijakan tidak berubah selama proses hidup, jadi dihitung sekali. */
function currentPolicy() {
  return { policy, approvedSources, blockedContent };
}

const retrievalAliases = bundled.words.dictionary["retrieval_aliases.json"] as {
  version: string; aliases: Record<string, string[]>;
} | undefined;

if (!retrievalAliases) {
  throw new Error("retrieval_aliases.json tidak ada di data terbundel. Jalankan: bun apps/api/scripts/bundle-data.mjs");
}

export function filterRagDocuments(files: Array<{ name: string; content: string }>): Array<{ name: string; content: string }> {
  return files.filter((file) => approvedSources.has(file.name) && !blockedContent.some((pattern) => pattern.test(file.content)));
}

const companyData: Promise<{ company_profile?: unknown; sop_procedures?: unknown }> = Promise.resolve(
  (bundled.corporateKnowledge["company_knowledge.json"] ?? {}) as { company_profile?: unknown; sop_procedures?: unknown },
);

let publicIndex: Promise<MainbrainIndex> | null = null;

function getPublicIndex(): Promise<MainbrainIndex> {
  publicIndex ??= Promise.resolve(
    Object.entries(bundled.publicMarkdown)
      .filter(([name]) => approvedSources.has(name))
      .slice(0, policy.max_documents)
      .map(([name, content]) => ({ name, content: content.slice(0, policy.max_chars_per_document) })),
  )
    .then(filterRagDocuments)
    .then(indexMainbrain);
  return publicIndex;
}

type SopStep = { step_number: number; name: string; action: string };
type Sop = { title: string; steps: SopStep[]; important_notes?: string[] };
export type CompanyKnowledge = {
  company: Record<string, unknown> | null;
  sop: Sop | null;
  documents: Array<{ source: string; version: string; excerpt: string; visibility?: string; kind?: string; aliases?: string[] }>;
  policyVersion?: string;
};

export function approvedModelContextReply(message: string, documents: CompanyKnowledge["documents"]): string | null {
  const normalized = ` ${message.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
  for (const document of documents) {
    if (document.kind !== "approved_summary" || document.visibility !== "mitra") continue;
    if (!document.aliases?.some((alias) => normalized.includes(` ${alias.toLowerCase()} `))) continue;
    return `Berdasarkan ringkasan yang disetujui dari ${document.source.split("/").pop()}: ${document.excerpt}`;
  }
  return null;
}

type BinaryExcerpt = { source: string; version: string; excerpt: string; score: number; visibility?: string; kind?: string; aliases?: string[] };

export function selectPublicRagMemory(binary: BinaryExcerpt[] | undefined, markdown: CompanyKnowledge["documents"]): {
  documents: CompanyKnowledge["documents"];
  memory: "daisuki.pkl" | ".public.md" | "none";
} {
  const { blockedContent } = currentPolicy();
  const relevant = (binary ?? [])
    .filter((doc) => Number.isFinite(doc.score) && doc.score >= 0.08)
    .filter((doc) => !isStaleCatalogExcerpt(doc.source, doc.excerpt))
    .filter((doc) => doc.kind === "approved_summary" && doc.visibility === "mitra"
      ? !blockedContent.some((pattern) => pattern.test(doc.excerpt))
      : filterRagDocuments([{ name: doc.source, content: doc.excerpt }]).length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ score: _score, ...document }) => document);
  if (relevant.length) return { documents: relevant, memory: "daisuki.pkl" };
  const fallback = markdown.slice(0, 4);
  return { documents: fallback, memory: fallback.length ? ".public.md" : "none" };
}

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

type IndexedExcerpt = { source: string; version: string; excerpt: string };
type MainbrainIndex = { excerpts: IndexedExcerpt[]; terms: Map<string, Map<number, number>> };

function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((word) => !getStopwords().has(word));
}

function indexMainbrain(files: Array<{ name: string; content: string }>): MainbrainIndex {
  const excerpts: IndexedExcerpt[] = [];
  const terms = new Map<string, Map<number, number>>();
  for (const file of files.filter((item) => item.name.endsWith(".public.md"))) {
    const version = createHash("sha256").update(file.content).digest("hex").slice(0, 12);
    const headerLine = file.content.split(/\r?\n/, 6).join(" ");
    const headerWords = new Set(words(`${file.name.replace(/\.public\.md$/i, "").replace(/[_-]+/g, " ")} ${headerLine}`));
    const rawSections = file.content.split(/\n---\n|\n(?=#{1,3}\s)/).map((s) => s.trim()).filter((item) => item.length >= 40);
    const chunks = rawSections.length > 1 ? rawSections : file.content.split(/\n\s*\n/).map((s) => s.trim()).filter((item) => item.length >= 40);
    for (const part of chunks) {
      const excerpt = part.slice(0, 1500);
      const index = excerpts.push({ source: file.name, version, excerpt }) - 1;
      const excerptWords = new Set(words(excerpt));
      for (const word of excerptWords) {
        const postings = terms.get(word) ?? new Map<number, number>();
        postings.set(index, (postings.get(index) ?? 0) + 2);
        terms.set(word, postings);
      }
      for (const word of headerWords) {
        if (excerptWords.has(word)) continue;
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
  const terms = new Set(words(query));
  for (const term of [...terms]) for (const alias of retrievalAliases.aliases[term] ?? []) terms.add(alias);
  for (const word of terms) {
    for (const [id, weight] of index.terms.get(word) ?? []) scores.set(id, (scores.get(id) ?? 0) + weight);
  }
  return [...scores].sort((a, b) => b[1] - a[1]).slice(0, currentPolicy().policy.max_excerpts).map(([id]) => index.excerpts[id]);
}

export function selectMainbrainExcerpts(query: string, files: Array<{ name: string; content: string }>): IndexedExcerpt[] {
  return searchMainbrain(query, indexMainbrain(files));
}

export async function loadCompanyKnowledge(message: string, intent: "company" | "sop" | null, includeMarkdown = true): Promise<CompanyKnowledge> {
  const [raw, index] = await Promise.all([companyData, includeMarkdown ? getPublicIndex() : Promise.resolve(null)]);
  const documents = index ? searchMainbrain(message, index) : [];
  return {
    company: intent === "company" ? cleanProfile(raw.company_profile) : null,
    sop: intent === "sop" ? selectSop(raw.sop_procedures, message) : null,
    documents,
    policyVersion: currentPolicy().policy.version,
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
