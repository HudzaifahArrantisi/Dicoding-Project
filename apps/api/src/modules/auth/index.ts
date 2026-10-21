import { Elysia, t } from "elysia";
import { eq, or } from "drizzle-orm";
import { db } from "../../db/client";
import { users, partners } from "../../db/schema";
import { signToken, getAuthUser } from "../../plugins/auth";

export const authModule = new Elysia({ prefix: "/auth" }).post(
  "/login",
  async ({ body, set }) => {
    const { email, password } = body;
    const identifier = email.toLowerCase().trim();

    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, identifier), eq(users.username, identifier)))
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

    if (user.partner_id) {
      const [partner] = await db
        .select({ is_active: partners.is_active })
        .from(partners)
        .where(eq(partners.id, user.partner_id))
        .limit(1);
      if (!partner?.is_active) {
        set.status = 401;
        return { error: "Akun mitra tidak aktif" };
      }
    }

    let partnerName: string | null = null;
    let partnerPicName: string | null = null;
    let partnerPhone: string | null = null;
    let partnerAddress: string | null = null;
    let partnerPhoto: string | null = null;
    if (user.partner_id) {
      const [partner] = await db
        .select({
          name: partners.name,
          pic_name: partners.pic_name,
          phone: partners.pic_phone,
          address: partners.address,
          photo: partners.profile_photo,
        })
        .from(partners)
        .where(eq(partners.id, user.partner_id))
        .limit(1);
      partnerName = partner?.name ?? null;
      partnerPicName = partner?.pic_name ?? null;
      partnerPhone = partner?.phone ?? null;
      partnerAddress = partner?.address ?? null;
      partnerPhoto = partner?.photo ?? null;
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
        partner_pic_name: partnerPicName,
        partner_phone: partnerPhone,
        partner_address: partnerAddress,
        partner_photo: partnerPhoto,
        full_name: user.full_name,
      },
    };
  },
  {
    body: t.Object({
      email: t.String({ minLength: 3, maxLength: 254 }),
      password: t.String({ minLength: 8, maxLength: 128 }),
    }),
  },
);

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
    if (dbUser.partner_id) {
      const [partner] = await db
        .select({
          name: partners.name,
          pic_name: partners.pic_name,
          phone: partners.pic_phone,
          address: partners.address,
          photo: partners.profile_photo,
        })
        .from(partners)
        .where(eq(partners.id, dbUser.partner_id))
        .limit(1);
      partnerName = partner?.name ?? null;
      partnerPicName = partner?.pic_name ?? null;
      partnerPhone = partner?.phone ?? null;
      partnerAddress = partner?.address ?? null;
      partnerPhoto = partner?.photo ?? null;
    }

    return {
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

      if (body.photo_data_url !== null) {
        const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(
          body.photo_data_url,
        );
        const bytes = match ? Buffer.from(match[1], "base64") : null;
        if (
          !bytes ||
          bytes.length === 0 ||
          bytes.length > 256_000 ||
          bytes[0] !== 0xff ||
          bytes[1] !== 0xd8 ||
          bytes[2] !== 0xff ||
          bytes[bytes.length - 2] !== 0xff ||
          bytes[bytes.length - 1] !== 0xd9
        ) {
          set.status = 422;
          return {
            error: "Foto profil harus berupa gambar JPEG maksimal 250 KB",
          };
        }
      }

      const [updated] = await db
        .update(partners)
        .set({
          name,
          pic_name: picName,
          pic_phone: phone,
          address,
          profile_photo: body.photo_data_url,
        })
        .where(eq(partners.id, dbUser.partner_id))
        .returning({ id: partners.id });

      if (!updated) {
        set.status = 404;
        return { error: "Profil mitra tidak ditemukan" };
      }
      return { success: true };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 2, maxLength: 120 }),
        pic_name: t.String({ minLength: 2, maxLength: 120 }),
        phone: t.String({ minLength: 8, maxLength: 24 }),
        address: t.String({ minLength: 5, maxLength: 500 }),
        photo_data_url: t.Union([t.String({ maxLength: 350_000 }), t.Null()]),
      }),
    },
  );
