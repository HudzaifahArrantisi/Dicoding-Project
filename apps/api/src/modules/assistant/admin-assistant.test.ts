import { describe, expect, it } from "bun:test";
import type { ModelResult } from "./model";

// Modul admin-* membuat koneksi database saat diimpor, jadi baru dimuat ketika
// test integrasi diaktifkan (DAISUKI_TEST_DB=1 dan DATABASE_URL asli).
// Tanpa itu, suite dilewati agar job CI offline tetap hijau.
const hasDatabase = process.env.DAISUKI_TEST_DB === "1" && Boolean(process.env.DATABASE_URL);

const modules = hasDatabase
  ? Promise.all([
      import("./admin-context"),
      import("./admin-knowledge"),
      import("./admin-prompt"),
      import("./admin-compose"),
    ])
  : null;

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

describe.skipIf(!hasDatabase)("Admin AI Assistant", () => {
  it("loadAdminContext mengambil data gudang pusat dan ringkasan jaringan", async () => {
    const [{ loadAdminContext }] = await modules!;
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
    const [, { searchAdminKnowledge }] = await modules!;
    const excerpts = await searchAdminKnowledge("siapa penulis karya ilmiah sentimen sgd logistic regression", 3);
    expect(excerpts.length).toBeGreaterThan(0);
    const top = excerpts[0];
    expect(top.excerpt).toMatch(/Hudzaifah|SGD|Logistic|JATISI|Sentimen|86\.27%/i);
  });

  it("searchAdminKnowledge menemukan aturan inventaris dan SOP", async () => {
    const [, { searchAdminKnowledge }] = await modules!;
    const excerpts = await searchAdminKnowledge("aturan stok buffer minimal dan restock", 3);
    expect(excerpts.length).toBeGreaterThan(0);
    expect(excerpts.some((e) => /buffer|stok|restock|rules/i.test(e.excerpt))).toBe(true);
  });

  it("buildAdminRagPrompt menyusun prompt komprehensif untuk Admin Pusat", async () => {
    const [{ loadAdminContext }, { searchAdminKnowledge, loadCompanyProfileAndSop }, { buildAdminRagPrompt }] =
      await modules!;
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
    const [{ loadAdminContext }, { searchAdminKnowledge }, , { composeAdminFallbackReply }] = await modules!;
    const context = await loadAdminContext();
    const excerpts = await searchAdminKnowledge("karya ilmiah hudzaifah", 2);
    const reply = composeAdminFallbackReply("siapa penulis karya ilmiah sgd logistic regression", context, mockEmptyModel, excerpts);
    expect(reply.reply).toMatch(/Hudzaifah|Karya|Ilmiah|SGD/i);
    expect(reply.quickReplies.length).toBeGreaterThan(0);
  });

  it("composeAdminFallbackReply menjawab ketersediaan stok pusat secara real-time", async () => {
    const [{ loadAdminContext }, , , { composeAdminFallbackReply }] = await modules!;
    const context = await loadAdminContext();
    const reply = composeAdminFallbackReply("berapa stok pusat saat ini?", context, mockEmptyModel, []);
    expect(reply.reply).toContain("Ketersediaan Stok Gudang Pusat Daisuki");
    expect(reply.reply).toContain("pcs");
  });

  it("composeAdminFallbackReply memakai referensi privat saat model bahasa gagal", async () => {
    const [{ loadAdminContext }, , , { composeAdminFallbackReply }] = await modules!;
    const context = await loadAdminContext();
    const reply = composeAdminFallbackReply("siapa itu Contoh?", context, mockEmptyModel, [{
      source: "pdf/CV Contoh.pdf", version: "daisuki.pkl", title: "CV Contoh.pdf",
      excerpt: "Contoh adalah mahasiswi aktif yang tertarik pada teknologi dan organisasi.",
    }]);
    expect(reply.reply).toContain("Contoh adalah mahasiswi aktif");
  });
});
