/**
 * Entry point Cloudflare Workers.
 *
 * Memuat aplikasi asli dari ./app.ts. Berkas itu tidak lagi memanggil
 * .listen(), tidak memasang cron berbasis timer, dan tidak menjalankan warmup
 * worker Python — semuanya tetap di ./index.ts untuk runtime Bun.
 *
 * Dua hal yang membuat ini bisa berjalan:
 *   1. `aot: false` di app.ts — mode aot memakai Function() yang dilarang Workers.
 *   2. Data ai/data/ dibundel saat build lewat apps/api/scripts/bundle-data.mjs,
 *      karena Workers tidak punya filesystem.
 *
 * Cron: @elysiajs/cron memakai timer dan tidak bisa jalan di Workers.
 * Jadwalnya dipasang ulang lewat handler `scheduled` di bawah, yang memanggil
 * ulang dua fungsi yang sama.
 */

import { app } from "./app";
import { createScheduledAnalysisDraft, remindPendingAnalysisRuns } from "./lib/analysis-runs";
import { withRequestDatabase, type ModelKv } from "./db/client";

/**
 * Bentuk minimal ScheduledController.
 *
 * @cloudflare/workers-types belum dipasang, dan menambahkannya mengubah tipe
 * global untuk seluruh proyek. Tipe lokal ini cukup untuk satu properti yang
 * benar-benar dipakai.
 */
type ScheduledController = { cron: string; scheduledTime: number };

export default {
  fetch(request: Request, env: { DAISUKI_MODEL?: ModelKv }): Promise<Response> {
    return withRequestDatabase(async () => app.fetch(request), env.DAISUKI_MODEL);
  },

  /**
   * Pengganti @elysiajs/cron milik Bun.
   *
   * Pasang di wrangler.jsonc:
   *   "triggers": { "crons": ["0 22 * * SUN", "0 2 * * *"] }
   *
   * Waktu cron Workers mengikuti UTC, sedangkan jadwal Bun memakai Asia/Jakarta
   * (UTC+7), jadi ekspresinya digeser tujuh jam ke belakang:
   *   05.00 WIB Senin  -> 22.00 UTC Minggu
   *   09.00 WIB harian -> 02.00 UTC
   */
  async scheduled(controller: ScheduledController, env: { DAISUKI_MODEL?: ModelKv }): Promise<void> {
    const isReminder = controller.cron.startsWith("0 2 ");
    const job = isReminder ? "analysis-pending-reminder" : "weekly-analysis-draft";
    try {
      await withRequestDatabase(async () => {
        if (isReminder) await remindPendingAnalysisRuns();
        else await createScheduledAnalysisDraft();
      }, env.DAISUKI_MODEL);
      console.log(`[CRON] ${job} selesai`);
    } catch (error) {
      console.error(`[CRON] ${job} gagal:`, error instanceof Error ? error.message : error);
    }
  },
};
