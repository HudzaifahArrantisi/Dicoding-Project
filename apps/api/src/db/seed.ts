import { and, eq, sql } from "drizzle-orm";
import { db, sql as postgresClient } from "./client";
import {
  notifications,
  partners,
  partnerStocks,
  products,
  users,
} from "./schema";

declare const Bun: {
  password: {
    hash(password: string): Promise<string>;
  };
};

type PartnerSeed = typeof partners.$inferInsert;

async function upsertPartner(data: PartnerSeed) {
  const [existing] = await db
    .select()
    .from(partners)
    .where(eq(partners.name, data.name))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(partners)
      .set({
        type: data.type,
        pic_name: data.pic_name,
        is_active: true,
      })
      .where(eq(partners.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db.insert(partners).values(data).returning();
  return created;
}

export async function runSeed() {
  console.log("Menyiapkan data demo Daisuki...");

  const [kafeSejuk, hotelAruna, restoBento] = await Promise.all([
    upsertPartner({
      name: "Kafe Sejuk BSD",
      type: "kafe",
      pic_name: "Rina",
      is_active: true,
    }),
    upsertPartner({
      name: "Hotel Aruna Jakarta",
      type: "hotel",
      pic_name: "Budi",
      is_active: true,
    }),
    upsertPartner({
      name: "Resto Bento Serpong",
      type: "restoran",
      pic_name: "Siti",
      is_active: true,
    }),
  ]);

  const passwordHash = await Bun.password.hash("password123");
  const demoUsers = await db
    .insert(users)
    .values([
      {
        email: "admin@daisuki.test",
        password_hash: passwordHash,
        role: "admin",
        partner_id: null,
        full_name: "Admin Daisuki Pusat",
      },
      {
        email: "mitra1@daisuki.test",
        password_hash: passwordHash,
        role: "mitra",
        partner_id: kafeSejuk.id,
        full_name: "Rina",
      },
      {
        email: "mitra2@daisuki.test",
        password_hash: passwordHash,
        role: "mitra",
        partner_id: hotelAruna.id,
        full_name: "Budi",
      },
    ])
    .onConflictDoUpdate({
      target: users.email,
      set: {
        password_hash: passwordHash,
        role: sql`excluded.role`,
        partner_id: sql`excluded.partner_id`,
        full_name: sql`excluded.full_name`,
      },
    })
    .returning();

  const mitraKafe = demoUsers.find(
    (user) => user.email === "mitra1@daisuki.test",
  );
  if (!mitraKafe) {
    throw new Error("Akun demo Kafe Sejuk gagal dibuat");
  }

  await db.update(products).set({ is_active: false });

  const productRows = await db
    .insert(products)
    .values([
      {
        sku: "DSK-SB-001",
        name: "Seblak Jadul Instan",
        unit: "pcs",
        b2b_price: "12000.00",
        central_stock: 1000,
        is_active: true,
      },
      {
        sku: "DSK-BR-002",
        name: "Basreng Daun Jeruk",
        unit: "pcs",
        b2b_price: "10000.00",
        central_stock: 1000,
        is_active: true,
      },
      {
        sku: "DSK-MK-003",
        name: "Makaroni Daun Jeruk",
        unit: "pcs",
        b2b_price: "8500.00",
        central_stock: 1000,
        is_active: true,
      },
      {
        sku: "DSK-KP-004",
        name: "Keripik Pisang Rasa Coklat",
        unit: "pcs",
        b2b_price: "15000.00",
        central_stock: 1000,
        is_active: true,
      },
    ])
    .onConflictDoUpdate({
      target: products.sku,
      set: {
        name: sql`excluded.name`,
        unit: sql`excluded.unit`,
        b2b_price: sql`excluded.b2b_price`,
        central_stock: 1000,
        is_active: true,
      },
    })
    .returning();

  const productBySku = new Map(
    productRows.map((product) => [product.sku, product]),
  );

  await db
    .insert(partnerStocks)
    .values(
      [kafeSejuk, hotelAruna, restoBento].flatMap((partner) =>
        productRows.map((product) => ({
          partner_id: partner.id,
          product_id: product.id,
          current_qty: 0,
          par_level: 40,
        })),
      ),
    )
    .onConflictDoNothing({
      target: [partnerStocks.partner_id, partnerStocks.product_id],
    });

  const stockScenario = [
    { sku: "DSK-SB-001", currentQty: 10 },
    { sku: "DSK-BR-002", currentQty: 10 },
    { sku: "DSK-MK-003", currentQty: 30 },
    { sku: "DSK-KP-004", currentQty: 35 },
  ];

  for (const scenario of stockScenario) {
    const product = productBySku.get(scenario.sku);
    if (!product) {
      throw new Error(`Produk ${scenario.sku} gagal dibuat`);
    }

    await db
      .insert(partnerStocks)
      .values({
        partner_id: kafeSejuk.id,
        product_id: product.id,
        current_qty: scenario.currentQty,
        par_level: 40,
        updated_at: new Date(),
        updated_by: mitraKafe.id,
      })
      .onConflictDoUpdate({
        target: [partnerStocks.partner_id, partnerStocks.product_id],
        set: {
          current_qty: scenario.currentQty,
          par_level: 40,
          updated_at: new Date(),
          updated_by: mitraKafe.id,
        },
      });
  }

  const criticalProduct = productBySku.get("DSK-SB-001");
  if (!criticalProduct) {
    throw new Error("Produk kritis demo tidak tersedia");
  }

  const alertTitle = "Stok kritis: Seblak Jadul Instan";
  const [existingAlert] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.partner_id, kafeSejuk.id),
        eq(notifications.title, alertTitle),
      ),
    )
    .limit(1);

  if (!existingAlert) {
    await db.insert(notifications).values({
      audience: "admin",
      type: "low_stock",
      partner_id: kafeSejuk.id,
      title: alertTitle,
      body: "Seblak Jadul Instan di Kafe Sejuk BSD tersisa 10 dari 40 pcs (25%). Periksa kebutuhan restock cabang.",
    });
  }

  console.log(
    `Seed selesai: 3 mitra, ${demoUsers.length} akun demo, ${productRows.length} produk, dan 4 stok awal.`,
  );
}

if (import.meta.main) {
  runSeed()
    .then(async () => {
      await postgresClient.end();
      process.exit(0);
    })
    .catch(async (error: unknown) => {
      console.error("Seed gagal:", error);
      await postgresClient.end();
      process.exit(1);
    });
}
