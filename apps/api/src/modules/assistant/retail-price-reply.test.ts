import { expect, test } from "bun:test";
import { isStaleCatalogExcerpt, retailPriceReply } from "./retail-price-reply";

test("pertanyaan harga normal satu produk memakai harga resmi", () => {
  const reply = retailPriceReply("Berapa harga seblak?");
  expect(reply).toContain("Seblak Jadul Instan: Rp27.500/pcs");
  expect(reply).not.toContain("Basreng");
});

test("pertanyaan harga semua produk menampilkan empat harga normal", () => {
  const reply = retailPriceReply("Harga semua produk Daisuki berapa?");
  expect(reply).toContain("Seblak Jadul Instan: Rp27.500/pcs");
  expect(reply).toContain("Basreng Daun Jeruk: Rp25.000/pcs");
  expect(reply).toContain("Makaroni Daun Jeruk: Rp25.000/pcs");
  expect(reply).toContain("Keripik Pisang Rasa Coklat: Rp25.000/pcs");
});

test("pertanyaan daftar harga tidak menampilkan harga pasokan lama atau SKU", () => {
  const reply = retailPriceReply("Berapa harga B2B Seblak? ");
  expect(reply).toContain("Seblak Jadul Instan: Rp27.500/pcs");
  expect(reply).not.toContain("Rp12.000");
  expect(reply).not.toContain("DSK-SB-001");
});

test("pertanyaan lanjutan tentang harga tetap memakai daftar resmi", () => {
  expect(retailPriceReply("Kalau harganya berapa?")).toContain("Seblak Jadul Instan: Rp27.500/pcs");
});

test("cuplikan katalog lama dari indeks model tidak ikut ke prompt", () => {
  expect(isStaleCatalogExcerpt("company_knowledge.public.md", "Seblak Jadul Instan: Rp12.000 / pcs")).toBe(true);
  expect(isStaleCatalogExcerpt("company_knowledge.md", "- Price B2B: 8500")).toBe(true);
  expect(isStaleCatalogExcerpt("company_knowledge.public.md", "Seblak Jadul Instan: Rp27.500 / pcs")).toBe(false);
});
