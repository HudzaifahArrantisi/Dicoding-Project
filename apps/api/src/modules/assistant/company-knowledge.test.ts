import { expect, test } from "bun:test";
import { composeKnowledgeReply, filterRagDocuments, knowledgeIntent, loadCompanyKnowledge, selectMainbrainExcerpts } from "./company-knowledge";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("profil dan SOP perusahaan dibaca dari sumber terstruktur", async () => {
  const company = await loadCompanyKnowledge("siapa pendiri Daisuki", "company");
  expect(company.company?.legal_entity).toBe("PT Daisuki Pangan Indonesia");
  expect(composeKnowledgeReply(company, "company", "siapa pendiri Daisuki")).toContain("Tim Pendiri Daisuki Indonesia");
  const sop = await loadCompanyKnowledge("bagaimana cara scan resi", "sop");
  expect(sop.sop?.steps.length).toBeGreaterThan(0);
  expect(composeKnowledgeReply(sop, "sop", "cara scan resi")).toContain("1. **");
  expect(JSON.stringify(sop)).not.toContain("DLV-XXXXXXXX");
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

test("pertanyaan profil dan panduan dikenali tanpa mengubah pertanyaan stok", () => {
  expect(knowledgeIntent("siapa pendiri Daisuki?", null)).toBe("company");
  expect(knowledgeIntent("siapa developermu?", null)).toBe("company");
  expect(knowledgeIntent("siapa Hudzaifah?", null)).toBe("company");
  expect(knowledgeIntent("bagaimana cara scan resi?", null)).toBe("sop");
  expect(knowledgeIntent("berapa stok saya?", null)).toBeNull();
  expect(knowledgeIntent("siapa saja?", "company")).toBe("company");
});

test("retrieval dokumen publik mengenali pertanyaan parafrasa", () => {
  const directory = resolve(import.meta.dir, "../../../../../ai/data/mainbrain/context_embeddings");
  const names = ["company-profile.public.md", "inventory_rules.public.md", "partner_workflows.public.md", "assistant_identity.public.md"];
  const files = filterRagDocuments(names.map((name) => ({ name, content: readFileSync(resolve(directory, name), "utf8") })));
  const cases = [
    ["siapa perintis perusahaan ini", "company-profile.public.md"],
    ["bagaimana memindai label penerimaan dus", "partner_workflows.public.md"],
    ["bagaimana pengisian persediaan cabang", "partner_workflows.public.md"],
    ["apakah ada batas persediaan toko", "inventory_rules.public.md"],
  ];
  for (const [query, expected] of cases) {
    expect(selectMainbrainExcerpts(query, files).some((item) => item.source === expected)).toBe(true);
  }
});
