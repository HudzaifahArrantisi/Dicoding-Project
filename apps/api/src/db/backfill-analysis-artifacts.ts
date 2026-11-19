import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { db, sql } from "./client";
import { analysisRuns } from "./schema";
import { aiRunDir, dataScienceRunDir } from "../lib/analysis-artifacts";
import { saveAiArtifacts, saveDataScienceArtifacts } from "../lib/analysis-storage";

try {
  const runs = await db.select({ id: analysisRuns.id }).from(analysisRuns);
  let copied = 0;
  for (const run of runs) {
    const directory = dataScienceRunDir(run.id);
    const required = ["manifest.json", "weekly_analytics_summary.json", "cleaned_inventory_summary.csv",
      "weekly_analytics_report.md", "category_products.json", "category_partners.json",
      "category_regions.json", "category_reporting.json"];
    if (!required.every((name) => existsSync(resolve(directory, name)))) continue;
    const manifestPath = resolve(directory, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { run_id?: string };
    if (manifest.run_id !== run.id) throw new Error(`Manifest run ${run.id} tidak cocok`);
    await saveDataScienceArtifacts(run.id);
    if (existsSync(aiRunDir(run.id))) await saveAiArtifacts(run.id);
    copied++;
  }
  console.log(`Artefak run lama tersimpan di database: ${copied}/${runs.length} run`);
} finally {
  await sql.end();
}
