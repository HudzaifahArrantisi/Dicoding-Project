import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { analysisRunArtifacts, analysisRuns, rawReferences } from "../db/schema";
import { activeArtifact, activeRunId, aiRunDir, dataScienceRunDir } from "./analysis-artifacts";

const allowed = new Set(["pdf", "csv", "json", "md", "txt", "docx"]);
const dataScienceNames = ["manifest.json", "weekly_analytics_summary.json", "cleaned_inventory_summary.csv",
  "weekly_analytics_report.md", "category_products.json", "category_partners.json",
  "category_regions.json", "category_reporting.json"] as const;
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export function validateRawReference(file: Pick<File, "name" | "size">): { category: string; fileName: string } {
  const fileName = file.name.trim();
  const category = fileName.split(".").slice(-1)[0]?.toLowerCase() ?? "";
  if (!allowed.has(category) || fileName.length > 180 || !/^[\p{L}\p{N}][\p{L}\p{N} ._()\-]*$/u.test(fileName)) {
    throw new Error("Nama file tidak valid. Gunakan PDF, CSV, JSON, MD, TXT, atau DOCX.");
  }
  if (file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error("Ukuran file harus 1 byte sampai 10 MB.");
  return { category, fileName };
}

export async function saveRawReference(file: File, actorId: string) {
  const { category, fileName } = validateRawReference(file);
  const content = Buffer.from(await file.arrayBuffer());
  if (category === "pdf" && !content.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Isi file bukan PDF yang valid.");
  if (category === "docx" && !content.subarray(0, 2).equals(Buffer.from("PK"))) throw new Error("Isi file bukan DOCX yang valid.");
  if (!["pdf", "docx"].includes(category)) {
    const value = textDecoder.decode(content);
    if (category === "json") JSON.parse(value);
  }
  const mimeType = { pdf: "application/pdf", csv: "text/csv", json: "application/json",
    md: "text/markdown", txt: "text/plain", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }[category]!;
  const hash = createHash("sha256").update(content).digest("hex");
  const [row] = await db.insert(rawReferences).values({ category, file_name: fileName, mime_type: mimeType,
    size_bytes: content.length, sha256: hash, content, uploaded_by: actorId }).onConflictDoUpdate({
    target: [rawReferences.category, rawReferences.file_name],
    set: { mime_type: mimeType, size_bytes: content.length, sha256: hash, content, uploaded_by: actorId,
      created_at: new Date() },
  }).returning({ id: rawReferences.id, category: rawReferences.category, file_name: rawReferences.file_name,
    size_bytes: rawReferences.size_bytes, sha256: rawReferences.sha256, created_at: rawReferences.created_at });
  return row;
}

export async function listRawReferences() {
  const rows = await db.select({ id: rawReferences.id, category: rawReferences.category, file_name: rawReferences.file_name,
    size_bytes: rawReferences.size_bytes, sha256: rawReferences.sha256, created_at: rawReferences.created_at,
    uploaded_by: rawReferences.uploaded_by })
    .from(rawReferences).orderBy(desc(rawReferences.created_at)).limit(100);
  return rows.map(({ uploaded_by, ...row }) => ({ ...row, origin: uploaded_by ? "admin" as const : "migration" as const }));
}

async function saveArtifact(runId: string, kind: "data_science" | "ai", fileName: string, content: Buffer) {
  if (content.length > 20 * 1024 * 1024) throw new Error(`Artefak ${fileName} melebihi 20 MB`);
  const mimeType = fileName.endsWith(".json") ? "application/json" : fileName.endsWith(".csv") ? "text/csv" :
    fileName.endsWith(".md") ? "text/markdown" : "application/octet-stream";
  const payload = mimeType === "application/json" ? JSON.parse(textDecoder.decode(content)) : null;
  await db.insert(analysisRunArtifacts).values({ run_id: runId, file_name: fileName, kind, mime_type: mimeType,
    size_bytes: content.length, sha256: createHash("sha256").update(content).digest("hex"), content, payload })
    .onConflictDoNothing();
}

export async function saveDataScienceArtifacts(runId: string) {
  const directory = dataScienceRunDir(runId);
  for (const name of dataScienceNames) await saveArtifact(runId, "data_science", name, await readFile(resolve(directory, name)));
}

export async function saveAiArtifacts(runId: string) {
  const directory = aiRunDir(runId);
  for (const name of await readdir(directory)) {
    if (!/^[a-z0-9_.-]+\.(json|csv|md|pkl)$/i.test(name)) continue;
    await saveArtifact(runId, "ai", name, await readFile(resolve(directory, name)));
  }
}

export async function loadArtifact(runId: string, fileName: string): Promise<Buffer | null> {
  const [row] = await db.select({ content: analysisRunArtifacts.content }).from(analysisRunArtifacts)
    .where(and(eq(analysisRunArtifacts.run_id, runId), eq(analysisRunArtifacts.file_name, fileName))).limit(1);
  return row ? Buffer.from(row.content) : null;
}

export async function getActiveRunId(): Promise<string | null> {
  const [row] = await db.select({ id: analysisRuns.id }).from(analysisRuns)
    .where(eq(analysisRuns.is_active, true)).limit(1);
  return row?.id ?? activeRunId();
}

export async function getStoredModelTimestamp(): Promise<Date | null> {
  const runId = await getActiveRunId();
  if (!runId) return null;
  const [row] = await db.select({ created_at: analysisRunArtifacts.created_at }).from(analysisRunArtifacts)
    .where(and(eq(analysisRunArtifacts.run_id, runId), eq(analysisRunArtifacts.file_name, "daisuki.pkl"))).limit(1);
  return row?.created_at ?? null;
}

export async function readActiveArtifact(kind: "facts" | "report" | "regional" | "evaluation"): Promise<string> {
  const fileName = { facts: "weekly_operational_facts.json", report: "weekly_analytics_summary.json",
    regional: "regional_stockout_insights.json", evaluation: "model_evaluation.json" }[kind];
  const runId = await getActiveRunId();
  if (runId) {
    const stored = await loadArtifact(runId, fileName);
    if (stored) return stored.toString("utf8");
  }
  return readFile(activeArtifact(kind), "utf8");
}

export async function hydrateDataScienceArtifacts(runId: string): Promise<void> {
  const directory = dataScienceRunDir(runId);
  await mkdir(directory, { recursive: true });
  for (const name of dataScienceNames) {
    const content = await loadArtifact(runId, name);
    if (!content) throw new Error(`Artefak ${name} tidak tersedia di database`);
    await writeFile(resolve(directory, name), content);
  }
}

export async function stageRawReferences(): Promise<{ directory: string; cleanup: () => Promise<void> }> {
  const directory = await mkdtemp(join(tmpdir(), "daisuki-raw-"));
  try {
    const rows = await db.select({ category: rawReferences.category, file_name: rawReferences.file_name,
      content: rawReferences.content }).from(rawReferences);
    for (const row of rows) {
      const { category, fileName } = validateRawReference({ name: row.file_name, size: row.content.length });
      if (category !== row.category) throw new Error("Kategori referensi tidak cocok");
      const folder = category === "pdf" ? "pdf" : category === "csv" ? "csv" : "docs";
      await mkdir(resolve(directory, folder), { recursive: true });
      await writeFile(resolve(directory, folder, fileName), row.content);
    }
    return { directory, cleanup: () => rm(directory, { recursive: true, force: true }) };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
