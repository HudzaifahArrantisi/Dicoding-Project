import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Elysia } from "elysia";
import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "../db/client";
import { authSessions, partners, users } from "../db/schema";
import { env } from "../env";
import { retryTransientRead } from "../lib/db-retry";

const production = env.NODE_ENV === "production";
const cookieName = production ? "__Host-daisuki_session" : "daisuki_session";
const idleMs = { admin: 30 * 60_000, mitra: 2 * 60 * 60_000 } as const;
const absoluteMs = { admin: 8 * 60 * 60_000, mitra: 24 * 60 * 60_000 } as const;
const recentSessionTouches = new Map<string, number>();

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cookieToken(headers: Record<string, string | undefined>): string | null {
  const raw = headers.cookie ?? headers.Cookie ?? "";
  const value = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export function sessionCookie(token: string | null): string {
  const attributes = ["Path=/", "HttpOnly", "SameSite=Strict", ...(production ? ["Secure"] : [])];
  if (!token) return `${cookieName}=; ${attributes.join("; ")}; Max-Age=0`;
  return `${cookieName}=${token}; ${attributes.join("; ")}; Max-Age=86400`;
}

export interface AuthUser {
  userId: string;
  role: "admin" | "mitra";
  partnerId: string | null;
  email: string;
  fullName: string;
  sessionId: string;
  csrfToken: string;
}

export async function createSession(userId: string, role: AuthUser["role"]): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(authSessions).values({
    user_id: userId,
    token_hash: hashToken(token),
    csrf_token: randomBytes(32).toString("base64url"),
    expires_at: new Date(Date.now() + absoluteMs[role]),
  });
  return token;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.update(authSessions).set({ revoked_at: new Date() }).where(eq(authSessions.id, sessionId));
}

export async function getAuthUser(headers: Record<string, string | undefined>): Promise<AuthUser | null> {
  const token = cookieToken(headers);
  if (!token) return null;
  const [account] = await retryTransientRead(async () => db
    .select({
      id: users.id,
      role: users.role,
      partnerId: users.partner_id,
      email: users.email,
      fullName: users.full_name,
      partnerActive: partners.is_active,
      sessionId: authSessions.id,
      csrfToken: authSessions.csrf_token,
      lastSeenAt: authSessions.last_seen_at,
      expiresAt: authSessions.expires_at,
    })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.user_id, users.id))
    .leftJoin(partners, eq(users.partner_id, partners.id))
    .where(and(eq(authSessions.token_hash, hashToken(token)), isNull(authSessions.revoked_at)))
    .limit(1));
  if (!account) return null;
  const now = Date.now();
  if (account.expiresAt.getTime() <= now || now - account.lastSeenAt.getTime() > idleMs[account.role]) return null;
  if (account.role === "mitra" && (!account.partnerId || !account.partnerActive)) return null;
  if (now - account.lastSeenAt.getTime() > 60_000) {
    const lastAttempt = recentSessionTouches.get(account.sessionId) ?? 0;
    if (now - lastAttempt > 60_000) {
      if (recentSessionTouches.size >= 1_000) {
        const oldest = recentSessionTouches.keys().next().value;
        if (oldest) recentSessionTouches.delete(oldest);
      }
      recentSessionTouches.set(account.sessionId, now);
      void db.update(authSessions)
        .set({ last_seen_at: new Date(now) })
        .where(and(eq(authSessions.id, account.sessionId), lt(authSessions.last_seen_at, new Date(now - 60_000))))
        .catch((error: unknown) => {
          console.error("[AUTH] Gagal memperbarui waktu sesi", error instanceof Error ? error.cause ?? error.name : error);
        });
    }
  }
  return {
    userId: account.id,
    role: account.role,
    partnerId: account.partnerId,
    email: account.email,
    fullName: account.fullName,
    sessionId: account.sessionId,
    csrfToken: account.csrfToken,
  };
}

export function validCsrf(headers: Record<string, string | undefined>, expected: string): boolean {
  const received = headers["x-csrf-token"] ?? headers["X-CSRF-Token"];
  if (!received || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export const authPlugin = new Elysia({ name: "auth" }).derive(
  { as: "scoped" },
  async ({ headers }) => ({ user: await getAuthUser(headers) }),
);
