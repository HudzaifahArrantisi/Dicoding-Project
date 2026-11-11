import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client";
import { analysisRuns, auditLogs, notifications, products, restockRecommendations } from "../db/schema";
import { aiRunDir, clearActiveRun, dataScienceRunDir, activeRunId, publishActiveRun, workspaceRoot } from "./analysis-artifacts";
import { reloadMitraModelWorker } from "../modules/assistant/model";
import { publishInventoryChange } from "../realtime";

const python = process.env.DAISUKI_PYTHON_BIN || process.env.PYTHON_EXECUTABLE ||
  (existsSync(resolve(workspaceRoot, "ai/.venv/Scripts/python.exe")) ? resolve(workspaceRoot, "ai/.venv/Scripts/python.exe") :
    existsSync(resolve(workspaceRoot, "ai/.venv/bin/python")) ? resolve(workspaceRoot, "ai/.venv/bin/python") :
      process.platform === "win32" ? "python" : "python3");
const jobs = [
  { path: "ai/jobs/regional_stockout_naive_bayes.py", label: "Risiko Naive Bayes" },
  { path: "ai/jobs/evaluate_stockout.py", label: "Evaluasi historis model" },
  { path: "ai/jobs/smart_allocation.py", label: "Pratinjau alokasi" },
  { path: "ai/jobs/weekly_facts_aggregator.py", label: "Fakta dashboard dan RAG" },
  { path: "ai/retraining/train.py", label: "Training daisuki.pkl" },
  { path: "ai/retraining/chart_data.py", label: "Grafik konsumsi" },
  { path: "ai/jobs/validate_stage.py", label: "Validasi hasil" },
] as const;
const running = new Set<string>();
type Step = { label: string; status: "running" | "succeeded" | "failed" };
type PreviewItem = { partner_id: string; partner_name: string; product_id: string; product_name: string;
  forecast_qty: number; days_of_cover: number; suggested_qty: number; priority_rule: boolean; stockout_probability: number };

async function pythonJob(script: string, runId: string, args: string[] = []): Promise<string> {
  const child = Bun.spawn([python, resolve(workspaceRoot, script), ...args], {
    cwd: workspaceRoot,
    env: { ...process.env, DAISUKI_ANALYSIS_RUN_ID: runId },
    stdout: "pipe", stderr: "pipe",
  });
  const [code, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ]);
  if (code !== 0) throw new Error((stderr.trim() || stdout.trim() || "Job Python gagal").slice(0, 600));
  return stdout;
}

export async function listAnalysisRuns() {
  return db.select().from(analysisRuns).orderBy(desc(analysisRuns.created_at)).limit(30);
}

export async function createAnalysisDraft(startDate: string, endDate: string, actorId: string | null) {
  const id = crypto.randomUUID();
  await db.insert(analysisRuns).values({ id, start_date: startDate, end_date: endDate,
    status: "creating", created_by: actorId });
  try {
    await pythonJob("data-science/src/weekly_analytics_aggregator.py", id,
      ["--start-date", startDate, "--end-date", endDate, "--run-id", id]);
    const manifest = JSON.parse(await readFile(resolve(dataScienceRunDir(id), "manifest.json"), "utf8")) as Record<string, unknown>;
    if (manifest.run_id !== id || manifest.start_date !== startDate || manifest.end_date !== endDate) {
      throw new Error("Manifest laporan tidak cocok dengan permintaan");
    }
    await db.update(analysisRuns).set({ status: "draft", manifest }).where(eq(analysisRuns.id, id));
    if (actorId) await db.insert(auditLogs).values({ actor_id: actorId, action: "analysis_draft_created",
      target_type: "analysis_run", target_id: id });
    publishInventoryChange({ partnerId: null, topics: ["ai"] });
    return id;
  } catch (error) {
    await db.update(analysisRuns).set({ status: "failed", error: error instanceof Error ? error.message.slice(0, 600) : "Gagal membuat laporan" })
      .where(eq(analysisRuns.id, id));
    throw error;
  }
}

