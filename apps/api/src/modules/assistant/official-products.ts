export const OFFICIAL_PRODUCTS = [
  "Seblak Jadul Instan",
  "Basreng Daun Jeruk",
  "Makaroni Daun Jeruk",
  "Keripik Pisang Rasa Coklat",
] as const;

export function isOfficialProduct(name: string): boolean {
  return OFFICIAL_PRODUCTS.some((product) => product === name);
}
