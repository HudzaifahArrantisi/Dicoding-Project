import { and, eq, isNull } from "drizzle-orm";
import { db, sql } from "./client";
import { analysisRunArtifacts, auditLogs, rawReferences, users } from "./schema";
import { deleteAdminRawReference, loadArtifact, saveRawReference } from "../lib/analysis-storage";

const name = `check-${crypto.randomUUID()}.json`;
let savedId: string | null = null;
try {
  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  if (!admin) throw new Error("Admin tidak tersedia untuk uji penyimpanan");
  const saved = await saveRawReference(new File(['{"status":"ok"}'], name), admin.id);
  savedId = saved.id;
  const [stored] = await db.select({ content: rawReferences.content, sha256: rawReferences.sha256 })
    .from(rawReferences).where(eq(rawReferences.id, saved.id)).limit(1);
  if (!stored || Buffer.from(stored.content).toString("utf8") !== '{"status":"ok"}' ||
    stored.sha256 !== saved.sha256) throw new Error("Isi bytea tidak sesuai setelah dibaca ulang");
  const [artifact] = await db.select({ run_id: analysisRunArtifacts.run_id, file_name: analysisRunArtifacts.file_name })
    .from(analysisRunArtifacts).where(eq(analysisRunArtifacts.file_name, "category_products.json")).limit(1);
  if (artifact) {
    const content = await loadArtifact(artifact.run_id, artifact.file_name);
    if (!content || !Array.isArray((JSON.parse(content.toString("utf8")) as { items?: unknown[] }).items)) {
      throw new Error("JSON kategori dari database tidak valid");
    }
  }
  const [imported] = await db.select({ id: rawReferences.id }).from(rawReferences)
    .where(isNull(rawReferences.uploaded_by)).limit(1);
  if (imported && await deleteAdminRawReference(imported.id, admin.id) !== null) {
    throw new Error("Referensi hasil impor tidak boleh dihapus melalui aksi Admin");
  }
  if (!await deleteAdminRawReference(saved.id, admin.id)) throw new Error("Unggahan Admin gagal dihapus");
  const [remaining] = await db.select({ id: rawReferences.id }).from(rawReferences)
    .where(eq(rawReferences.id, saved.id)).limit(1);
  if (remaining) throw new Error("File masih tersimpan setelah dihapus");
  console.log("Uji simpan, baca, dan hapus raw_references lulus");
} finally {
  await db.delete(rawReferences).where(eq(rawReferences.file_name, name));
  if (savedId) await db.delete(auditLogs).where(and(eq(auditLogs.target_id, savedId),
    eq(auditLogs.action, "raw_reference_deleted")));
  await sql.end();
}
