import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  bigserial,
  primaryKey,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "mitra"]);
export const partnerTypeEnum = pgEnum("partner_type", [
  "hotel",
  "restoran",
  "kafe",
  "minimarket",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "diproses",
  "disetujui",
  "dalam_pengiriman",
  "selesai",
  "ditolak",
  "dibatalkan",
]);
export const stockSourceEnum = pgEnum("stock_source", [
  "manual_update",
  "order_received",
  "adjustment",
]);

export const partners = pgTable("partners", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: partnerTypeEnum("type").notNull(),
  address: text("address"),
  pic_name: text("pic_name"),
  pic_phone: text("pic_phone"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull(),
  partner_id: uuid("partner_id").references(() => partners.id),
  full_name: text("full_name").notNull(),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("pcs"),
  b2b_price: numeric("b2b_price", { precision: 12, scale: 2 }).notNull(),
  central_stock: integer("central_stock").notNull().default(1000),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const partnerStocks = pgTable(
  "partner_stocks",
  {
    partner_id: uuid("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    product_id: uuid("product_id")
      .notNull()
      .references(() => products.id),
    current_qty: integer("current_qty").notNull().default(0),
    par_level: integer("par_level").notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_by: uuid("updated_by").references(() => users.id),
  },
  (table) => [primaryKey({ columns: [table.partner_id, table.product_id] })],
);

export const stockLogs = pgTable("stock_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  partner_id: uuid("partner_id")
    .notNull()
    .references(() => partners.id),
  product_id: uuid("product_id")
    .notNull()
    .references(() => products.id),
  qty_before: integer("qty_before").notNull(),
  qty_after: integer("qty_after").notNull(),
  source: stockSourceEnum("source").notNull(),
  created_by: uuid("created_by").references(() => users.id),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  order_no: text("order_no").notNull().unique(),
  partner_id: uuid("partner_id")
    .notNull()
    .references(() => partners.id),
  status: orderStatusEnum("status").notNull().default("diproses"),
  note: text("note"),
  admin_note: text("admin_note"),
  rejected_reason: text("rejected_reason"),
  created_by: uuid("created_by").references(() => users.id),
  approved_by: uuid("approved_by").references(() => users.id),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  approved_at: timestamp("approved_at", { withTimezone: true }),
  shipped_at: timestamp("shipped_at", { withTimezone: true }),
  completed_at: timestamp("completed_at", { withTimezone: true }),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  order_id: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  product_id: uuid("product_id")
    .notNull()
    .references(() => products.id),
  qty_requested: integer("qty_requested").notNull(),
  qty_approved: integer("qty_approved"),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  audience: text("audience").notNull(),
  type: text("type").notNull(),
  partner_id: uuid("partner_id").references(() => partners.id),
  user_id: uuid("user_id").references(() => users.id),
  title: text("title").notNull(),
  body: text("body"),
  read_at: timestamp("read_at", { withTimezone: true }),
  resolved_at: timestamp("resolved_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const restockRecommendations = pgTable("restock_recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  partner_id: uuid("partner_id")
    .notNull()
    .references(() => partners.id),
  product_id: uuid("product_id")
    .notNull()
    .references(() => products.id),
  forecast_qty: integer("forecast_qty").notNull(),
  suggested_qty: integer("suggested_qty").notNull(),
  days_of_cover: numeric("days_of_cover", { precision: 5, scale: 1 }),
  model_version: text("model_version").notNull(),
  generated_at: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
