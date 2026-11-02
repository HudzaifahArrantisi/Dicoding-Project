import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../../..");
const jobs = [
  "data-science/src/weekly_demand.py",
  "ai/jobs/weekly_restock_predictor.py",
  "ai/jobs/market_hotspot_analytics.py",
  "ai/jobs/regional_stockout_naive_bayes.py",
] as const;

let running: Promise<void> | null = null;
type PipelineStatus = {
  status: "idle" | "running" | "succeeded" | "failed";
  started_at: string | null;
  finished_at: string | null;
};
let pipelineStatus: PipelineStatus = {
  status: "idle",
  started_at: null,
  finished_at: null,
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
  pipelineStatus = { status: "running", started_at: new Date().toISOString(), finished_at: null };
  running = (async () => {
    for (const job of jobs) {
      const child = Bun.spawn([process.env.PYTHON_EXECUTABLE || "python", resolve(root, job)], {
        cwd: root,
        stdout: "pipe",
        stderr: "pipe",
      });
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      if (code !== 0) throw new Error(`${job} gagal (${code}): ${stderr.trim() || stdout.trim()}`);
      console.log(`[WEEKLY AI] ${job}: ${stdout.trim()}`);
    }
  })()
    .then(() => {
      pipelineStatus = { ...pipelineStatus, status: "succeeded", finished_at: new Date().toISOString() };
    })
    .catch((error) => {
      pipelineStatus = { ...pipelineStatus, status: "failed", finished_at: new Date().toISOString() };
      throw error;
    })
    .finally(() => { running = null; });
  return running;
}
