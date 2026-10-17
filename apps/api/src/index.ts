import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { env } from "./env";
import { sql } from "./db/client";

const app = new Elysia()
  .use(cors({ origin: env.WEB_ORIGIN, credentials: true }))
  .get("/health", () => ({ ok: true }))
  .get("/health/db", async () => {
    const [row] = await sql`select now() as now`;
    return { ok: true, now: row.now };
  })
  .listen(env.PORT);

console.log(`API jalan di http://localhost:${app.server?.port}`);

export type App = typeof app;