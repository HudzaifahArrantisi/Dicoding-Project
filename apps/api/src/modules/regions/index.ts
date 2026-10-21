import { Elysia } from "elysia";
import { getAuthUser } from "../../plugins/auth";

export type RegionLevel = "provinces" | "regencies" | "districts" | "villages";
export type RegionOption = { code: string; name: string };
export type RegionCodes = {
  province_code: string;
  regency_code: string;
  district_code: string;
  village_code: string;
};

const codePattern: Record<RegionLevel, RegExp> = {
  provinces: /^$/,
  regencies: /^\d{2}$/,
  districts: /^\d{2}\.\d{2}$/,
  villages: /^\d{2}\.\d{2}\.\d{2}$/,
};
const cache = new Map<string, { expiresAt: number; data: RegionOption[] }>();

export class RegionError extends Error {
  constructor(public status: 422 | 503, message: string) {
    super(message);
  }
}

export async function getRegionOptions(level: RegionLevel, parentCode = ""): Promise<RegionOption[]> {
  if (!codePattern[level].test(parentCode)) {
    throw new RegionError(422, "Kode wilayah tidak valid");
  }
  const key = `${level}/${parentCode}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  try {
    const path = level === "provinces" ? "provinces.json" : `${level}/${parentCode}.json`;
    const response = await fetch(`https://wilayah.id/api/${path}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as { data?: unknown };
    if (!Array.isArray(payload.data) || !payload.data.every((item) =>
      item && typeof item.code === "string" && typeof item.name === "string"
    )) throw new Error("Format data wilayah tidak valid");
    const data = (payload.data as RegionOption[]).map((item) => ({
      code: item.code,
      name: item.name.trim(),
    }));
    cache.set(key, { expiresAt: Date.now() + 24 * 60 * 60 * 1000, data });
    return data;
  } catch {
    if (cached) return cached.data;
    throw new RegionError(503, "Daftar wilayah belum tersedia. Coba lagi nanti.");
  }
}

export async function resolveRegion(codes: RegionCodes) {
  const values = Object.values(codes);
  if (values.every((value) => !value)) {
    return {
      province_code: null, province_name: null,
      regency_code: null, regency_name: null,
      district_code: null, district_name: null,
      village_code: null, village_name: null,
    };
  }
  if (values.some((value) => !value)) {
    throw new RegionError(422, "Lengkapi provinsi, kabupaten/kota, kecamatan, dan kelurahan/desa");
  }
  const province = (await getRegionOptions("provinces")).find((item) => item.code === codes.province_code);
  if (!province) throw new RegionError(422, "Provinsi tidak valid");
  const regency = (await getRegionOptions("regencies", province.code)).find((item) => item.code === codes.regency_code);
  if (!regency) throw new RegionError(422, "Kabupaten/kota tidak sesuai dengan provinsi");
  const district = (await getRegionOptions("districts", regency.code)).find((item) => item.code === codes.district_code);
  if (!district) throw new RegionError(422, "Kecamatan tidak sesuai dengan kabupaten/kota");
  const village = (await getRegionOptions("villages", district.code)).find((item) => item.code === codes.village_code);
  if (!village) throw new RegionError(422, "Kelurahan/desa tidak sesuai dengan kecamatan");
  return {
    province_code: province.code, province_name: province.name,
    regency_code: regency.code, regency_name: regency.name,
    district_code: district.code, district_name: district.name,
    village_code: village.code, village_name: village.name,
  };
}

export const regionModule = new Elysia({ prefix: "/regions" })
  .get("/provinces", async ({ headers, set }) => {
    if (!await getAuthUser(headers)) { set.status = 401; return { error: "Unauthorized" }; }
    try { return { data: await getRegionOptions("provinces") }; }
    catch (error) { set.status = error instanceof RegionError ? error.status : 503; return { error: error instanceof Error ? error.message : "Daftar wilayah belum tersedia" }; }
  })
  .get("/regencies/:code", async ({ headers, params, set }) => {
    if (!await getAuthUser(headers)) { set.status = 401; return { error: "Unauthorized" }; }
    try { return { data: await getRegionOptions("regencies", params.code) }; }
    catch (error) { set.status = error instanceof RegionError ? error.status : 503; return { error: error instanceof Error ? error.message : "Daftar wilayah belum tersedia" }; }
  })
  .get("/districts/:code", async ({ headers, params, set }) => {
    if (!await getAuthUser(headers)) { set.status = 401; return { error: "Unauthorized" }; }
    try { return { data: await getRegionOptions("districts", params.code) }; }
    catch (error) { set.status = error instanceof RegionError ? error.status : 503; return { error: error instanceof Error ? error.message : "Daftar wilayah belum tersedia" }; }
  })
  .get("/villages/:code", async ({ headers, params, set }) => {
    if (!await getAuthUser(headers)) { set.status = 401; return { error: "Unauthorized" }; }
    try { return { data: await getRegionOptions("villages", params.code) }; }
    catch (error) { set.status = error instanceof RegionError ? error.status : 503; return { error: error instanceof Error ? error.message : "Daftar wilayah belum tersedia" }; }
  });
