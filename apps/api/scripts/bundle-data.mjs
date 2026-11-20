/**
 * Menggabungkan data ai/data/ menjadi modul TypeScript yang dibundel.
 *
 * Cloudflare Workers tidak punya filesystem, jadi readdirSync dan readFileSync
 * tidak bisa dipakai. Skrip ini membaca berkas saat build dan menulis satu
 * modul statis yang bisa diimpor kedua runtime.
 *
 * Jalankan: bun apps/api/scripts/bundle-data.mjs
 * Jalankan ulang setiap kali isi ai/data/ berubah.
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");
const dataRoot = join(root, "ai/data");
const outDir = join(root, "apps/api/src/generated");

/** Folder yang berisi banyak berkas JSON, digabung menjadi satu objek berkunci nama berkas. */
async function readJsonDir(relativeDir) {
  const entries = {};
  let names;
  try {
    names = await readdir(join(dataRoot, relativeDir));
  } catch {
    console.warn(`  lewat  ${relativeDir} (tidak ada)`);
    return entries;
  }
  for (const name of names.sort()) {
    if (!name.endsWith(".json")) continue;
    entries[name] = JSON.parse(await readFile(join(dataRoot, relativeDir, name), "utf8"));
  }
  console.log(`  ${String(Object.keys(entries).length).padStart(2)}  ${relativeDir}`);
  return entries;
}

/** Dokumen publik RAG: hanya berkas *.public.md. */
async function readPublicMarkdown() {
  const relativeDir = "mainbrain/context_embeddings";
  const files = {};
  let names;
  try {
    names = await readdir(join(dataRoot, relativeDir));
  } catch {
    console.warn(`  lewat  ${relativeDir} (tidak ada)`);
    return files;
  }
  for (const name of names.sort()) {
    if (!name.endsWith(".public.md")) continue;
    files[name] = await readFile(join(dataRoot, relativeDir, name), "utf8");
  }
  console.log(`  ${String(Object.keys(files).length).padStart(2)}  ${relativeDir} (*.public.md)`);
  return files;
}

/**
 * Kebijakan guardrail untuk prompt.
 *
 * Dibundel sebagai teks, bukan diimpor sebagai berkas .md. esbuild di Wrangler
 * tidak punya loader untuk .md, jadi impor langsung gagal saat build.
 */
async function readPolicies() {
  const relativeDir = "guardrails";
  const files = {};
  let names;
  try {
    names = await readdir(join(dataRoot, relativeDir));
  } catch {
    console.warn(`  lewat  ${relativeDir} (tidak ada)`);
    return files;
  }
  for (const name of names.sort()) {
    if (!name.endsWith(".md")) continue;
    files[name] = await readFile(join(dataRoot, relativeDir, name), "utf8");
  }
  console.log(`  ${String(Object.keys(files).length).padStart(2)}  ${relativeDir} (*.md)`);
  return files;
}

async function readTextFile(relativePath) {
  try {
    return await readFile(join(dataRoot, relativePath), "utf8");
  } catch {
    console.warn(`  lewat  ${relativePath} (tidak ada)`);
    return "";
  }
}

console.log("Menggabungkan data ai/data/ ...\n");

const payload = {
  words: {
    intent: await readJsonDir("mega_data_word/intent"),
    "intent/tours": await readJsonDir("mega_data_word/intent/tours"),
    "intent/training": await readJsonDir("mega_data_word/intent/training"),
    guardrail: await readJsonDir("mega_data_word/guardrails"),
    dictionary: await readJsonDir("mega_data_word/dictionary"),
  },
  publicMarkdown: await readPublicMarkdown(),
  corporateKnowledge: await readJsonDir("mainbrain/corporate_knowledge"),
  policies: await readPolicies(),
  stopwords: await readTextFile("mega_data_word/dictionary/stopwords_id.txt"),
};

await mkdir(outDir, { recursive: true });

const file = `/**
 * BERKAS INI DIHASILKAN OTOMATIS. Jangan sunting langsung.
 *
 * Sumber       : ai/data/
 * Dibuat oleh  : apps/api/scripts/bundle-data.mjs
 * Jalankan ulang: bun apps/api/scripts/bundle-data.mjs
 *
 * Alasannya: Cloudflare Workers tidak punya filesystem, jadi readdirSync dan
 * readFileSync tidak tersedia. Data dibundel saat build.
 *
 * Tipe memakai Record, bukan as const. Literal readonly dari as const membuat
 * tipe tidak kompatibel dengan antarmuka yang dipakai word-loader.ts.
 */

export type BundledWordFile = {
  category: string;
  name: string;
  version: string;
  exact_phrases?: string[];
  regex_patterns?: string[];
  [key: string]: unknown;
};

export type BundledShape = {
  words: Record<string, Record<string, BundledWordFile>>;
  publicMarkdown: Record<string, string>;
  corporateKnowledge: Record<string, unknown>;
  policies: Record<string, string>;
  stopwords: string;
};

export const bundled: BundledShape = ${JSON.stringify(payload, null, 2)};
`;

await writeFile(join(outDir, "data.ts"), file, "utf8");

const wordCount = Object.values(payload.words).reduce((sum, dir) => sum + Object.keys(dir).length, 0);

console.log("\nSelesai: apps/api/src/generated/data.ts");
console.log(`  Kamus JSON     : ${wordCount}`);
console.log(`  Markdown publik: ${Object.keys(payload.publicMarkdown).length}`);
console.log(`  Kebijakan      : ${Object.keys(payload.policies).length}`);
console.log(`  Stopwords      : ${payload.stopwords.length} karakter`);
