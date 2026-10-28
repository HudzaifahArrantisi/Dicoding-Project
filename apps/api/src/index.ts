import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { cron } from "@elysiajs/cron";
import { isAbsolute, relative, resolve } from "node:path";
import { eq, sql } from "drizzle-orm";
import { env } from "./env";
import { db } from "./db/client";
import { orders, partners } from "./db/schema";
import { getAuthUser, validCsrf } from "./plugins/auth";
import { UPLOADS_DIR } from "./lib/storage";
import { authModule, meModule } from "./modules/auth";
import { stocksModule, productsModule } from "./modules/stocks";
import { ordersModule } from "./modules/orders";
import { notificationsModule } from "./modules/notifications";
import { adminNotificationModule } from "./modules/notifications/admin";
import { adminModule } from "./modules/admin";
import { regionModule } from "./modules/regions";
import { realtimeModule } from "./realtime";
import { runWeeklyPipeline } from "./lib/weekly-pipeline";

function isAllowedOrigin(origin?: string | null): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;

    // 1. Matches configured WEB_ORIGIN
    if (origin === env.WEB_ORIGIN) return true;

    // 2. Localhost & Loopback
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0"
    ) {
      return true;
    }

    // 3. Local Area Network (Private IPv4)
    if (
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    ) {
      return true;
    }

    // 4. Common Public Tunnel Providers (Cloudflare, ngrok, localtunnel, zrok, pinggy)
    if (
      hostname.endsWith(".trycloudflare.com") ||
      hostname.endsWith(".cloudflarestream.com") ||
      hostname.endsWith(".cfargotunnel.com") ||
      hostname.endsWith(".ngrok.app") ||
      hostname.endsWith(".ngrok-free.app") ||
      hostname.endsWith(".ngrok.io") ||
      hostname.endsWith(".loca.lt") ||
      hostname.endsWith(".zrok.io") ||
      hostname.endsWith(".pinggy.link")
    ) {
      return true;
    }

    // 5. Custom allowed origins from env if provided
    const custom = (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (custom.includes(origin) || custom.includes(hostname)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export const app = new Elysia()
  .onRequest(({ request, set }) => {
    (request as unknown as { _startTime?: number })._startTime = performance.now();
    set.headers["X-Content-Type-Options"] = "nosniff";
    set.headers["Referrer-Policy"] = "no-referrer";
    if (!request.url.includes("/events")) {
      set.headers["Cache-Control"] = "no-store";
    }
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
  .onError(({ request, error, code, set }) => {
    const url = new URL(request.url);
    console.error(`[ERROR] ${request.method} ${url.pathname} [${code}]`, error instanceof Error ? `${error.name}: ${error.message}` : error);
    if (code === "VALIDATION" || code === "PARSE") {
      set.status = code === "VALIDATION" ? 422 : 400;
      return { error: "Data permintaan tidak valid" };
    }
    if (code === "UNKNOWN" || code === "INTERNAL_SERVER_ERROR") {
      set.status = 500;
      return { error: "Terjadi gangguan server" };
    }
  })
  .use(
    cors({
      origin: (request: Request) => {
        const origin = request.headers.get("origin");
        if (!origin) return true;
        return isAllowedOrigin(origin);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    }),
  )
  .onBeforeHandle(async ({ request, headers, set }) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;
    const origin = headers.origin;
    if (origin && !isAllowedOrigin(origin)) {
      set.status = 403;
      return { error: "Origin tidak diizinkan" };
    }
    const requestPath = new URL(request.url).pathname;
    if (requestPath === "/auth/login" || requestPath === "/api/auth/login") return;
    const user = await getAuthUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (!validCsrf(headers, user.csrfToken)) {
      set.status = 403;
      return { error: "Sesi tidak valid" };
    }
  })
  .get("/health", () => ({ ok: true }))
  .get("/health/db", async ({ headers, set }) => {
    const user = await getAuthUser(headers);
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
    if (user.role !== "admin") {
      set.status = 403;
      return { error: "Forbidden" };
    }
    await sql`select 1`;
    return { status: "ok" };
  })
  .get("/uploads/*", async ({ headers, params, set }) => {
    const user = await getAuthUser(headers);
    if (!user) {
      set.status = 401;
      return "Unauthorized";
    }
    const relativePath = params["*"];
    if (!/^(receipts|profiles)\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(relativePath)) {
      set.status = 404;
      return "File tidak ditemukan";
    }
    const safePath = resolve(UPLOADS_DIR, relativePath);
    const withinUploads = relative(UPLOADS_DIR, safePath);
    if (withinUploads.startsWith("..") || isAbsolute(withinUploads)) {
      set.status = 403;
      return "Forbidden";
    }
    const storedPath = `/uploads/${relativePath}`;
    const [owner] = relativePath.startsWith("receipts/")
      ? await db.select({ partnerId: orders.partner_id }).from(orders).where(eq(orders.receipt_photo_data_url, storedPath)).limit(1)
      : await db.select({ partnerId: partners.id }).from(partners).where(eq(partners.profile_photo, storedPath)).limit(1);
    if (!owner || (user.role !== "admin" && owner.partnerId !== user.partnerId)) {
      set.status = 404;
      return "File tidak ditemukan";
    }
    const file = Bun.file(safePath);
    const exists = await file.exists();
    if (!exists) {
      set.status = 404;
      return "File tidak ditemukan";
    }
    set.headers["Cache-Control"] = "private, no-store";
    set.headers["X-Content-Type-Options"] = "nosniff";
    return file;
  })
  .use(authModule)
  .use(meModule)
  .use(realtimeModule)
  .use(stocksModule)
  .use(productsModule)
  .use(ordersModule)
  .use(notificationsModule)
  .use(adminNotificationModule)
  .use(adminModule)
  .use(regionModule)
  .use(
    cron({
      name: "weekly-demand-and-restock",
      pattern: "0 5 * * 1",
      timezone: "Asia/Jakarta",
      run() {
        return runWeeklyPipeline().catch((error) => console.error("[WEEKLY AI]", error));
      },
    }),
  )
  .listen({
    port: env.PORT,
    hostname: "0.0.0.0",
  });

console.log(
  `[${new Date().toLocaleTimeString()}] 🚀 Daisuki API berjalan di port ${app.server?.port} (host: 0.0.0.0)`,
);

export type App = typeof app;
