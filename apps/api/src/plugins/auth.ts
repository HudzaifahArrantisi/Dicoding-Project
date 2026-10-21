import { Elysia } from "elysia";
import * as jose from "jose";
import { env } from "../env";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { partners, users } from "../db/schema";

const jwtSecret =
  env.JWT_SECRET ||
  (env.NODE_ENV === "production"
    ? ""
    : "daisuki-local-development-secret-change-before-deploying");


if (jwtSecret.length < 32) {
  throw new Error("JWT_SECRET wajib berisi minimal 32 karakter");
}

const JWT_SECRET = new TextEncoder().encode(jwtSecret);
const JWT_ISSUER = "daisuki-api";
const JWT_AUDIENCE = "daisuki-web";

export interface AuthUser {
  userId: string;
  role: "admin" | "mitra";
  partnerId: string | null;
  email: string;
  fullName: string;
}

export async function signToken(payload: AuthUser): Promise<string> {
  return await new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    });
    if (
      typeof payload.userId !== "string" ||
      (payload.role !== "admin" && payload.role !== "mitra") ||
      typeof payload.email !== "string" ||
      typeof payload.fullName !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      role: payload.role,
      partnerId:
        typeof payload.partnerId === "string" ? payload.partnerId : null,
      email: payload.email,
      fullName: payload.fullName,
    };
  } catch {
    return null;
  }
}

export async function getAuthUser(
  headers: Record<string, string | undefined>,
): Promise<AuthUser | null> {
  const authHeader = headers["authorization"] || headers["Authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  const payload = await verifyToken(token);
  if (!payload) return null;
  const [account] = await db
    .select({
      id: users.id,
      role: users.role,
      partnerId: users.partner_id,
      email: users.email,
      fullName: users.full_name,
      partnerActive: partners.is_active,
    })
    .from(users)
    .leftJoin(partners, eq(users.partner_id, partners.id))
    .where(eq(users.id, payload.userId))
    .limit(1);
  if (!account || (account.role === "mitra" && (!account.partnerId || !account.partnerActive))) return null;
  return {
    userId: account.id,
    role: account.role,
    partnerId: account.partnerId,
    email: account.email,
    fullName: account.fullName,
  };
}

export const authPlugin = new Elysia({ name: "auth" }).derive(
  { as: "scoped" },
  async ({ headers }) => {
    const user = await getAuthUser(headers);
    return { user };
  },
);
