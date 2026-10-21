import { afterAll, expect, test } from "bun:test";
import { RegionError, resolveRegion } from "../src/modules/regions";

const originalFetch = globalThis.fetch;
const options: Record<string, Array<{ code: string; name: string }>> = {
  "provinces.json": [{ code: "99", name: "Provinsi Contoh" }],
  "regencies/99.json": [{ code: "99.01", name: "Kota Contoh" }],
  "districts/99.01.json": [{ code: "99.01.01", name: "Kecamatan Contoh" }],
  "villages/99.01.01.json": [{ code: "99.01.01.1001", name: "Kelurahan Contoh" }],
};

globalThis.fetch = Object.assign(async (input: Parameters<typeof fetch>[0]) => {
  const path = new URL(String(input)).pathname.replace("/api/", "");
  return new Response(JSON.stringify({ data: options[path] ?? [] }), {
    headers: { "content-type": "application/json" },
  });
}, { preconnect: originalFetch.preconnect });

afterAll(() => { globalThis.fetch = originalFetch; });

test("menerima wilayah yang sesuai di setiap tingkat", async () => {
  const region = await resolveRegion({
    province_code: "99",
    regency_code: "99.01",
    district_code: "99.01.01",
    village_code: "99.01.01.1001",
  });
  expect(region.regency_name).toBe("Kota Contoh");
  expect(region.village_name).toBe("Kelurahan Contoh");
});

test("menolak kota yang tidak termasuk provinsi terpilih", async () => {
  await expect(resolveRegion({
    province_code: "99",
    regency_code: "99.02",
    district_code: "99.02.01",
    village_code: "99.02.01.1001",
  })).rejects.toBeInstanceOf(RegionError);
});
