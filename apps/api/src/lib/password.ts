import { sql } from "../db/client";

function hasBunPassword(): boolean {
  return typeof Bun !== "undefined" && typeof Bun.password?.verify === "function";
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hasBunPassword()) return Bun.password.verify(password, hash);
  if (!/^\$2[aby]\$/.test(hash)) return false;
  const [result] = await sql<{ valid: boolean }[]>`
    select crypt(${password}, ${hash}) = ${hash} as valid
  `;
  return result?.valid === true;
}

export async function hashPassword(password: string): Promise<string> {
  if (new TextEncoder().encode(password).length > 72) {
    throw new Error("Kata sandi maksimal 72 byte pada runtime ini");
  }
  const [result] = await sql<{ hash: string }[]>`
    select crypt(${password}, gen_salt('bf', 12)) as hash
  `;
  if (!result?.hash) throw new Error("Gagal membuat hash kata sandi");
  return result.hash;
}
