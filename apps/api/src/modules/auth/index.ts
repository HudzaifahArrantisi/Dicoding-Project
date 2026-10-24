import { Elysia, t } from "elysia";
import { eq, or, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { users, partners } from "../../db/schema";
import { createSession, getAuthUser, revokeSession, sessionCookie } from "../../plugins/auth";
import { resolveRegion, RegionError, type RegionCodes } from "../regions";
import { saveBase64Image } from "../../lib/storage";

const loginAttempts = new Map<string, { count: number; until: number }>();
const loginWindowMs = 15 * 60_000;

function failedLogin(keys: string[]): void {
  const now = Date.now();
  if (loginAttempts.size > 10_000) {
    for (const [key, value] of loginAttempts) {
      if (value.until <= now) loginAttempts.delete(key);
    }
    while (loginAttempts.size > 10_000) {
      const oldest = loginAttempts.keys().next().value;
      if (!oldest) break;
      loginAttempts.delete(oldest);
    }
  }
  for (const key of keys) {
    const previous = loginAttempts.get(key);
    loginAttempts.set(key, {
      count: (previous && previous.until > now ? previous.count : 0) + 1,
      until: now + loginWindowMs,
    });
  }
}

function tooManyLogins(key: string, limit: number): boolean {
  const attempt = loginAttempts.get(key);
  return !!attempt && attempt.until > Date.now() && attempt.count >= limit;
}

function validProfilePhoto(value: string): boolean {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const bytes = Buffer.from(match[1], "base64");
  return bytes.length > 0 && bytes.length <= 350_000 &&
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff &&
    bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}

export const authModule = new Elysia({ prefix: "/auth" }).post(
  "/login",
  async ({ body, request, server, set }) => {
    const { email, password } = body;
    const identifier = email.toLowerCase().trim();
    const ipKey = `ip:${server?.requestIP(request)?.address ?? "unknown"}`;
    const attemptKey = `${ipKey}:${identifier}`;
    if (tooManyLogins(attemptKey, 5) || tooManyLogins(ipKey, 30)) {
      set.status = 429;
      return { error: "Terlalu banyak percobaan. Coba lagi nanti." };
    }

    const [user] = await db
      .select()
      .from(users)
      .where(
        or(
          sql`lower(${users.email}) = ${identifier}`,
          sql`lower(${users.username}) = ${identifier}`,
        ),
      )
      .limit(1);

    if (!user) {
      failedLogin([attemptKey, ipKey]);
      set.status = 401;
      return { error: "Email atau password salah" };
    }

    let isValid = false;
    try {
      isValid = await Bun.password.verify(password, user.password_hash);
    } catch {
      isValid = false;
    }

    if (!isValid || (process.env.NODE_ENV === "production" && user.email.endsWith("@daisuki.test"))) {
      failedLogin([attemptKey, ipKey]);
      set.status = 401;
      return { error: "Email atau password salah" };
    }
    loginAttempts.delete(attemptKey);

    if (user.partner_id) {
      const [partner] = await db
        .select({ is_active: partners.is_active })
        .from(partners)
        .where(eq(partners.id, user.partner_id))
        .limit(1);

      if (!partner) {
        set.status = 401;
        return { error: "Email atau password salah" };
      }

      if (!partner.is_active) {
        set.status = 401;
        return { error: "Email atau password salah" };
      }
    }

    const token = await createSession(user.id, user.role);
    set.headers["Set-Cookie"] = sessionCookie(token);
    return { status: "ok" };
  },
  {
    body: t.Object({
      email: t.String({ minLength: 3, maxLength: 254 }),
      password: t.String({ minLength: 8, maxLength: 128 }),
    }),
  },
).post("/logout", async ({ headers, set }) => {
  const user = await getAuthUser(headers);
  if (user) await revokeSession(user.sessionId);
  set.headers["Set-Cookie"] = sessionCookie(null);
  return { status: "ok" };
});

export const meModule = new Elysia()
  .get("/me", async ({ headers, set }) => {
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
    let partnerPicName: string | null = null;
    let partnerPhone: string | null = null;
    let partnerAddress: string | null = null;
    let partnerPhoto: string | null = null;
    let partnerRegion: RegionCodes | null = null;
    if (dbUser.partner_id) {
      const [partner] = await db
        .select({
          name: partners.name,
          pic_name: partners.pic_name,
          phone: partners.pic_phone,
          address: partners.address,
          photo: partners.profile_photo,
          province_code: partners.province_code,
          regency_code: partners.regency_code,
          district_code: partners.district_code,
          village_code: partners.village_code,
        })
        .from(partners)
        .where(eq(partners.id, dbUser.partner_id))
        .limit(1);
      partnerName = partner?.name ?? null;
      partnerPicName = partner?.pic_name ?? null;
      partnerPhone = partner?.phone ?? null;
      partnerAddress = partner?.address ?? null;
      partnerPhoto = partner?.photo ?? null;
      partnerRegion = partner ? {
        province_code: partner.province_code ?? "",
        regency_code: partner.regency_code ?? "",
        district_code: partner.district_code ?? "",
        village_code: partner.village_code ?? "",
      } : null;
    }

    return {
      csrf_token: user.csrfToken,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        partner_id: dbUser.partner_id,
        partner_name: partnerName,
        partner_pic_name: partnerPicName,
        partner_phone: partnerPhone,
        partner_address: partnerAddress,
        partner_photo: partnerPhoto,
        partner_region: partnerRegion,
        full_name: dbUser.full_name,
      },
    };
  })
  .patch(
    "/me/profile",
    async ({ headers, body, set }) => {
      const authUser = await getAuthUser(headers);
      if (!authUser) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const [dbUser] = await db
        .select({ role: users.role, partner_id: users.partner_id })
        .from(users)
        .where(eq(users.id, authUser.userId))
        .limit(1);

      if (!dbUser || dbUser.role !== "mitra" || !dbUser.partner_id) {
        set.status = 403;
        return { error: "Hanya mitra yang dapat mengubah profil cabang" };
      }

      const name = body.name.trim();
      const picName = body.pic_name.trim();
      const phone = body.phone.trim();
      const address = body.address.trim();
      if (name.length < 2 || picName.length < 2 || address.length < 5) {
        set.status = 422;
        return { error: "Lengkapi nama mitra, nama PIC, dan alamat" };
      }
      const phoneDigits = phone.replace(/\D/g, "");
      if (
        !/^\+?[0-9][0-9 ()-]{7,23}$/.test(phone) ||
        phoneDigits.length < 8 ||
        phoneDigits.length > 15
      ) {
        set.status = 422;
        return { error: "Nomor telepon tidak valid" };
      }

      let region;
      try {
        region = await resolveRegion({
          province_code: body.province_code,
          regency_code: body.regency_code,
          district_code: body.district_code,
          village_code: body.village_code,
        });
      } catch (error) {
        set.status = error instanceof RegionError ? error.status : 503;
        return { error: error instanceof Error ? error.message : "Wilayah belum dapat diperiksa" };
      }

      let photoPath: string | null = null;
      if (body.photo_data_url !== null) {
        if (body.photo_data_url.startsWith("/uploads/profiles/")) {
          const [current] = await db.select({ profile_photo: partners.profile_photo })
            .from(partners).where(eq(partners.id, dbUser.partner_id)).limit(1);
          if (current?.profile_photo !== body.photo_data_url) {
            set.status = 403;
            return { error: "Foto profil tidak memiliki akses" };
          }
          photoPath = body.photo_data_url;
        } else if (validProfilePhoto(body.photo_data_url)) {
          const saved = await saveBase64Image(
            body.photo_data_url,
            "profiles",
            `profile-${dbUser.partner_id}`,
          );
          photoPath = saved.path;
        } else {
          set.status = 422;
          return { error: "Format foto tidak valid" };
        }
      }

      const [updated] = await db
        .update(partners)
        .set({
          name,
          pic_name: picName,
          pic_phone: phone,
          address,
          ...region,
          profile_photo: photoPath,
        })
        .where(eq(partners.id, dbUser.partner_id))
        .returning({ id: partners.id });

      if (!updated) {
        set.status = 404;
        return { error: "Profil mitra tidak ditemukan" };
      }
      return { status: "ok" };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2, maxLength: 120 }),
        pic_name: t.String({ minLength: 2, maxLength: 120 }),
        phone: t.String({ minLength: 8, maxLength: 24 }),
        address: t.String({ minLength: 5, maxLength: 500 }),
        province_code: t.String({ maxLength: 20 }),
        regency_code: t.String({ maxLength: 20 }),
        district_code: t.String({ maxLength: 20 }),
        village_code: t.String({ maxLength: 20 }),
        photo_data_url: t.Union([t.String({ maxLength: 500_000 }), t.Null()]),
      }),
    },
  );
