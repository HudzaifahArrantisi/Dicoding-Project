import { Elysia, t } from "elysia";
import { readFile } from "node:fs/promises";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import { analysisRuns, auditLogs, users } from "../../db/schema";
import { getAuthUser } from "../../plugins/auth";
import { activeRunId, dataScienceRunDir } from "../../lib/analysis-artifacts";
import { approveAnalysisRun, createAnalysisDraft, listAnalysisRuns, processAnalysisRun, rollbackAnalysisRun } from "../../lib/analysis-runs";

function validPeriod(start: string, end: string): boolean {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  const first = new Date(start + "T00:00:00Z");
  const last = new Date(end + "T00:00:00Z");
  if (!pattern.test(start) || !pattern.test(end) || !Number.isFinite(first.getTime()) ||
    !Number.isFinite(last.getTime()) || first.toISOString().slice(0, 10) !== start ||
    last.toISOString().slice(0, 10) !== end) return false;
  const days = (last.getTime() - first.getTime()) / 86_400_000;
  return days >= 0 && days <= 30 && last.getTime() <= Date.now();
}

export const analysisModule = new Elysia({ prefix: "/analysis" })
  .get("/runs", async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (user.role === "mitra") { set.status = 403; return { error: "Forbidden" }; }
    return { runs: await listAnalysisRuns(), active_run_id: activeRunId() };
  })
  .get("/runs/:id/artifacts", async ({ headers, params, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (user.role === "mitra") { set.status = 403; return { error: "Forbidden" }; }
    const [run] = await db.select({ status: analysisRuns.status, manifest: analysisRuns.manifest })
      .from(analysisRuns).where(eq(analysisRuns.id, params.id)).limit(1);
    if (!run) { set.status = 404; return { error: "Run tidak ditemukan" }; }
    const directory = dataScienceRunDir(params.id);
    try {
      const [json, csv, markdown, manifest] = await Promise.all([
        readFile(`${directory}/weekly_analytics_summary.json`, "utf8"),
        readFile(`${directory}/cleaned_inventory_summary.csv`, "utf8"),
        readFile(`${directory}/weekly_analytics_report.md`, "utf8"),
        readFile(`${directory}/manifest.json`, "utf8"),
      ]);
      return { status: run.status, manifest: JSON.parse(manifest), json: JSON.parse(json),
        csv_preview: csv.split(/\r?\n/).slice(0, 16).join("\n"), markdown };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") { set.status = 404; return { error: "Artefak laporan belum tersedia" }; }
      throw error;
    }
  }, { params: t.Object({ id: t.String({ format: "uuid" }) }) })
  .post("/runs", async ({ headers, body, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (user.role !== "data_science" && user.role !== "admin") { set.status = 403; return { error: "Hanya Admin atau Data Science dapat membuat laporan" }; }
    if (!validPeriod(body.start_date, body.end_date)) {
      set.status = 422; return { error: "Periode harus tanggal valid, maksimal 31 hari, dan tidak boleh di masa depan" };
    }
    const id = await createAnalysisDraft(body.start_date, body.end_date, user.userId);
    set.status = 201;
    return { id, status: "draft" };
  }, { body: t.Object({ start_date: t.String(), end_date: t.String() }) })
  .post("/runs/:id/approve", async ({ headers, params, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (user.role !== "admin") { set.status = 403; return { error: "Hanya Admin dapat menyetujui laporan" }; }
    const run = await approveAnalysisRun(params.id, user.userId);
    if (!run) { set.status = 409; return { error: "Run tidak berstatus draft" }; }
    return { id: run.id, status: run.status };
  }, { params: t.Object({ id: t.String({ format: "uuid" }) }) })
  .post("/runs/:id/reject", async ({ headers, params, body, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (user.role !== "admin") { set.status = 403; return { error: "Hanya Admin dapat menolak laporan" }; }
    const [run] = await db.update(analysisRuns).set({ status: "rejected", error: body.reason })
      .where(and(eq(analysisRuns.id, params.id), inArray(analysisRuns.status, ["draft", "approved"]))).returning();
    if (!run) { set.status = 409; return { error: "Run tidak dapat ditolak" }; }
    await db.insert(auditLogs).values({ actor_id: user.userId, action: "analysis_rejected",
      target_type: "analysis_run", target_id: params.id });
    return { id: run.id, status: run.status };
  }, { params: t.Object({ id: t.String({ format: "uuid" }) }), body: t.Object({ reason: t.String({ minLength: 3, maxLength: 500 }) }) })
  .post("/runs/:id/process", async ({ headers, params, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (user.role !== "ai_engineer" && user.role !== "admin") { set.status = 403; return { error: "Hanya Admin atau AI Engineer dapat memproses laporan" }; }
    const [run] = await db.select({ status: analysisRuns.status }).from(analysisRuns).where(eq(analysisRuns.id, params.id)).limit(1);
    if (run?.status === "draft" && user.role === "admin") {
      await approveAnalysisRun(params.id, user.userId);
    } else if (run?.status !== "approved") { set.status = 409; return { error: "Run belum disetujui Admin" }; }
    processAnalysisRun(params.id, user.userId);
    set.status = 202;
    return { id: params.id, status: "processing" };
  }, { params: t.Object({ id: t.String({ format: "uuid" }) }) })
  .post("/runs/:id/rollback", async ({ headers, params, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (user.role !== "admin") { set.status = 403; return { error: "Hanya Admin dapat mengembalikan hasil" }; }
    if (!await rollbackAnalysisRun(params.id, user.userId)) {
      set.status = 409; return { error: "Run belum pernah dipublikasikan" };
    }
    return { id: params.id, status: "published", is_active: true };
  }, { params: t.Object({ id: t.String({ format: "uuid" }) }) })
  .post("/team-users", async ({ headers, body, set }) => {
    const user = await getAuthUser(headers);
    if (!user) { set.status = 401; return { error: "Unauthorized" }; }
    if (user.role !== "admin") { set.status = 403; return { error: "Hanya Admin dapat membuat akun tim" }; }
    const hash = await Bun.password.hash(body.password);
    const [created] = await db.insert(users).values({
      email: body.email.toLowerCase().trim(), full_name: body.full_name.trim(),
      password_hash: hash, role: body.role, partner_id: null,
    }).onConflictDoNothing({ target: users.email }).returning({ id: users.id, email: users.email, role: users.role });
    if (!created) { set.status = 409; return { error: "Email sudah digunakan" }; }
    await db.insert(auditLogs).values({ actor_id: user.userId, action: "analysis_team_user_created",
      target_type: "user", target_id: created.id });
    set.status = 201;
    return created;
  }, { body: t.Object({
    email: t.String({ format: "email" }), full_name: t.String({ minLength: 2, maxLength: 120 }),
    password: t.String({ minLength: 12, maxLength: 128 }),
    role: t.Union([t.Literal("data_science"), t.Literal("ai_engineer")]),
  }) });
