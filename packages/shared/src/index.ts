export type StockStatus = "aman" | "waspada" | "kritis";

export const STOCK_THRESHOLDS = { aman: 50, kritis: 20 } as const;

export function stockPercent(qty: number, parLevel: number): number {
  return parLevel > 0 ? (qty / parLevel) * 100 : 0;
}

export function getStockStatus(qty: number, parLevel: number): StockStatus {
  if (qty <= 10) return "kritis";
  const pct = stockPercent(qty, parLevel);
  if (pct > STOCK_THRESHOLDS.aman) return "aman";
  if (pct >= STOCK_THRESHOLDS.kritis) return "waspada";
  return "kritis";
}

export const STALE_AFTER_HOURS = 24;

export function isStale(updatedAt: Date | string, now = new Date()): boolean {
  const t = typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt;
  return now.getTime() - t.getTime() > STALE_AFTER_HOURS * 60 * 60 * 1000;
}

export const ORDER_STATUSES = [
  "diproses",
  "disetujui",
  "dalam_pengiriman",
  "selesai",
  "ditolak",
  "dibatalkan",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  diproses: "Menunggu persetujuan",
  disetujui: "Disetujui",
  dalam_pengiriman: "Dalam pengiriman",
  selesai: "Selesai",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
};

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  diproses: ["disetujui", "ditolak", "dibatalkan"],
  disetujui: ["dalam_pengiriman"],
  dalam_pengiriman: ["selesai"],
  selesai: [],
  ditolak: [],
  dibatalkan: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus);
}

export type UserRole = "admin" | "mitra";
export type PartnerType = "hotel" | "restoran" | "kafe" | "minimarket";
