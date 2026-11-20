/**
 * Entry point runtime Bun.
 *
 * Definisi aplikasi ada di ./app.ts agar bisa dipakai bersama Cloudflare
 * Workers (./worker.ts). Berkas ini hanya menambahkan hal yang khusus Bun:
 * cron berbasis timer, warmup worker Python, dan .listen().
 */

import { cron } from "@elysiajs/cron";
import { app } from "./app";
import { env } from "./env";
import { warmMitraModelWorker, stopMitraModelWorker } from "./modules/assistant/model";
import { createScheduledAnalysisDraft, recoverInterruptedAnalysisRuns, remindPendingAnalysisRuns } from "./lib/analysis-runs";

const server = app
  .use(
    cron({
      name: "weekly-analysis-draft",
      pattern: "0 5 * * 1",
      timezone: "Asia/Jakarta",
      run() {
        return createScheduledAnalysisDraft().catch((error) => console.error("[WEEKLY DRAFT]", error));
      },
    }),
  )
  .use(
    cron({
      name: "analysis-pending-reminder",
      pattern: "0 9 * * *",
      timezone: "Asia/Jakarta",
      run() {
        return remindPendingAnalysisRuns().catch((error) => console.error("[ANALYSIS REMINDER]", error));
      },
    }),
  )
  .onStop(stopMitraModelWorker)
  .listen({
    port: env.PORT,
    hostname: "0.0.0.0",
    idleTimeout: 120,
  });

console.log(
  `[${new Date().toLocaleTimeString()}] 🚀 Daisuki API berjalan di port ${server.server?.port} (host: 0.0.0.0)`,
);

warmMitraModelWorker();
process.once("exit", stopMitraModelWorker);
void recoverInterruptedAnalysisRuns().catch((error) => console.error("[ANALYSIS RECOVERY]", error));

export type { App } from "./app";
