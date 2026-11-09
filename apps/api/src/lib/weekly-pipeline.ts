import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { publishInventoryChange } from "../realtime";

const root = resolve(import.meta.dir, "../../../..");
const python = process.env.DAISUKI_PYTHON_BIN || process.env.PYTHON_EXECUTABLE ||
  (existsSync(resolve(root, "ai/.venv/Scripts/python.exe")) ? resolve(root, "ai/.venv/Scripts/python.exe") :
  existsSync(resolve(root, "ai/.venv/bin/python")) ? resolve(root, "ai/.venv/bin/python") :
  process.platform === "win32" ? "python" : "python3");
const jobs = [
  { path: "data-science/src/weekly_demand.py", label: "Profil konsumsi mingguan" },
  { path: "ai/jobs/weekly_restock_predictor.py", label: "Rekomendasi restock" },
  { path: "ai/jobs/market_hotspot_analytics.py", label: "Analisis wilayah" },
  { path: "ai/jobs/regional_stockout_naive_bayes.py", label: "Risiko wilayah" },
  { path: "ai/jobs/weekly_facts_aggregator.py", label: "Ringkasan AI" },
  { path: "ai/retraining/train.py", label: "Pelatihan daisuki.pkl" },
  { path: "ai/retraining/chart_data.py", label: "Grafik konsumsi dan klasifikasi" },
] as const;

let running: Promise<void> | null = null;
type PipelineChart = {
  days: Array<{ day: string; units: number }>;
  model: { available: boolean; sample_count: number; risk_counts: Record<string, number> };
};
type PipelineStatus = {
  status: "idle" | "running" | "succeeded" | "failed";
  started_at: string | null;
  finished_at: string | null;
  current_step: string | null;
  steps: Array<{ label: string; status: "running" | "succeeded" | "failed" }>;
  chart: PipelineChart | null;
};
let pipelineStatus: PipelineStatus = {
  status: "idle",
  started_at: null,
  finished_at: null,
  current_step: null,
  steps: [],
  chart: null,
};

export function getWeeklyPipelineStatus(): PipelineStatus {
  return { ...pipelineStatus };
}

export function startWeeklyPipeline(): PipelineStatus {
  if (!running) {
    void runWeeklyPipeline().catch((error) => console.error("[WEEKLY AI]", error));
  }
  return getWeeklyPipelineStatus();
}

export function runWeeklyPipeline(): Promise<void> {
  if (running) return running;
  pipelineStatus = {
    status: "running", started_at: new Date().toISOString(), finished_at: null,
    current_step: null, steps: [], chart: null,
  };
  publishInventoryChange({ partnerId: null, topics: ["ai"] });
  running = (async () => {
    for (const job of jobs) {
      pipelineStatus.current_step = job.label;
      pipelineStatus.steps.push({ label: job.label, status: "running" });
      publishInventoryChange({ partnerId: null, topics: ["ai"] });
      try {
        const child = Bun.spawn([python, resolve(root, job.path)], {
          cwd: root,
          stdout: "pipe",
          stderr: "pipe",
        });
        const [code, stdout, stderr] = await Promise.all([
          child.exited,
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
        ]);
        if (code !== 0) throw new Error(`${job.path} gagal (${code}): ${stderr.trim() || stdout.trim()}`);
        if (job.path === "ai/retraining/chart_data.py") {
          const chart = JSON.parse(stdout.trim()) as PipelineChart;
          if (!Array.isArray(chart.days) || !chart.model || typeof chart.model.available !== "boolean") {
            throw new Error("Format data grafik dari Python tidak valid");
          }
          pipelineStatus.chart = chart;
        }
        console.log(`[WEEKLY AI] ${job.path}: ${job.path.endsWith("chart_data.py") ? "data grafik siap" : stdout.trim()}`);
        pipelineStatus.steps[pipelineStatus.steps.length - 1].status = "succeeded";
      } catch (error) {
        pipelineStatus.steps[pipelineStatus.steps.length - 1].status = "failed";
        throw error;
      }
      publishInventoryChange({ partnerId: null, topics: ["ai"] });
    }
  })()
    .then(() => {
      pipelineStatus = { ...pipelineStatus, status: "succeeded", current_step: null, finished_at: new Date().toISOString() };
      publishInventoryChange({ partnerId: null, topics: ["ai"] });
    })
    .catch((error) => {
      pipelineStatus = { ...pipelineStatus, status: "failed", current_step: null, finished_at: new Date().toISOString() };
      publishInventoryChange({ partnerId: null, topics: ["ai"] });
      throw error;
    })
    .finally(() => { running = null; });
  return running;
}
