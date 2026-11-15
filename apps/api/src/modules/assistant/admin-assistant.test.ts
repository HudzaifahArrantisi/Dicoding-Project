import { describe, expect, it } from "bun:test";
import { loadAdminContext } from "./admin-context";
import { searchAdminKnowledge, loadCompanyProfileAndSop } from "./admin-knowledge";
import { buildAdminRagPrompt } from "./admin-prompt";
import { composeAdminFallbackReply } from "./admin-compose";
import type { ModelResult } from "./model";

const mockEmptyModel: ModelResult = {
  available: true,
  predictions: [],
  intent: { label: "company", confidence: 0.95 },
  identity: {
    name: "Daisuki AI Assistant",
    artifact: "daisuki.pkl",
    algorithm: "Multinomial Naive Bayes",
  },
};

describe("Admin AI Assistant", () => {
  it("loadAdminContext mengambil data gudang pusat dan ringkasan jaringan", async () => {
    const context = await loadAdminContext();
    expect(context).toBeDefined();
    expect(Array.isArray(context.warehouse)).toBe(true);
    expect(context.summary).toBeDefined();
    expect(typeof context.summary.total_active_partners).toBe("number");
    expect(typeof context.summary.total_central_stock).toBe("number");
    expect(Array.isArray(context.critical_branches)).toBe(true);
    expect(Array.isArray(context.pending_orders)).toBe(true);
  });

  it("searchAdminKnowledge menemukan dokumen karya ilmiah dan penelitian", async () => {
    const excerpts = await searchAdminKnowledge("siapa penulis karya ilmiah sentimen sgd logistic regression", 3);
    expect(excerpts.length).toBeGreaterThan(0);
    const top = excerpts[0];
    expect(top.excerpt).toMatch(/Hudzaifah|SGD|Logistic|JATISI|Sentimen|86\.27%/i);
  });

  it("searchAdminKnowledge menemukan aturan inventaris dan SOP", async () => {
    const excerpts = await searchAdminKnowledge("aturan stok buffer minimal dan restock", 3);
    expect(excerpts.length).toBeGreaterThan(0);
    expect(excerpts.some((e) => /buffer|stok|restock|rules/i.test(e.excerpt))).toBe(true);
  });

  it("buildAdminRagPrompt menyusun prompt komprehensif untuk Admin Pusat", async () => {
    const context = await loadAdminContext();
    const excerpts = await searchAdminKnowledge("stok gudang pusat", 2);
    const company = await loadCompanyProfileAndSop();
    const prompt = buildAdminRagPrompt({
      context,
      model: mockEmptyModel,
      knowledgeExcerpts: excerpts,
      companyData: company,
      memory: { summary: "Diskusi sebelumnya tentang restock", recent: "Admin: cek stok" },
    });

    expect(prompt).toContain("Asisten AI Administrator Pusat Daisuki Inventory");
    expect(prompt).toContain("FAKTA_DATABASE_REALTIME");
    expect(prompt).toContain("DOKUMEN_PENGETAHUAN_MAINBRAIN");
  });

  it("composeAdminFallbackReply menjawab data empiris karya ilmiah jika LLM timeout", async () => {
    const context = await loadAdminContext();
    const excerpts = await searchAdminKnowledge("karya ilmiah hudzaifah", 2);
    const reply = composeAdminFallbackReply("siapa penulis karya ilmiah sgd logistic regression", context, mockEmptyModel, excerpts);
    expect(reply.reply).toMatch(/Hudzaifah|Karya|Ilmiah|SGD/i);
    expect(reply.quickReplies.length).toBeGreaterThan(0);
  });

  it("composeAdminFallbackReply menjawab ketersediaan stok pusat secara real-time", async () => {
    const context = await loadAdminContext();
    const reply = composeAdminFallbackReply("berapa stok pusat saat ini?", context, mockEmptyModel, []);
    expect(reply.reply).toContain("Ketersediaan Stok Gudang Pusat Daisuki");
    expect(reply.reply).toContain("pcs");
  });
});
