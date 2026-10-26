import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { and, eq, inArray } from "drizzle-orm";
import { db, sql } from "./client";
import { partnerStocks, partners, products, users } from "./schema";

const brands = [
  "Arunika", "Cendana", "Puspa", "Nirwana", "Sembada",
  "Langit", "Senja", "Samudra", "Kencana", "Melati",
  "Seruni", "Purnama", "Lestari", "Mentari", "Angkasa",
  "Mahoni", "Teratai", "Cakrawala", "Kirana", "Beringin",
  "Kemuning", "Taman Sari", "Bumi Raya", "Pelangi", "Akasia",
] as const;

const locations = [
  ["Jakarta Selatan", "DKI Jakarta"], ["Jakarta Barat", "DKI Jakarta"],
  ["Jakarta Timur", "DKI Jakarta"], ["Jakarta Utara", "DKI Jakarta"],
  ["Tangerang Selatan", "Banten"], ["Tangerang", "Banten"],
  ["Serang", "Banten"], ["Bandung", "Jawa Barat"],
  ["Bekasi", "Jawa Barat"], ["Bogor", "Jawa Barat"],
  ["Depok", "Jawa Barat"], ["Cirebon", "Jawa Barat"],
  ["Semarang", "Jawa Tengah"], ["Solo", "Jawa Tengah"],
  ["Yogyakarta", "DI Yogyakarta"], ["Surabaya", "Jawa Timur"],
  ["Malang", "Jawa Timur"], ["Sidoarjo", "Jawa Timur"],
  ["Denpasar", "Bali"], ["Mataram", "Nusa Tenggara Barat"],
  ["Medan", "Sumatera Utara"], ["Padang", "Sumatera Barat"],
  ["Palembang", "Sumatera Selatan"], ["Makassar", "Sulawesi Selatan"],
  ["Balikpapan", "Kalimantan Timur"],
] as const;

const categories = [
  { type: "hotel", label: "Hotel", parLevel: 80 },
  { type: "restoran", label: "Restoran", parLevel: 60 },
  { type: "kafe", label: "Kafe", parLevel: 40 },
  { type: "minimarket", label: "Minimarket", parLevel: 100 },
] as const;

const productSkus = ["DSK-SB-001", "DSK-BR-002", "DSK-MK-003", "DSK-KP-004"];
const credentialPath = fileURLToPath(new URL("../../.demo-mitra-credentials.txt", import.meta.url));

