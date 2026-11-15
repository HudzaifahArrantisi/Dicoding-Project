import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { getStopwords } from "./word-loader";

const dataDir = resolve(import.meta.dir, "../../../../../ai/data/mainbrain");
const mainbrainDir = resolve(dataDir, "context_embeddings");
const companyFile = resolve(dataDir, "corporate_knowledge/company_knowledge.json");

export interface AdminIndexedExcerpt {
  source: string;
  version: string;
  title: string;
  excerpt: string;
}

interface AdminKnowledgeIndex {
  excerpts: AdminIndexedExcerpt[];
  terms: Map<string, Map<number, number>>;
}

let cachedIndex: AdminKnowledgeIndex | null = null;
let lastIndexLoad = 0;
const INDEX_TTL_MS = 60_000;

function tokenize(text: string): string[] {
  const stopwords = getStopwords();
  return (text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])
    .filter((word) => !stopwords.has(word));
}

const SCIENTIFIC_ALIASES: Record<string, string[]> = {
  "penelitian": ["karya", "ilmiah", "jurnal", "riset", "studi"],
  "jurnal": ["karya", "ilmiah", "penelitian", "jatisi", "artikel"],
  "hudzaifah": ["arrantisi", "rantisi", "penulis", "author", "peneliti"],
  "nlp": ["natural", "language", "processing", "sentimen", "sentiment"],
  "sentimen": ["sentiment", "opini", "positif", "negatif", "klasifikasi"],
  "sgd": ["stochastic", "gradient", "descent", "logistic", "regression"],
  "logistic": ["regression", "regresi", "logistik", "sgd"],
  "mbg": ["makan", "bergizi", "gratis", "kebijakan", "program"],
  "prabowo": ["gibran", "kebijakan", "presiden", "pemerintah"],
  "akurasi": ["accuracy", "performa", "metrik", "cross-validation", "evaluasi"],
  "dataset": ["komentar", "scraping", "youtube", "tiktok", "sampel"],
  "stok": ["persediaan", "buffer", "gudang", "rop", "safety"],
  "restock": ["pasokan", "pemesanan", "pesanan", "order", "pengajuan"],
  "sop": ["panduan", "prosedur", "langkah", "tata", "cara"],
};

async function buildAdminKnowledgeIndex(): Promise<AdminKnowledgeIndex> {
  const excerpts: AdminIndexedExcerpt[] = [];
  const terms = new Map<string, Map<number, number>>();

  if (!existsSync(mainbrainDir)) {
    return { excerpts, terms };
  }

  const fileNames = await readdir(mainbrainDir);
  const mdFiles = fileNames.filter((name) => name.endsWith(".md") && !name.toLowerCase().startsWith("readme"));

  for (const name of mdFiles) {
    try {
      const content = await readFile(resolve(mainbrainDir, name), "utf8");
      const version = createHash("sha256").update(content).digest("hex").slice(0, 12);

      // Split file by sections (## or ### or \n---\n)
      const rawSections = content.split(/(?=\n#{1,3}\s+)|\n\s*---\s*\n/);
      for (const section of rawSections) {
        const trimmed = section.trim();
        if (trimmed.length < 50) continue;

        // Extract title if present
        const titleMatch = trimmed.match(/^#{1,3}\s+([^\n]+)/);
        const title = titleMatch ? titleMatch[1].trim() : name;

        // Take up to 2500 characters per section to preserve tables and complete lists
        const excerptText = trimmed.slice(0, 2500);
        const index = excerpts.push({
          source: name,
          version,
          title,
          excerpt: excerptText,
        }) - 1;

        const words = tokenize(excerptText);
        for (const word of words) {
          const postings = terms.get(word) ?? new Map<number, number>();
          postings.set(index, (postings.get(index) ?? 0) + 1);
          terms.set(word, postings);
        }
      }
    } catch (err) {
      console.warn(`[ADMIN KNOWLEDGE] Gagal membaca ${name}:`, err);
    }
  }

  return { excerpts, terms };
}

export async function getAdminKnowledgeIndex(): Promise<AdminKnowledgeIndex> {
  const now = Date.now();
  if (!cachedIndex || now - lastIndexLoad > INDEX_TTL_MS) {
    cachedIndex = await buildAdminKnowledgeIndex();
    lastIndexLoad = now;
  }
  return cachedIndex;
}

export async function searchAdminKnowledge(query: string, maxExcerpts = 5): Promise<AdminIndexedExcerpt[]> {
  const index = await getAdminKnowledgeIndex();
  const queryWords = tokenize(query);
  const searchTerms = new Set<string>(queryWords);

  // Expand with aliases
  for (const word of queryWords) {
    const expansions = SCIENTIFIC_ALIASES[word];
    if (expansions) {
      for (const exp of expansions) searchTerms.add(exp);
    }
  }

  const scores = new Map<number, number>();
  for (const term of searchTerms) {
    const postings = index.terms.get(term);
    if (!postings) continue;
    for (const [docId, count] of postings) {
      // Boost if term appears in title
      const doc = index.excerpts[docId];
      const titleBoost = doc.title.toLowerCase().includes(term) ? 3 : 1;
      scores.set(docId, (scores.get(docId) ?? 0) + (count * titleBoost));
    }
  }

  const sorted = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxExcerpts)
    .map(([docId]) => index.excerpts[docId]);

  return sorted;
}

export async function loadCompanyProfileAndSop() {
  try {
    if (existsSync(companyFile)) {
      const raw = JSON.parse(await readFile(companyFile, "utf8")) as { company_profile?: unknown; sop_procedures?: unknown; business_rules?: unknown };
      return raw;
    }
  } catch {}
  return null;
}
