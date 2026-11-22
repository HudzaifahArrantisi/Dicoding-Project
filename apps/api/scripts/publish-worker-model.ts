import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sql } from "../src/db/client";

const source = process.argv[2];
if (!source) throw new Error("Berikan path JSON hasil export_worker_classifier.py");
const migration = await readFile(resolve(import.meta.dir, "../../../neon/migrations/20261121_worker_model.sql"), "utf8");
const bundle = JSON.parse(await readFile(resolve(source), "utf8"));
if (bundle.format_version !== 1 || !bundle.intent) throw new Error("Bundle model tidak valid");
try {
  await sql.unsafe(migration);
  await sql`
    insert into worker_model_artifacts (name, payload)
    values ('daisuki', ${JSON.stringify(bundle)}::jsonb)
    on conflict (name) do update set payload = excluded.payload, updated_at = now()
  `;
  console.log("Model Worker tersimpan di Neon");
} finally {
  await sql.end();
}