function seedUuid(kind: "partner" | "user", number: number) {
  const hex = createHash("sha1")
    .update(`daisuki-demo-mitra-2026:${kind}:${number}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const examples = categories.flatMap((category, categoryIndex) =>
  brands.map((brand, locationIndex) => {
    const number = categoryIndex * brands.length + locationIndex + 1;
    const [city, province] = locations[locationIndex]!;
    return {
      number,
      partnerId: seedUuid("partner", number),
      userId: seedUuid("user", number),
      email: `mitra-demo-${String(number).padStart(3, "0")}@daisuki.test`,
      name: `${category.label} ${brand} ${city}`,
      type: category.type,
      address: `${city}, ${province}`,
      picName: `PIC Demo ${String(number).padStart(3, "0")}`,
      parLevel: category.parLevel,
    };
  }),
);

async function main() {
  const apply = process.argv.includes("--apply");
  if (process.argv.some((arg) => arg.startsWith("--") && arg !== "--apply")) {
    throw new Error("Opsi yang tersedia hanya --apply");
  }

  const currentProducts = await db
    .select({ id: products.id, sku: products.sku })
    .from(products)
    .where(and(inArray(products.sku, productSkus), eq(products.is_active, true)));
  if (currentProducts.length !== productSkus.length) {
    throw new Error("Empat produk resmi harus tersedia dan aktif sebelum seed mitra dijalankan");
  }

  const existingPartners = await db
    .select({ id: partners.id, name: partners.name })
    .from(partners)
    .where(inArray(partners.id, examples.map((example) => example.partnerId)));
  const existingUsers = await db
    .select({ id: users.id, email: users.email, partner_id: users.partner_id, role: users.role })
    .from(users)
    .where(inArray(users.email, examples.map((example) => example.email)));
  const expectedPartners = new Map(examples.map((example) => [example.partnerId, example.name]));
  const expectedUsers = new Map(examples.map((example) => [example.email, example]));
  if (existingPartners.some((partner) => expectedPartners.get(partner.id) !== partner.name)) {
    throw new Error("ID mitra contoh bertabrakan dengan mitra lain; tidak ada data diubah");
  }
  if (existingUsers.some((user) => {
    const example = expectedUsers.get(user.email)!;
    return user.id !== example.userId || user.partner_id !== example.partnerId || user.role !== "mitra";
  })) {
    throw new Error("Email akun contoh sudah dipakai akun lain; tidak ada data diubah");
  }

  console.log(`Target: ${examples.length} mitra (25 per jenis), ${examples.length} akun, ${examples.length * productSkus.length} stok.`);
  console.log(`Sudah ada: ${existingPartners.length} mitra dan ${existingUsers.length} akun contoh.`);
  if (!apply) {
    console.log("Pratinjau selesai. Jalankan dengan --apply untuk menulis ke Neon.");
    return;
  }

  const credentialText = await readFile(credentialPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  const savedPassword = credentialText?.match(/^Kata sandi bersama: (.+)$/m)?.[1];
  if (existingUsers.length > 0 && !savedPassword) {
    throw new Error("Sebagian akun sudah ada, tetapi file kredensial lokal hilang; hentikan agar kata sandi tidak terpecah");
  }
  const password = savedPassword ?? "password123";
  if (!savedPassword) {
    const contents = [
      "Akun demo mitra Daisuki (jangan commit file ini)",
      `Kata sandi bersama: ${password}`,
      "Email: mitra-demo-001@daisuki.test sampai mitra-demo-100@daisuki.test",
      "Semua akun ini hanya untuk data contoh.",
      "",
    ].join("\n");
    await writeFile(credentialPath, contents, { flag: "wx", mode: 0o600 });
  }
  const passwordHash = await Bun.password.hash(password);

  await db.transaction(async (tx) => {
    await tx.insert(partners).values(examples.map((example) => ({
      id: example.partnerId,
      name: example.name,
      type: example.type,
      address: example.address,
      pic_name: example.picName,
      is_active: true,
    }))).onConflictDoNothing({ target: partners.id });

    await tx.insert(users).values(examples.map((example) => ({
      id: example.userId,
      email: example.email,
      username: example.email.replace("@daisuki.test", ""),
      password_hash: passwordHash,
      role: "mitra" as const,
      partner_id: example.partnerId,
      full_name: example.picName,
    }))).onConflictDoNothing({ target: users.email });

    await tx.insert(partnerStocks).values(examples.flatMap((example) =>
      currentProducts.map((product, productIndex) => {
        const ratio = [0.1, 0.35, 0.65, 0.85][(example.number + productIndex) % 4]!;
        return {
          partner_id: example.partnerId,
          product_id: product.id,
          current_qty: Math.floor(example.parLevel * ratio),
          par_level: example.parLevel,
        };
      }),
    )).onConflictDoNothing({ target: [partnerStocks.partner_id, partnerStocks.product_id] });
  });

  const [verifiedPartners, verifiedUsers, verifiedStocks] = await Promise.all([
    db.select({ id: partners.id }).from(partners).where(inArray(partners.id, examples.map((example) => example.partnerId))),
    db.select({ id: users.id }).from(users).where(inArray(users.id, examples.map((example) => example.userId))),
    db.select({ partner_id: partnerStocks.partner_id }).from(partnerStocks).where(inArray(partnerStocks.partner_id, examples.map((example) => example.partnerId))),
  ]);
  console.log("Verifikasi data contoh:", {
    partners: verifiedPartners.length,
    mitra_users: verifiedUsers.length,
    stock_rows: verifiedStocks.length,
  });
  console.log(`Kredensial lokal: ${credentialPath}`);
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
