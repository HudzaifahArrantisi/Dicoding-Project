import { resolve } from "node:path";
import { sql } from "./client";

const migrationPath = resolve(import.meta.dir, "../../../../neon/migrations/20261104_assistant_chat_events.sql");

try {
  const [before] = await sql`select to_regclass('public.assistant_chat_events') is not null as present`;
  if (process.argv.includes("--apply")) {
    const migration = await Bun.file(migrationPath).text();
    await sql.unsafe(migration);
    const [after] = await sql`select to_regclass('public.assistant_chat_events') is not null as present`;
    if (!after?.present) throw new Error("Tabel percakapan belum tersedia setelah migrasi");
    console.log("Migrasi assistant_chat_events selesai");
  } else {
    console.log(before?.present ? "Tabel assistant_chat_events tersedia" : "Tabel assistant_chat_events belum tersedia; jalankan dengan --apply setelah meninjau migrasi");
  }
} finally {
  await sql.end();
}
