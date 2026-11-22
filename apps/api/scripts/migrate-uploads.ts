import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "../src/db/client";

const root = join(import.meta.dir, "../uploads");
let migrated = 0;
let skipped = 0;

for (const folder of ["receipts", "profiles"] as const) {
  const directory = join(root, folder);
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isFile() || !/^[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(entry.name)) continue;
    const content = await readFile(join(directory, entry.name));
    if (content.length < 1 || content.length > 700_000) throw new Error(`Ukuran tidak valid: ${folder}/${entry.name}`);
    const path = `/uploads/${folder}/${entry.name}`;
    const mimeType = entry.name.endsWith(".png") ? "image/png" : entry.name.endsWith(".webp") ? "image/webp" : "image/jpeg";
    const rows = await sql`
      insert into uploaded_files (path, mime_type, size_bytes, content)
      values (${path}, ${mimeType}, ${content.length}, ${content})
      on conflict (path) do nothing
      returning path
    `;
    if (rows.length) migrated++;
    else skipped++;
  }
}

console.log({ migrated, alreadyPresent: skipped });
await sql.end();
