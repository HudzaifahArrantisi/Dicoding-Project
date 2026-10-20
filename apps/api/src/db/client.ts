import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";

// Neon DB pooler (transaction mode) tidak mendukung prepared statements (prepare: false)
export const sql = postgres(env.DATABASE_URL, { prepare: false, max: 10 });
export const db = drizzle(sql);
