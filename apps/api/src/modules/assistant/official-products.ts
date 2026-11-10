import { getProductAliases } from "./word-loader";

export const OFFICIAL_PRODUCTS = [...getProductAliases().keys()];

export function isOfficialProduct(name: string): boolean {
  return OFFICIAL_PRODUCTS.some((product) => product === name);
}
