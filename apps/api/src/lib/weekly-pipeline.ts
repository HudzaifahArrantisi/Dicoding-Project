import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { desc } from "drizzle-orm";
import { db } from "../db/client";
import { analysisRuns } from "../db/schema";
import { activeRunId, aiRunDir } from "./analysis-artifacts";

type Chart = { days: Array<{ day: string; units: number }>;
  model: { available: boolean; sample_count: number; risk_counts: Record<string, number> } };

export async function getWeeklyPipelineStatus() {
  const rows = await db.select().from(analysisRuns).orderBy(desc(analysisRuns.created_at)).limit(20);
  const activeId = activeRunId();
  const active = rows.find((row) => row.id === activeId);
  const current = rows.find((row) => row.status === "processing") ?? active ?? rows[0];
  let chart: Chart | null = null;
  if (activeId) {
    try {
      chart = JSON.parse(await readFile(resolve(aiRunDir(activeId), "chart_data.json"), "utf8")) as Chart;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return {
    status: current?.status === "processing" ? "running" : current?.status === "failed" ? "failed" : active ? "succeeded" : "idle",
    training_source: current ? "data_science_csv" : null,
    started_at: current?.created_at.toISOString() ?? null,
    finished_at: current?.published_at?.toISOString() ?? null,
    current_step: current?.current_step ?? null,
    steps: current?.steps ?? [],
    chart,
  };
}
