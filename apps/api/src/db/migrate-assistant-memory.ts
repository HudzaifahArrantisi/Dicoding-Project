import { resolve } from "node:path";
import { sql } from "./client";

const migrationPath = resolve(import.meta.dir, "../../../../neon/migrations/20261109_assistant_conversation_memory.sql");

try {
  if (process.argv.includes("--apply")) {
    await sql.unsafe(await Bun.file(migrationPath).text());
  }
  const [result] = await sql`select to_regclass('public.assistant_conversation_memory') is not null as present`;
  console.log(result?.present ? "Tabel assistant_conversation_memory tersedia" : "Tabel assistant_conversation_memory belum tersedia");
} finally {
  await sql.end();
}
