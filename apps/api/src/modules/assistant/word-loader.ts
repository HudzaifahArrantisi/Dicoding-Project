import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../../../../ai/data/mega_data_word");
type WordFile = { category: string; name: string; version: string; exact_phrases?: string[]; regex_patterns?: string[]; [key: string]: unknown };
type Matcher = { exact: Set<string>; pattern: RegExp | null; raw: WordFile };

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, " ").trim();
}

function compile(patterns: string[]): RegExp | null {
  return patterns.length ? new RegExp(patterns.map((part) => `(?:${part})`).join("|"), "iu") : null;
}

function load(): Map<string, Matcher> {
  const packs = new Map<string, Matcher>();
  for (const folder of ["intent", "intent/tours", "guardrails", "dictionary"]) {
    const directory = resolve(root, folder);
    for (const name of readdirSync(directory).filter((file) => file.endsWith(".json"))) {
      const raw = JSON.parse(readFileSync(resolve(directory, name), "utf8")) as WordFile;
      if (!raw.category || !raw.name || !raw.version) throw new Error(`Kamus tidak valid: ${name}`);
      const exact = new Set((raw.exact_phrases ?? []).map(normalize));
      packs.set(`${raw.category}/${raw.name}`, { exact, pattern: compile(raw.regex_patterns ?? []), raw });
    }
  }
  return packs;
}

const packs = load();
function loadTrainingPhrases(): Map<string, string> {
  const phrases = new Map<string, string>();
  const add = (intent: string, values: string[]) => {
    for (const value of values) {
      const key = normalize(value);
      const existing = phrases.get(key);
      if (existing && existing !== intent) throw new Error(`Frasa training ambigu: ${value}`);
      phrases.set(key, intent);
    }
  };
  const base = packs.get("training/training_examples")?.raw.intents as Record<string, string[]>;
  for (const [intent, values] of Object.entries(base)) add(intent, values);
  const directory = resolve(root, "intent/training");
  for (const name of readdirSync(directory).filter((file) => file.endsWith(".json"))) {
    const data = JSON.parse(readFileSync(resolve(directory, name), "utf8")) as { intent: string; phrases: string[] };
    add(data.intent, data.phrases);
  }
  return phrases;
}
const trainingPhrases = loadTrainingPhrases();
const compiled = new Map<string, RegExp | null>();
for (const [name, entry] of packs) {
  for (const [field, value] of Object.entries(entry.raw)) {
    if (field.endsWith("_patterns") && Array.isArray(value)) compiled.set(`${name}/${field}`, compile(value));
  }
}
const productAliases = new Map(Object.entries(packs.get("dictionary/product_aliases")?.raw.aliases as Record<string, string[]>));
const stopwords = new Set(readFileSync(resolve(root, "dictionary/stopwords_id.txt"), "utf8").split(/\r?\n/).map(normalize).filter(Boolean));

function pack(name: string): Matcher {
  const value = packs.get(name);
  if (!value) throw new Error(`Kamus tidak tersedia: ${name}`);
  return value;
}

function matches(name: string, text: string): boolean {
  const entry = pack(name);
  return entry.exact.has(normalize(text)) || Boolean(entry.pattern?.test(text));
}

function extra(name: string, field: string): RegExp | null {
  const key = `${name}/${field}`;
  if (!compiled.has(key)) compiled.set(key, compile(pack(name).raw[field] as string[] ?? []));
  return compiled.get(key) ?? null;
}

export function matchesWordPack(name: string, text: string): boolean { return matches(name, text); }
export function matchTrainingPhrase(text: string): string | null { return trainingPhrases.get(normalize(text)) ?? null; }
export function matchesWordPattern(name: string, field: string, text: string): boolean {
  return extra(name, field)?.test(text) ?? false;
}
export function matchSopSelection(text: string): string {
  const selections = pack("intent/sop").raw.selection as Record<string, string[]>;
  for (const [name, patterns] of Object.entries(selections)) {
    const key = `intent/sop/selection:${name}`;
    if (!compiled.has(key)) compiled.set(key, compile(patterns));
    if (compiled.get(key)?.test(text)) return name;
  }
  return "restock_order_submission";
}
export function isGreeting(text: string): boolean { return matches("intent/greetings", normalize(text)) || matchTrainingPhrase(text) === "greeting"; }
export function isChitChat(text: string): boolean {
  return extra("intent/greetings", "chit_chat_patterns")?.test(text) ?? false;
}
export function isIdentityQuery(text: string): boolean { return matches("intent/identity", text) || matchTrainingPhrase(text) === "identity"; }
export function isDeveloperQuery(text: string): boolean {
  return extra("intent/identity", "developer_patterns")?.test(text) ?? false;
}
export function isOutOfScope(text: string): boolean { return matches("guardrail/out_of_scope", text) || matchTrainingPhrase(text) === "out_of_scope"; }
export function isInjection(text: string): boolean { return matches("guardrail/prompt_injections", text); }
export function isSystemProbe(text: string): boolean { return matches("guardrail/system_probe", text); }
export function isCrossTenant(text: string): boolean { return matches("guardrail/tenant_scope", text); }
export function isOperational(text: string): boolean {
  const trained = matchTrainingPhrase(text);
  return matches("intent/operational", text) || Boolean(trained && trained !== "out_of_scope");
}
export function isFollowUp(text: string): boolean { return matches("intent/follow_up", text); }
export function matchTourIntent(text: string): "delivery" | "restock" | "stock_report" | "logs" | "profile" | null {
  const trained = matchTrainingPhrase(text);
  if (trained === "delivery" || trained === "restock" || trained === "stock_report" || trained === "logs" || trained === "profile") return trained;
  for (const name of ["delivery", "restock", "stock_report", "logs", "profile"] as const) {
    if (matches(`tour/${name}`, text)) return name;
  }
  return null;
}
export function matchFactualIntent(text: string): "central_stock" | "top_products" | "top_partners" | "top_regions" | null {
  const trained = matchTrainingPhrase(text);
  if (trained === "central_stock" || trained === "top_products" || trained === "top_partners" || trained === "top_regions") return trained;
  const intents = pack("intent/factual").raw.intents as Record<string, string[]>;
  for (const name of ["central_stock", "top_products", "top_partners", "top_regions"] as const) {
    const key = `intent/factual/intent:${name}`;
    if (!compiled.has(key)) compiled.set(key, compile(intents[name]));
    if (compiled.get(key)?.test(text)) return name;
  }
  return null;
}
export function matchFactualPattern(name: "network_patterns" | "own_branch_patterns" | "central_stock_patterns" | "tutorial_patterns", text: string): boolean {
  return extra("intent/factual", name)?.test(text) ?? false;
}
export function getProductAliases(): Map<string, string[]> {
  return productAliases;
}
export function getStopwords(): ReadonlySet<string> { return stopwords; }
