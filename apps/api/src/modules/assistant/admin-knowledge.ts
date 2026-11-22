/**
 * Indeks pengetahuan untuk Chat AI Admin.
 *
 * Seluruh dokumen dibundel saat build lewat apps/api/scripts/bundle-data.mjs.
 * Versi lama memakai readdir dan readFile, yang tidak tersedia di Cloudflare
 * Workers.
 *
 * Sumber tetap di ai/data/mainbrain/context_embeddings/. Setelah mengubahnya:
 *   bun apps/api/scripts/bundle-data.mjs
 */

import { createHash } from "node:crypto";
import { getStopwords } from "./word-loader";
import { bundled } from "../../generated/data";

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

/** Dokumen Markdown di ai/data/mainbrain/context_embeddings, terbundel saat build. */
function markdownFiles(): Array<{ name: string; content: string }> {
  return Object.entries(bundled.publicMarkdown)
    .filter(([name]) => name.toLowerCase().endsWith(".md") && !name.toLowerCase().startsWith("readme"))
    .map(([name, content]) => ({ name, content }));
}

function buildAdminKnowledgeIndex(): AdminKnowledgeIndex {
  const excerpts: AdminIndexedExcerpt[] = [];
  const terms = new Map<string, Map<number, number>>();

  for (const { name, content } of markdownFiles()) {
    const version = createHash("sha256").update(content).digest("hex").slice(0, 12);

    // Pisahkan per bagian (## atau ### atau \n---\n)
    const rawSections = content.split(/(?=\n#{1,3}\s+)|\n\s*---\s*\n/);
    for (const section of rawSections) {
      const trimmed = section.trim();
      if (trimmed.length < 50) continue;

      const titleMatch = trimmed.match(/^#{1,3}\s+([^\n]+)/);
      const title = titleMatch ? titleMatch[1].trim() : name;

      // Sampai 2500 karakter per bagian agar tabel dan daftar utuh.
      const excerptText = trimmed.slice(0, 2500);
      const id = excerpts.push({ source: name, version, title, excerpt: excerptText }) - 1;

      for (const term of tokenize(`${title} ${excerptText}`)) {
        const postings = terms.get(term) ?? new Map<number, number>();
        postings.set(id, (postings.get(id) ?? 0) + 1);
        terms.set(term, postings);
      }
    }
  }

  return { excerpts, terms };
}

function getIndex(): AdminKnowledgeIndex {
  cachedIndex ??= buildAdminKnowledgeIndex();
  return cachedIndex;
}

/** Perluas istilah pencarian dengan alias domain agar istilah ilmiah ikut cocok. */
function expandTerms(words: string[]): string[] {
  const expanded = new Set(words);
  for (const word of words) {
    for (const alias of SCIENTIFIC_ALIASES[word] ?? []) expanded.add(alias);
  }
  return [...expanded];
}

/**
 * Bentuk async dipertahankan agar pemanggil tidak perlu berubah.
 * Sebelumnya menunggu I/O disk; sekarang hanya membaca indeks yang sudah siap.
 */
export async function getAdminKnowledgeIndex(): Promise<AdminKnowledgeIndex> {
  return getIndex();
}

export async function searchAdminKnowledge(query: string, maxExcerpts = 5): Promise<AdminIndexedExcerpt[]> {
  const index = getIndex();
  const words = expandTerms(tokenize(query));

  const scores = new Map<number, number>();
  for (const term of words) {
    const postings = index.terms.get(term);
    if (!postings) continue;
    for (const [docId, count] of postings) {
      // Judul yang memuat istilah pencarian diberi bobot tiga kali.
      const titleBoost = index.excerpts[docId].title.toLowerCase().includes(term) ? 3 : 1;
      scores.set(docId, (scores.get(docId) ?? 0) + count * titleBoost);
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxExcerpts)
    .map(([docId]) => index.excerpts[docId]);
}

/** Mengembalikan seluruh isi berkas agar pemanggil memilih bagiannya sendiri. */
export async function loadCompanyProfileAndSop(): Promise<{ company_profile?: unknown; sop_procedures?: unknown; business_rules?: unknown } | null> {
  const data = bundled.corporateKnowledge["company_knowledge.json"];
  return data && typeof data === "object" ? data : null;
}
