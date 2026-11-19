import { resolve } from "node:path";
import { sql } from "./client";

const migrationPath = resolve(import.meta.dir, "../../../../neon/migrations/20261119_analysis_storage.sql");

try {
  if (process.argv.includes("--apply")) {
    await sql.unsafe(await Bun.file(migrationPath).text());
  }
  const [result] = await sql`select
    to_regclass('public.raw_references') is not null as raw_present,
    to_regclass('public.analysis_run_artifacts') is not null as artifacts_present`;
  console.log(result?.raw_present && result?.artifacts_present
    ? "Tabel raw_references dan analysis_run_artifacts tersedia"
    : "Tabel penyimpanan analisis belum lengkap");
} finally {
  await sql.end();
}
