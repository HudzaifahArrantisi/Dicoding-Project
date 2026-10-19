import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { users, partners } from "../../db/schema";
import { signToken, getAuthUser } from "../../plugins/auth";

export const authModule = new Elysia({ prefix: "/auth" }).post(
  "/login",
  async ({ body, set }) => {
    const { email, password } = body;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      set.status = 401;
      return { error: "Email atau password salah" };
    }

    const isValid = await Bun.password.verify(password, user.password_hash);
    if (!isValid) {
      set.status = 401;
      return { error: "Email atau password salah" };
    }

    let partnerName: string | null = null;
    if (user.partner_id) {
      const [partner] = await db
        .select({ name: partners.name })
        .from(partners)
        .where(eq(partners.id, user.partner_id))
        .limit(1);
      partnerName = partner?.name ?? null;
    }

    const token = await signToken({
      userId: user.id,
      role: user.role,
      partnerId: user.partner_id,
      email: user.email,
      fullName: user.full_name,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        partner_id: user.partner_id,
        partner_name: partnerName,
        full_name: user.full_name,
      },
    };
  },
  {
    body: t.Object({
      email: t.String({ format: "email", maxLength: 254 }),
      password: t.String({ minLength: 8, maxLength: 128 }),
    }),
  },
);

export const meModule = new Elysia().get("/me", async ({ headers, set }) => {
  const user = await getAuthUser(headers);
  if (!user) {
    set.status = 401;
    return { error: "Unauthorized" };
  }

  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, user.userId))
    .limit(1);

  if (!dbUser) {
    set.status = 404;
    return { error: "User tidak ditemukan" };
  }

  let partnerName: string | null = null;
  if (dbUser.partner_id) {
    const [partner] = await db
      .select({ name: partners.name })
      .from(partners)
      .where(eq(partners.id, dbUser.partner_id))
      .limit(1);
    partnerName = partner?.name ?? null;
  }

  return {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      partner_id: dbUser.partner_id,
      partner_name: partnerName,
      full_name: dbUser.full_name,
    },
  };
});
