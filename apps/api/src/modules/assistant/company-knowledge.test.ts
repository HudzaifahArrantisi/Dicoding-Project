import { expect, test } from "bun:test";
import { composeKnowledgeReply, knowledgeIntent, loadCompanyKnowledge, selectMainbrainExcerpts } from "./company-knowledge";

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

test("pertanyaan profil dan panduan dikenali tanpa mengubah pertanyaan stok", () => {
  expect(knowledgeIntent("siapa pendiri Daisuki?", null)).toBe("company");
  expect(knowledgeIntent("bagaimana cara scan resi?", null)).toBe("sop");
  expect(knowledgeIntent("berapa stok saya?", null)).toBeNull();
  expect(knowledgeIntent("siapa saja?", "company")).toBe("company");
});