export async function createScheduledAnalysisDraft(): Promise<void> {
  const end = new Date(Date.now() + 7 * 60 * 60_000 - 86_400_000);
  const start = new Date(end.getTime() - 6 * 86_400_000);
  const endDate = end.toISOString().slice(0, 10);
  const startDate = start.toISOString().slice(0, 10);
  const [existing] = await db.select({ id: analysisRuns.id }).from(analysisRuns)
    .where(and(eq(analysisRuns.start_date, startDate), eq(analysisRuns.end_date, endDate),
      inArray(analysisRuns.status, ["creating", "draft", "approved", "processing", "published"]))).limit(1);
  if (!existing) await createAnalysisDraft(startDate, endDate, null);
}

export async function recoverInterruptedAnalysisRuns(): Promise<void> {
  await db.update(analysisRuns).set({ status: "failed", current_step: null,
    error: "Proses terputus saat server dimulai ulang. Buat laporan baru untuk mencoba lagi." })
    .where(inArray(analysisRuns.status, ["creating", "processing"]));
}

export async function remindPendingAnalysisRuns(): Promise<void> {
  const pending = await db.select().from(analysisRuns)
    .where(inArray(analysisRuns.status, ["draft", "approved"])).orderBy(desc(analysisRuns.created_at)).limit(20);
  for (const run of pending) {
    if (Date.now() - run.created_at.getTime() < 86_400_000) continue;
    const [existing] = await db.select({ id: notifications.id }).from(notifications)
      .where(and(eq(notifications.type, "analysis_pending"), eq(notifications.body, run.id))).limit(1);
    if (existing) continue;
    await db.insert(notifications).values({ audience: "admin", type: "analysis_pending", partner_id: null,
      title: run.status === "draft" ? "Laporan Data Science menunggu tinjauan" : "Laporan menunggu AI Engineer",
      body: run.id });
  }
}

export async function approveAnalysisRun(id: string, actorId: string) {
  const [run] = await db.update(analysisRuns).set({ status: "approved", approved_by: actorId, approved_at: new Date(), error: null })
    .where(and(eq(analysisRuns.id, id), eq(analysisRuns.status, "draft"))).returning();
  if (run) await db.insert(auditLogs).values({ actor_id: actorId, action: "analysis_approved",
    target_type: "analysis_run", target_id: id });
  return run ?? null;
}

