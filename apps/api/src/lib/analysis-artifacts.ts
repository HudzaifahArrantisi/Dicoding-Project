import { readFileSync } from "node:fs";
import { readFile, rename, writeFile, mkdir, unlink } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Direktori modul ini.
 *
 * import.meta.dir tidak ada di Cloudflare Workers. Mengevaluasinya langsung di
 * resolve() membuat seluruh aplikasi gagal diimpor dengan
 * "The paths[0] argument must be of type string. Received undefined".
 *
 * Nilai cadangan hanya agar modul bisa dimuat. Jalur berkas di bawah ini tidak
 * pernah dipakai di Workers karena runtime itu tidak punya filesystem — fungsi
 * yang benar-benar membacanya akan gagal saat dipanggil, bukan saat impor.
 */
function moduleDir(): string {
  return typeof import.meta.dir === "string" ? import.meta.dir : "/app/apps/api/src/lib";
}

export const workspaceRoot = resolve(moduleDir(), "../../../..");
export const privateRoot = resolve(workspaceRoot, "ai/data/private");
const activePath = resolve(privateRoot, "active_run.json");
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function activeRunId(): string | null {
  // Cloudflare Workers menyimpan run aktif di Neon, bukan file lokal.
  if (typeof Bun === "undefined") return null;
  try {
    const value = JSON.parse(readFileSync(activePath, "utf8")) as { run_id?: string };
    return value.run_id && uuidPattern.test(value.run_id) ? value.run_id : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function dataScienceRunDir(runId: string): string {
  if (!uuidPattern.test(runId)) throw new Error("ID run tidak valid");
  return resolve(workspaceRoot, "data-science/reports/runs", runId);
}

export function aiRunDir(runId: string): string {
  if (!uuidPattern.test(runId)) throw new Error("ID run tidak valid");
  return resolve(privateRoot, "runs", runId);
}

export function activeArtifact(kind: "facts" | "report" | "regional" | "model" | "evaluation"): string {
  const runId = activeRunId();
  if (runId) {
    if (kind === "report") return resolve(dataScienceRunDir(runId), "weekly_analytics_summary.json");
    const dir = aiRunDir(runId);
    return resolve(dir, kind === "facts" ? "weekly_operational_facts.json" :
      kind === "regional" ? "regional_stockout_insights.json" :
      kind === "evaluation" ? "model_evaluation.json" : "daisuki.pkl");
  }
  return resolve(workspaceRoot, kind === "report" ? "data-science/reports/weekly_analytics_summary.json" :
    kind === "facts" ? "ai/data/private/legacy/weekly_operational_facts.json" :
    kind === "regional" ? "ai/data/private/legacy/regional_stockout_insights.json" :
    kind === "evaluation" ? "ai/data/private/legacy/model_evaluation.json" :
    "ai/data/mainbrain/models/daisuki.pkl");
}

export async function publishActiveRun(runId: string): Promise<void> {
  if (!uuidPattern.test(runId)) throw new Error("ID run tidak valid");
  await mkdir(privateRoot, { recursive: true });
  const temporary = resolve(privateRoot, `active_run.${runId}.tmp`);
  await writeFile(temporary, JSON.stringify({ run_id: runId, published_at: new Date().toISOString() }), "utf8");
  await rename(temporary, activePath);
}

export async function clearActiveRun(): Promise<void> {
  await unlink(activePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

export async function readActiveManifest(): Promise<{ run_id: string } | null> {
  try {
    const result = JSON.parse(await readFile(activePath, "utf8")) as { run_id: string };
    return uuidPattern.test(result.run_id) ? result : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
