import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sql } from "../src/db/client";

const migration = await readFile(
  resolve(import.meta.dir, "../../../neon/migrations/20261121_worker_uploads.sql"),
  "utf8",
);
await sql.unsafe(migration);
console.log("uploaded_files siap");
await sql.end();
