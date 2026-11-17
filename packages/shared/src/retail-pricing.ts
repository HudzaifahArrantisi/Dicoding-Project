export const RETAIL_PRICE_SEBLAK = 27_500;
export const RETAIL_PRICE_OTHER = 25_000;

export const OFFICIAL_RETAIL_PRICES = {
  "Seblak Jadul Instan": RETAIL_PRICE_SEBLAK,
  "Basreng Daun Jeruk": RETAIL_PRICE_OTHER,
  "Makaroni Daun Jeruk": RETAIL_PRICE_OTHER,
  "Keripik Pisang Rasa Coklat": RETAIL_PRICE_OTHER,
} as const;

export function retailPriceForProduct(name: string): number | null {
  return Object.prototype.hasOwnProperty.call(OFFICIAL_RETAIL_PRICES, name)
    ? OFFICIAL_RETAIL_PRICES[name as keyof typeof OFFICIAL_RETAIL_PRICES]
    : null;
}
