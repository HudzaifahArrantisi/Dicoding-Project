import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { db, sql } from "../src/db/client";
import { analysisRuns } from "../src/db/schema";
import { aiRunDir, dataScienceRunDir, workspaceRoot } from "../src/lib/analysis-artifacts";
import { getActiveRunId, hydrateDataScienceArtifacts, loadArtifact, saveAiArtifacts, saveDataScienceArtifacts, stageRawReferences } from "../src/lib/analysis-storage";
import { publishRecommendations } from "../src/lib/analysis-runs";

const [stage, id] = process.argv.slice(2);
if ((stage !== "draft" && stage !== "train") || !id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
  throw new Error("Gunakan: bun apps/api/scripts/analysis-actions-runner.ts <draft|train> <run UUID>");
}

const jobs = [
  ["Risiko Naive Bayes", "ai/jobs/regional_stockout_naive_bayes.py"],
  ["Evaluasi historis model", "ai/jobs/evaluate_stockout.py"],
  ["Pratinjau alokasi", "ai/jobs/smart_allocation.py"],
  ["Fakta dashboard dan RAG", "ai/jobs/weekly_facts_aggregator.py"],
  ["Training daisuki.pkl", "ai/retraining/train.py"],
  ["Grafik konsumsi", "ai/retraining/chart_data.py"],
  ["Validasi hasil", "ai/jobs/validate_stage.py"],
] as const;

async function python(script: string, args: string[] = [], rawDirectory?: string, historicalRunIds: string[] = []) {
  const child = Bun.spawn([process.env.DAISUKI_PYTHON_BIN || "python", resolve(workspaceRoot, script), ...args], {
    cwd: workspaceRoot,
    env: { ...process.env, DAISUKI_ANALYSIS_RUN_ID: id,
      DAISUKI_HISTORICAL_RUN_IDS: historicalRunIds.join(","),
      ...(rawDirectory ? { DAISUKI_RAW_REFERENCES_DIR: rawDirectory } : {}) },
    stdout: "inherit", stderr: "inherit",
  });
  if (await child.exited !== 0) throw new Error(`${script} gagal`);
}

async function publishKv(source: string, key = "daisuki") {
  const token = process.env.CLOUDFLARE_KV_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const namespace = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
  if (!token || !account || !namespace) throw new Error("Secret Cloudflare KV belum lengkap");
  const content = await readFile(source);
  if (content.byteLength > 25 * 1024 * 1024) throw new Error("JSON model melebihi batas KV 25 MiB");
  const bundle = JSON.parse(content.toString("utf8")) as { format_version?: number; intent?: unknown; analysis_retrieval?: unknown };
  if (bundle.format_version !== 1 || (key === "daisuki" ? !bundle.intent : !bundle.analysis_retrieval)) {
    throw new Error("JSON model tidak valid");
  }
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${namespace}/values/${key}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
    body: content,
  });
  if (!response.ok) throw new Error(`Publikasi KV gagal (${response.status})`);
  console.log(`Model run ${id}: ${key} terbit ke KV (${content.byteLength} bytes)`);
}

