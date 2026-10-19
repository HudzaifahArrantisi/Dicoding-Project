import { Elysia } from "elysia";
import * as jose from "jose";
import { env } from "../env";

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
  return await verifyToken(token);
}

export const authPlugin = new Elysia({ name: "auth" }).derive(
  { as: "scoped" },
  async ({ headers }) => {
    const user = await getAuthUser(headers);
    return { user };
  },
);
