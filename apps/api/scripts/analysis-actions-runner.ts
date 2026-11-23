import { readFile, mkdir, writeFile } from "node:fs/promises";
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

async function python(script: string, args: string[] = [], rawDirectory?: string) {
  const child = Bun.spawn([process.env.DAISUKI_PYTHON_BIN || "python", resolve(workspaceRoot, script), ...args], {
    cwd: workspaceRoot,
    env: { ...process.env, DAISUKI_ANALYSIS_RUN_ID: id,
      ...(rawDirectory ? { DAISUKI_RAW_REFERENCES_DIR: rawDirectory } : {}) },
    stdout: "inherit", stderr: "inherit",
  });
  if (await child.exited !== 0) throw new Error(`${script} gagal`);
}

async function publishKv(source: string) {
  const token = process.env.CLOUDFLARE_KV_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const namespace = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
  if (!token || !account || !namespace) throw new Error("Secret Cloudflare KV belum lengkap");
  const content = await readFile(source);
  if (content.byteLength > 25 * 1024 * 1024) throw new Error("JSON model melebihi batas KV 25 MiB");
  const bundle = JSON.parse(content.toString("utf8")) as { format_version?: number; intent?: unknown };
  if (bundle.format_version !== 1 || !bundle.intent) throw new Error("JSON model tidak valid");
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${namespace}/values/daisuki`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
    body: content,
  });
  if (!response.ok) throw new Error(`Publikasi KV gagal (${response.status})`);
  console.log(`Model run ${id} terbit ke KV (${content.byteLength} bytes)`);
}

let cleanup: (() => Promise<void>) | undefined;
let started = false;
try {
  const [run] = await db.select().from(analysisRuns).where(eq(analysisRuns.id, id)).limit(1);
  if (!run) throw new Error("Run tidak ditemukan");
  if (stage === "draft") {
    if (run.status !== "creating") throw new Error(`Run tidak berstatus creating: ${run.status}`);
    started = true;
    await python("data-science/src/weekly_analytics_aggregator.py", ["--start-date", run.start_date,
      "--end-date", run.end_date, "--run-id", id]);
    const manifest = JSON.parse(await readFile(resolve(dataScienceRunDir(id), "manifest.json"), "utf8")) as Record<string, unknown>;
    if (manifest.run_id !== id || manifest.start_date !== run.start_date || manifest.end_date !== run.end_date) {
      throw new Error("Manifest laporan tidak cocok dengan run");
    }
    await saveDataScienceArtifacts(id);
    await db.update(analysisRuns).set({ status: "draft", manifest }).where(eq(analysisRuns.id, id));
    console.log(`Laporan ${id} siap ditinjau Admin`);
  } else {
    if (run.status !== "processing" || !run.processed_by) throw new Error("Run belum diklaim untuk training");
    started = true;
    const trainingSource = (run.manifest as Record<string, unknown> | null)?.training_source === "raw_references"
      ? "raw_references" : "analysis";
    await hydrateDataScienceArtifacts(id);
    const staged = await stageRawReferences(trainingSource === "raw_references");
    cleanup = staged.cleanup;
    if (trainingSource === "raw_references") {
      const active = await getActiveRunId();
      if (active) {
        const previous = await loadArtifact(active, "daisuki.pkl");
        if (previous) {
          await mkdir(aiRunDir(id), { recursive: true });
          await writeFile(resolve(aiRunDir(id), "daisuki.pkl"), previous);
        }
      }
    }
    const steps: { label: string; status: "running" | "succeeded" | "failed" }[] = [];
    for (const [label, script] of jobs) {
      steps.push({ label, status: "running" });
      await db.update(analysisRuns).set({ current_step: label, steps: [...steps] }).where(eq(analysisRuns.id, id));
      try {
        await python(script, script.endsWith("train.py") ? ["--weekly", "--training-source", trainingSource] : [], staged.directory);
        steps[steps.length - 1].status = "succeeded";
      } catch (error) {
        steps[steps.length - 1].status = "failed";
        await db.update(analysisRuns).set({ steps: [...steps] }).where(eq(analysisRuns.id, id));
        throw error;
      }
      await db.update(analysisRuns).set({ steps: [...steps] }).where(eq(analysisRuns.id, id));
    }
    await saveAiArtifacts(id);
    const modelPath = resolve(aiRunDir(id), "daisuki.pkl");
    const jsonPath = resolve(aiRunDir(id), "daisuki-worker.json");
    await python("ai/retraining/export_worker_classifier.py", [modelPath, jsonPath]);
    await publishKv(jsonPath);
    await publishRecommendations(id, run.processed_by, "analysis_published", true);
    console.log(`Training dan publikasi run ${id} selesai`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Pipeline gagal";
  if (started) {
    await db.update(analysisRuns).set({ status: "failed", current_step: null, error: message.slice(0, 600) })
      .where(eq(analysisRuns.id, id));
  }
  console.error(message);
  process.exitCode = 1;
} finally {
  await cleanup?.();
  await sql.end();
}
