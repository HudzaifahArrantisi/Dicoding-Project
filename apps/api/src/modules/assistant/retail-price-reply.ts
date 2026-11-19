import { OFFICIAL_RETAIL_PRICES } from "@daisuki/shared";
import { getProductAliases } from "./word-loader";

export function retailPriceReply(message: string): string | null {
  if (!/\b(?:harga(?:nya)?|price|banderol|tarif)\b/i.test(message)) return null;
  if (/\b(?:omset|omzet|penjualan|terjual|stok)\b/i.test(message)) return null;

  const normalized = message.toLowerCase();
  const namedProducts = Object.entries(OFFICIAL_RETAIL_PRICES).filter(([name]) => {
    const aliases = getProductAliases().get(name) ?? [];
    return [name.toLowerCase(), ...aliases].some((alias) => normalized.includes(alias));
  });
  const products = namedProducts.length ? namedProducts : Object.entries(OFFICIAL_RETAIL_PRICES);
  return `Harga normal per pcs:\n${products.map(([name, price]) =>
    `- ${name}: Rp${price.toLocaleString("id-ID")}/pcs`,
  ).join("\n")}`;
}

export function isStaleCatalogExcerpt(source: string, excerpt: string): boolean {
  return /company[_-]knowledge/i.test(source) &&
    /(?:Rp\s*)?(?:12[.,]?000|10[.,]?000|8[.,]?500|15[.,]?000)\s*(?:\/\s*pcs|\b)|(?:price_b2b|Price B2B)/i.test(excerpt);
}
