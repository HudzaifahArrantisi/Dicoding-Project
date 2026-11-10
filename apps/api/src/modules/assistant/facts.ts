import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../../../../");
const factsPath = resolve(root, "ai/data/mainbrain/context_embeddings/weekly_operational_facts.json");
const modelPath = process.env.DAISUKI_MODEL_PATH || resolve(root, "ai/data/mainbrain/models/daisuki.pkl");

export interface WeeklyFacts {
  metadata: { generated_at: string; period_days: number; model_version: string; regional_generated_at?: string };
  central_warehouse: { total_stock_units: number; products: Array<{ id: string; name: string; sku: string; central_stock: number; category: string }> };
  network_sales: {
    total_sold_7d: number; total_sold_prev_7d: number; sales_growth_percentage: number | null;
    restock_fulfillment_rate: number | null; central_stock_health_days: number | null;
    requested_restock_units: number; approved_restock_units: number;
  };
  top_performers_partners: Array<{ rank: number; partner_name: string; region: string; weekly_units: number; percentage: number }>;
  top_selling_products: Array<{ rank: number; product_name: string; category: string; weekly_units: number; share_pct: number }>;
  top_selling_categories: Array<{ category: string; weekly_units: number; share_pct: number }>;
  regional_hotspots: Array<{ region: string; province: string; status: string; active_partners: number; weekly_units: number; stockout_probability: number; urgency: string; recommended_action: string }>;
}

export async function loadWeeklyFacts(): Promise<WeeklyFacts | null> {
  try {
    const value: unknown = JSON.parse(await readFile(factsPath, "utf8"));
    if (!value || typeof value !== "object") throw new Error("Snapshot fakta bukan objek");
    const facts = value as WeeklyFacts;
    if (!facts.metadata?.generated_at || !Number.isFinite(Date.parse(facts.metadata.generated_at)) ||
      !Array.isArray(facts.central_warehouse?.products) ||
      !Number.isFinite(facts.central_warehouse.total_stock_units) ||
      !Array.isArray(facts.top_selling_products) || !Array.isArray(facts.top_performers_partners) ||
      !Array.isArray(facts.regional_hotspots)) throw new Error("Format snapshot fakta tidak valid");
    return facts;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function getModelSyncStatus(facts: WeeklyFacts | null) {
  try {
    const model = await stat(modelPath);
    return { trained_at: model.mtime.toISOString(), synchronized: Boolean(facts && model.mtimeMs >= Date.parse(facts.metadata.generated_at)) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { trained_at: null, synchronized: false };
    throw error;
  }
}
