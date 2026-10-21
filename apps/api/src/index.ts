import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { env } from "./env";
import { sql } from "./db/client";
import { authModule, meModule } from "./modules/auth";
import { stocksModule, productsModule } from "./modules/stocks";
import { ordersModule } from "./modules/orders";
import { notificationsModule } from "./modules/notifications";
import { adminModule } from "./modules/admin";
import { regionModule } from "./modules/regions";

export const app = new Elysia()
  .onRequest(({ request }) => {
    (request as unknown as { _startTime?: number })._startTime = performance.now();
  })
  .onAfterResponse(({ request, set }) => {
    const start = (request as unknown as { _startTime?: number })._startTime;
    const duration = start ? (performance.now() - start).toFixed(1) : "0.0";
    const url = new URL(request.url);
    const status = Number(set.status) || 200;
    const method = request.method;

    const statusColor =
      status >= 500
        ? `\x1b[31m${status}\x1b[0m`
        : status >= 400
          ? `\x1b[33m${status}\x1b[0m`
          : `\x1b[32m${status}\x1b[0m`;

    console.log(
      `[HTTP] ${method.padEnd(6)} ${url.pathname} ${statusColor} (${duration}ms)`,
    );
  })
  .onError(({ request, error, code }) => {
    const url = new URL(request.url);
    const message =
      error instanceof Error
        ? error.message
        : "message" in error && typeof error.message === "string"
          ? error.message
          : String(error);
    console.error(
      `\x1b[31m[ERROR]\x1b[0m ${request.method} ${url.pathname} [${code}]:`,
      message,
    );
  })
  .use(
    cors({
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  )
  .get("/health", () => ({ ok: true }))
  .get("/health/db", async () => {
    const [row] = await sql`select now() as now`;
    return { ok: true, now: row.now };
  })
  .use(authModule)
  .use(meModule)
  .use(stocksModule)
  .use(productsModule)
  .use(ordersModule)
  .use(notificationsModule)
  .use(adminModule)
  .use(regionModule)
  .listen({
    port: env.PORT,
    hostname: "0.0.0.0",
  });

console.log(
  `[${new Date().toLocaleTimeString()}] 🚀 Daisuki API berjalan di port ${app.server?.port} (host: 0.0.0.0)`,
);

export type App = typeof app;