async function publishRecommendations(runId: string, actorId: string, action: "analysis_published" | "analysis_rollback", notify: boolean): Promise<void> {
  const preview = JSON.parse(await readFile(resolve(aiRunDir(runId), "allocation_preview.json"), "utf8")) as {
    source_run_id: string; items: PreviewItem[] };
  if (preview.source_run_id !== runId || !Array.isArray(preview.items)) throw new Error("Pratinjau alokasi tidak valid");
  const ids = [...new Set(preview.items.map((item) => item.product_id))];
  await db.transaction(async (tx) => {
    const stockRows = await tx.select({ id: products.id, central_stock: products.central_stock })
      .from(products).where(inArray(products.id, ids)).for("update");
    const remaining = new Map(stockRows.map((row) => [row.id, row.central_stock]));
    const rows = preview.items.map((item) => {
      const available = remaining.get(item.product_id) ?? 0;
      const suggested = Math.min(Math.max(0, item.suggested_qty), available);
      remaining.set(item.product_id, available - suggested);
      return {
        partner_id: item.partner_id, product_id: item.product_id,
        forecast_qty: Math.max(0, item.forecast_qty), suggested_qty: suggested,
        days_of_cover: String(Math.max(0, item.days_of_cover)),
        model_version: "v2.0-deep-naive-bayes", metadata: { source_run_id: runId },
      };
    });
    if (rows.length) {
      await tx.insert(restockRecommendations).values(rows).onConflictDoUpdate({
        target: [restockRecommendations.partner_id, restockRecommendations.product_id],
        set: {
          forecast_qty: sql`excluded.forecast_qty`,
          suggested_qty: sql`excluded.suggested_qty`,
          days_of_cover: sql`excluded.days_of_cover`,
          model_version: sql`excluded.model_version`,
          metadata: sql`excluded.metadata`,
          generated_at: sql`now()`,
        },
      });
    }
    await tx.update(analysisRuns).set({ is_active: false }).where(eq(analysisRuns.is_active, true));
    await tx.update(analysisRuns).set({ status: "published", is_active: true, published_at: new Date(), current_step: null })
      .where(eq(analysisRuns.id, runId));
    const alerts = preview.items.filter((item) => item.priority_rule &&
      rows.find((row) => row.partner_id === item.partner_id && row.product_id === item.product_id)?.suggested_qty);
    if (notify && alerts.length) await tx.insert(notifications).values(alerts.map((item) => ({
      audience: "admin", type: "low_stock", partner_id: item.partner_id,
      title: "Prioritas Suplai: " + item.partner_name,
      body: item.product_name + " perlu ditinjau untuk restock pada laporan " + runId + ".",
    })));
    await tx.insert(auditLogs).values({ actor_id: actorId, action,
      target_type: "analysis_run", target_id: runId });
  });
}

export function processAnalysisRun(id: string, actorId: string): void {
  if (running.has(id)) return;
  running.add(id);
  void (async () => {
    const [claimed] = await db.update(analysisRuns).set({ status: "processing", processed_by: actorId, error: null, steps: [] })
      .where(and(eq(analysisRuns.id, id), eq(analysisRuns.status, "approved"))).returning();
    if (!claimed) return;
    const steps: Step[] = [];
    try {
      for (const job of jobs) {
        steps.push({ label: job.label, status: "running" });
        await db.update(analysisRuns).set({ current_step: job.label, steps: [...steps] }).where(eq(analysisRuns.id, id));
        try {
          await pythonJob(job.path, id);
          steps[steps.length - 1].status = "succeeded";
        } catch (error) {
          steps[steps.length - 1].status = "failed";
          throw error;
        }
        await db.update(analysisRuns).set({ steps: [...steps] }).where(eq(analysisRuns.id, id));
      }
      const previous = activeRunId();
      await publishActiveRun(id);
      try {
        await publishRecommendations(id, actorId, "analysis_published", true);
      } catch (error) {
        if (previous) await publishActiveRun(previous);
        else await clearActiveRun();
        throw error;
      }
      reloadMitraModelWorker();
      publishInventoryChange({ partnerId: null, topics: ["ai"] });
    } catch (error) {
      await db.update(analysisRuns).set({ status: "failed", current_step: null, steps,
        error: error instanceof Error ? error.message.slice(0, 600) : "Pipeline AI gagal" })
        .where(eq(analysisRuns.id, id));
      console.error("[ANALYSIS] Run gagal", id, error instanceof Error ? error.message : error);
    }
  })().catch((error) => console.error("[ANALYSIS] Gagal memulai run", id, error)).finally(() => running.delete(id));
}

export async function rollbackAnalysisRun(id: string, actorId: string): Promise<boolean> {
  const [target] = await db.select().from(analysisRuns).where(and(eq(analysisRuns.id, id), eq(analysisRuns.status, "published"))).limit(1);
  if (!target) return false;
  const previous = activeRunId();
  await publishActiveRun(id);
  try {
    await publishRecommendations(id, actorId, "analysis_rollback", false);
  } catch (error) {
    if (previous) await publishActiveRun(previous);
    else await clearActiveRun();
    throw error;
  }
  reloadMitraModelWorker();
  publishInventoryChange({ partnerId: null, topics: ["ai"] });
  return true;
}
