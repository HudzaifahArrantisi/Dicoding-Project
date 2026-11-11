import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { workspaceRoot } from "./analysis-artifacts";

test("snapshot mitra dan dokumen internal tidak berada di direktori RAG publik", () => {
  const publicBrain = resolve(workspaceRoot, "ai/data/mainbrain/context_embeddings");
  for (const name of ["regional_stockout_insights.json", "weekly_operational_facts.json",
    "regional_stockout_insights.md", "weekly_operational_facts.md", "CV-Hudzaifah_Ar-Rantisi.md"]) {
    expect(existsSync(resolve(publicBrain, name))).toBe(false);
  }
  const publicWeb = resolve(workspaceRoot, "apps/web/public");
  for (const name of ["weekly_analytics_summary.json", "cleaned_inventory_summary.csv", "daisuki.pkl"]) {
    expect(existsSync(resolve(publicWeb, name))).toBe(false);
  }
});