let cleanup: (() => Promise<void>) | undefined;
let started = false;
const trackedSteps: { label: string; status: "running" | "succeeded" | "failed" }[] = [];
async function beginStep(label: string) {
  trackedSteps.push({ label, status: "running" });
  await db.update(analysisRuns).set({ current_step: label, steps: [...trackedSteps] }).where(eq(analysisRuns.id, id));
}
async function finishStep(status: "succeeded" | "failed" = "succeeded") {
  const step = trackedSteps[trackedSteps.length - 1];
  if (!step) return;
  step.status = status;
  await db.update(analysisRuns).set({ steps: [...trackedSteps] }).where(eq(analysisRuns.id, id));
}
try {
  const connectionRows = await sql`
    SELECT current_database() AS database,
      current_user AS role,
      has_table_privilege(current_user, 'public.analysis_runs', 'SELECT') AS can_read_run
  `;
  const connection = connectionRows[0] as { database: string; role: string; can_read_run: boolean };
  console.log(`[DB] database=${connection.database} role=${connection.role} analysis_runs_select=${connection.can_read_run}`);
  const [run] = await db.select().from(analysisRuns).where(eq(analysisRuns.id, id)).limit(1);
  if (!run) throw new Error("Run tidak ditemukan");
  if (stage === "draft") {
    if (run.status !== "creating") throw new Error(`Run tidak berstatus creating: ${run.status}`);
    started = true;
    await beginStep("Agregasi data mingguan dan empat kategori analisis");
    await python("data-science/src/weekly_analytics_aggregator.py", ["--start-date", run.start_date,
      "--end-date", run.end_date, "--run-id", id, "--as-of", run.created_at.toISOString()]);
    await finishStep();
    await beginStep("Simpan laporan dan artefak analisis ke Neon");
    const manifest = JSON.parse(await readFile(resolve(dataScienceRunDir(id), "manifest.json"), "utf8")) as Record<string, unknown>;
    if (manifest.run_id !== id || manifest.start_date !== run.start_date || manifest.end_date !== run.end_date) {
      throw new Error("Manifest laporan tidak cocok dengan run");
    }
    await saveDataScienceArtifacts(id);
    await finishStep();
    await db.update(analysisRuns).set({ status: "draft", manifest }).where(eq(analysisRuns.id, id));
    console.log(`Laporan ${id} siap ditinjau Admin`);
  } else {
    if (run.status !== "processing" || !run.processed_by) throw new Error("Run belum diklaim untuk training");
    started = true;
    await beginStep("Persiapan data sumber dan model sebelumnya");
    const trainingSource = (run.manifest as Record<string, unknown> | null)?.training_source === "raw_references"
      ? "raw_references" : "analysis";
    await hydrateDataScienceArtifacts(id);
    const publishedRuns = await db.select({ id: analysisRuns.id, start_date: analysisRuns.start_date }).from(analysisRuns)
      .where(eq(analysisRuns.status, "published")).orderBy(analysisRuns.published_at);
    const latestByStart = new Map(publishedRuns.map((published) => [published.start_date, published]));
    const historicalRunIds: string[] = [];
    for (const previousRun of latestByStart.values()) {
      if (previousRun.id === id) continue;
      try {
        await hydrateDataScienceArtifacts(previousRun.id);
      } catch (error) {
        console.warn(`Arsip run ${previousRun.id} tidak lengkap; gunakan arsip model sebelumnya: ${error instanceof Error ? error.message : "Error"}`);
        continue;
      }
      const previousAiDir = aiRunDir(previousRun.id);
      for (const name of ["weekly_operational_facts.json", "regional_stockout_insights.json",
        "model_evaluation.json", "allocation_preview.json"]) {
        const content = await loadArtifact(previousRun.id, name);
        if (content) {
          await mkdir(previousAiDir, { recursive: true });
          await writeFile(resolve(previousAiDir, name), content);
        }
      }
      historicalRunIds.push(previousRun.id);
    }
    const staged = await stageRawReferences(trainingSource === "raw_references");
    cleanup = staged.cleanup;
    const active = await getActiveRunId();
    if (active) {
      const previous = await loadArtifact(active, "daisuki.pkl");
      if (previous) {
        await mkdir(aiRunDir(id), { recursive: true });
        await writeFile(resolve(aiRunDir(id), "daisuki.pkl"), previous);
      }
    }
    await finishStep();
    for (const [label, script] of jobs) {
      await beginStep(label);
      try {
        await python(script, script.endsWith("train.py") ? ["--weekly", "--training-source", trainingSource] : [], staged.directory, historicalRunIds);
        await finishStep();
      } catch (error) {
        await finishStep("failed");
        throw error;
      }
    }
    await beginStep("Simpan artefak model dan hasil AI ke Neon");
    await saveAiArtifacts(id);
    await finishStep();
    await beginStep("Ekspor daisuki.pkl menjadi JSON untuk Worker");
    const modelPath = resolve(aiRunDir(id), "daisuki.pkl");
    const jsonPath = resolve(aiRunDir(id), "daisuki-worker.json");
    await python("ai/retraining/export_worker_classifier.py", [modelPath, jsonPath]);
    await finishStep();
    await beginStep("Publikasi model JSON ke Cloudflare KV");
    for (const name of (await readdir(aiRunDir(id))).filter((entry) => /^daisuki-history-[0-9a-f-]{36}-\d{4}-\d{2}-\d{2}\.json$/.test(entry))) {
      await publishKv(resolve(aiRunDir(id), name), name.slice(0, -5));
    }
    await publishKv(jsonPath);
    await finishStep();
    await beginStep("Terbitkan hasil analisis aktif");
    await publishRecommendations(id, run.processed_by, "analysis_published", true);
    await finishStep();
    console.log(`Training dan publikasi run ${id} selesai`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Pipeline gagal";
  if (started) {
    const current = trackedSteps[trackedSteps.length - 1];
    if (current?.status === "running") current.status = "failed";
    await db.update(analysisRuns).set({ status: "failed", current_step: null, steps: [...trackedSteps], error: message.slice(0, 600) })
      .where(eq(analysisRuns.id, id));
  }
  console.error(message);
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause instanceof Error) {
    const code = "code" in cause && typeof cause.code === "string" ? ` code=${cause.code}` : "";
    console.error(`Database cause:${code} ${cause.message}`);
  }
  process.exitCode = 1;
} finally {
  await cleanup?.();
  await sql.end();
}
