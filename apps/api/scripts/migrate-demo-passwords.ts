import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashPassword } from "../src/lib/password";
import { sql } from "../src/db/client";

const credentialFile = resolve(import.meta.dir, "../.demo-mitra-credentials.txt");
const match = (await readFile(credentialFile, "utf8")).match(/^Kata sandi bersama: (.+)$/m);
if (!match) throw new Error("Kata sandi demo lokal tidak tersedia");
const password = match[1];
const pattern = "mitra-demo-%@daisuki.test";

try {
  const hashes = await sql<{ password_hash: string; count: number }[]>`
    select password_hash, count(*)::int as count from users
    where email like ${pattern} and password_hash like '$argon2%'
    group by password_hash
  `;
  let migrated = 0;
  let unmatched = 0;
  for (const { password_hash: oldHash, count } of hashes) {
    if (!await Bun.password.verify(password, oldHash)) {
      unmatched += count;
      continue;
    }
    const replacement = await hashPassword(password);
    const updated = await sql`
      update users set password_hash = ${replacement}
      where email like ${pattern} and password_hash = ${oldHash}
      returning id
    `;
    migrated += updated.length;
  }
  const [status] = await sql<{ total: number; argon2: number; bcrypt: number }[]>`
    select count(*)::int as total,
      count(*) filter (where password_hash like '$argon2%')::int as argon2,
      count(*) filter (where password_hash like '$2%')::int as bcrypt
    from users
  `;
  console.log({ migrated, unmatched, ...status });
} finally {
  await sql.end();
}
