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

const locationDetails: Record<string, {
  regencyName: string;
  provinceName: string;
  districtName: string;
  villageName: string;
  streetName: string;
  postalCode: string;
}> = {
  "Jakarta Selatan": { regencyName: "Kota Administrasi Jakarta Selatan", provinceName: "DKI Jakarta", districtName: "Pasar Minggu", villageName: "Kebagusan", streetName: "Jl. Kebagusan Raya No. 41, RT 03/RW 06", postalCode: "12520" },
  "Jakarta Barat": { regencyName: "Kota Administrasi Jakarta Barat", provinceName: "DKI Jakarta", districtName: "Grogol Petamburan", villageName: "Tanjung Duren Selatan", streetName: "Jl. Tanjung Duren Raya No. 72, RT 04/RW 05", postalCode: "11470" },
  "Jakarta Timur": { regencyName: "Kota Administrasi Jakarta Timur", provinceName: "DKI Jakarta", districtName: "Jatinegara", villageName: "Cipinang Cempedak", streetName: "Jl. Otista Raya No. 56, RT 03/RW 07", postalCode: "13340" },
  "Jakarta Utara": { regencyName: "Kota Administrasi Jakarta Utara", provinceName: "DKI Jakarta", districtName: "Kelapa Gading", villageName: "Kelapa Gading Timur", streetName: "Jl. Boulevard Raya Blok LA No. 10, RT 01/RW 12", postalCode: "14240" },
  "Tangerang Selatan": { regencyName: "Kota Tangerang Selatan", provinceName: "Banten", districtName: "Serpong", villageName: "Lengkong Gudang", streetName: "Ruko Tol Boulevard Blok B No. 12, BSD City, RT 02/RW 05", postalCode: "15310" },
  "Tangerang": { regencyName: "Kota Tangerang", provinceName: "Banten", districtName: "Tangerang", villageName: "Sukasari", streetName: "Jl. Kisamaun No. 64, RT 02/RW 03", postalCode: "15118" },
  "Serang": { regencyName: "Kota Serang", provinceName: "Banten", districtName: "Serang", villageName: "Kotabaru", streetName: "Jl. Veteran No. 14, RT 01/RW 04", postalCode: "42112" },
  "Bandung": { regencyName: "Kota Bandung", provinceName: "Jawa Barat", districtName: "Coblong", villageName: "Dago", streetName: "Jl. Ir. H. Juanda No. 142, RT 03/RW 08", postalCode: "40135" },
  "Bekasi": { regencyName: "Kota Bekasi", provinceName: "Jawa Barat", districtName: "Bekasi Selatan", villageName: "Pekayon Jaya", streetName: "Jl. Boulevard Ahmad Yani Blok M No. 8, Grand Galaxy, RT 02/RW 10", postalCode: "17148" },
  "Bogor": { regencyName: "Kota Bogor", provinceName: "Jawa Barat", districtName: "Bogor Tengah", villageName: "Babakan", streetName: "Jl. Pajajaran No. 84, RT 02/RW 05", postalCode: "16128" },
  "Depok": { regencyName: "Kota Depok", provinceName: "Jawa Barat", districtName: "Beji", villageName: "Pondok Cina", streetName: "Jl. Margonda Raya No. 288, RT 03/RW 07", postalCode: "16424" },
  "Cirebon": { regencyName: "Kota Cirebon", provinceName: "Jawa Barat", districtName: "Kejaksan", villageName: "Kebonbaru", streetName: "Jl. Siliwangi No. 108, RT 02/RW 04", postalCode: "45121" },
  "Semarang": { regencyName: "Kota Semarang", provinceName: "Jawa Tengah", districtName: "Semarang Tengah", villageName: "Pandansari", streetName: "Jl. Pemuda No. 118, RT 02/RW 03", postalCode: "50139" },
  "Solo": { regencyName: "Kota Surakarta", provinceName: "Jawa Tengah", districtName: "Banjarsari", villageName: "Manahan", streetName: "Jl. Adi Sucipto No. 78, RT 02/RW 06", postalCode: "57139" },
  "Yogyakarta": { regencyName: "Kota Yogyakarta", provinceName: "Daerah Istimewa Yogyakarta", districtName: "Gondomanan", villageName: "Ngupasan", streetName: "Jl. Malioboro No. 64, RT 02/RW 04", postalCode: "55122" },
  "Surabaya": { regencyName: "Kota Surabaya", provinceName: "Jawa Timur", districtName: "Tegalsari", villageName: "Tegalsari", streetName: "Jl. Basuki Rahmat No. 95, RT 03/RW 06", postalCode: "60262" },
  "Malang": { regencyName: "Kota Malang", provinceName: "Jawa Timur", districtName: "Klojen", villageName: "Kauman", streetName: "Jl. Ijen No. 42, RT 02/RW 05", postalCode: "65119" },
  "Sidoarjo": { regencyName: "Kabupaten Sidoarjo", provinceName: "Jawa Timur", districtName: "Sidoarjo", villageName: "Sidokumpul", streetName: "Jl. Pahlawan No. 56, RT 02/RW 03", postalCode: "61212" },
  "Denpasar": { regencyName: "Kota Denpasar", provinceName: "Bali", districtName: "Denpasar Selatan", villageName: "Sanur", streetName: "Jl. Danau Tamblingan No. 88, Sanur, RT 02/RW 04", postalCode: "80228" },
  "Mataram": { regencyName: "Kota Mataram", provinceName: "Nusa Tenggara Barat", districtName: "Mataram", villageName: "Mataram Barat", streetName: "Jl. Pejanggik No. 74, RT 02/RW 03", postalCode: "83121" },
  "Medan": { regencyName: "Kota Medan", provinceName: "Sumatera Utara", districtName: "Medan Petisah", villageName: "Petisah Tengah", streetName: "Jl. Gatot Subroto No. 124, RT 02/RW 04", postalCode: "20112" },
  "Padang": { regencyName: "Kota Padang", provinceName: "Sumatera Barat", districtName: "Padang Barat", villageName: "Belakang Tangsi", streetName: "Jl. Veteran No. 58, RT 02/RW 04", postalCode: "25114" },
  "Palembang": { regencyName: "Kota Palembang", provinceName: "Sumatera Selatan", districtName: "Ilir Barat I", villageName: "Lorok Pakjo", streetName: "Jl. Angkatan 45 No. 92, RT 02/RW 04", postalCode: "30137" },
  "Makassar": { regencyName: "Kota Makassar", provinceName: "Sulawesi Selatan", districtName: "Ujung Pandang", villageName: "Sawerigading", streetName: "Jl. Penghibur No. 50, Pantai Losari, RT 02/RW 03", postalCode: "90115" },
  "Balikpapan": { regencyName: "Kota Balikpapan", provinceName: "Kalimantan Timur", districtName: "Balikpapan Kota", villageName: "Klandasan Ulu", streetName: "Jl. Jenderal Sudirman No. 89, RT 02/RW 05", postalCode: "76112" },
};

const categories = [
  { type: "hotel", label: "Hotel", parLevel: 80 },
  { type: "restoran", label: "Restoran", parLevel: 60 },
  { type: "kafe", label: "Kafe", parLevel: 60 },
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
    const loc = locationDetails[city];
    const formattedAddress = loc
      ? `${loc.streetName}, Kel. ${loc.villageName}, Kec. ${loc.districtName}, ${loc.regencyName}, ${loc.provinceName} ${loc.postalCode}`
      : `${city}, ${province}`;
    return {
      number,
      partnerId: seedUuid("partner", number),
      userId: seedUuid("user", number),
      email: `mitra-demo-${String(number).padStart(3, "0")}@daisuki.test`,
      name: `${category.label} ${brand} ${city}`,
      type: category.type,
      address: formattedAddress,
      picName: `PIC Demo ${String(number).padStart(3, "0")}`,
      provinceName: loc?.provinceName ?? province,
      regencyName: loc?.regencyName ?? city,
      districtName: loc?.districtName ?? null,
      villageName: loc?.villageName ?? null,
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
      province_name: example.provinceName,
      regency_name: example.regencyName,
      district_name: example.districtName,
      village_name: example.villageName,
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
