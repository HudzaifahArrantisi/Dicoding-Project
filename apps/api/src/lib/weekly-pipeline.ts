import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../../..");
const jobs = [
  "data-science/src/weekly_demand.py",
  "ai/jobs/weekly_restock_predictor.py",
  "ai/jobs/market_hotspot_analytics.py",
] as const;

let running: Promise<void> | null = null;

export function runWeeklyPipeline(): Promise<void> {
  if (running) return running;
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
  })().finally(() => { running = null; });
  return running;
}
