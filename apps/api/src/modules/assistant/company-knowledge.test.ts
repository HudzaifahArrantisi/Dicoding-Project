import { expect, test } from "bun:test";
import { composeKnowledgeReply, filterRagDocuments, knowledgeIntent, loadCompanyKnowledge, selectMainbrainExcerpts, selectPublicRagMemory } from "./company-knowledge";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadAssistantFixture } from "./test-data";

type KnowledgeFixture = {
  company_intent_cases: Array<{ question: string; previous_intent: string | null; expected: "company" | "sop" | null }>;
  retrieval_paraphrase_cases: Array<{ query: string; source: string }>;
};
const fixture = loadAssistantFixture<KnowledgeFixture>("knowledge_cases.json");

test("profil dan SOP perusahaan dibaca dari sumber terstruktur", async () => {
  const company = await loadCompanyKnowledge("siapa pendiri Daisuki", "company");
  expect(company.company?.legal_entity).toBe("PT Daisuki Pangan Indonesia");
  expect(composeKnowledgeReply(company, "company", "siapa pendiri Daisuki")).toContain("Tim Pendiri Daisuki Indonesia");
  const sop = await loadCompanyKnowledge("bagaimana cara scan resi", "sop");
  expect(sop.sop?.steps.length).toBeGreaterThan(0);
  expect(composeKnowledgeReply(sop, "sop", "cara scan resi")).toContain("1. **");
  expect(JSON.stringify(sop)).not.toContain("DLV-XXXXXXXX");
});

test("saat indeks biner siap, profil tersedia tanpa membaca dokumen Markdown", async () => {
  const result = await loadCompanyKnowledge("siapa pendiri Daisuki", "company", false);
  expect(result.company?.legal_entity).toBe("PT Daisuki Pangan Indonesia");
  expect(result.documents).toEqual([]);
});

test("retrieval mainbrain hanya membaca dokumen yang ditandai untuk mitra", () => {
  const results = selectMainbrainExcerpts("pendiri Daisuki", [
    { name: "cv-pribadi.md", content: "Pendiri Daisuki dan data pribadi seseorang yang tidak boleh dibagikan." },
    { name: "profil.public.md", content: "Pendiri Daisuki tercantum dalam profil perusahaan yang disetujui untuk mitra." },
  ]);
  expect(results).toHaveLength(1);
  expect(results[0].source).toBe("profil.public.md");
});

test("kebijakan RAG hanya menerima sumber terdaftar tanpa data kontak", () => {
  const files = filterRagDocuments([
    { name: "inventory_rules.public.md", content: "Buffer minimal adalah ambang peringatan." },
    { name: "assistant_identity.public.md", content: "Hubungi admin@example.com." },
    { name: "dokumen-baru.public.md", content: "Dokumen ini belum disetujui." },
  ]);
  expect(files.map((file) => file.name)).toEqual(["inventory_rules.public.md"]);
});

test("RAG memilih vektor publik yang relevan lalu fallback ke Markdown saat tidak ada", () => {
  const markdown = [{ source: "inventory_rules.public.md", version: "md", excerpt: "Aturan stok dari cadangan." }];
  const binary = [{ source: "inventory_rules.public.md", version: "pkl", excerpt: "Aturan stok dari vektor.", score: 0.4 }];
  expect(selectPublicRagMemory(binary, markdown)).toEqual({ documents: [{ source: binary[0].source, version: "pkl", excerpt: binary[0].excerpt }], memory: "daisuki.pkl" });
  expect(selectPublicRagMemory([{ ...binary[0], score: 0.01 }], markdown)).toEqual({ documents: markdown, memory: ".public.md" });
  expect(selectPublicRagMemory([{ ...binary[0], source: "private.pdf" }], markdown).memory).toBe(".public.md");
  expect(selectPublicRagMemory(undefined, []).memory).toBe("none");
  expect(selectPublicRagMemory([], []).memory).toBe("none");
});

test("pertanyaan profil dan panduan dikenali tanpa mengubah pertanyaan stok", () => {
  for (const item of fixture.company_intent_cases) expect(knowledgeIntent(item.question, item.previous_intent)).toBe(item.expected);
});

test("retrieval dokumen publik mengenali pertanyaan parafrasa", () => {
  const directory = resolve(import.meta.dir, "../../../../../ai/data/mainbrain/context_embeddings");
  const names = ["company-profile.public.md", "inventory_rules.public.md", "partner_workflows.public.md", "assistant_identity.public.md"];
  const files = filterRagDocuments(names.map((name) => ({ name, content: readFileSync(resolve(directory, name), "utf8") })));
  for (const item of fixture.retrieval_paraphrase_cases) {
    expect(selectMainbrainExcerpts(item.query, files).some((entry) => entry.source === item.source)).toBe(true);
  }
});
