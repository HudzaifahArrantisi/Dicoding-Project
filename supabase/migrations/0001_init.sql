-- ============================================================================
-- DAISUKI B2B INVENTORY & ORDER MANAGEMENT SYSTEM
-- Unified Database Schema (Single Source of Truth)
-- Kompatibel: PostgreSQL / Neon DB / Supabase
-- ============================================================================

-- 1. EKSTENSI
create extension if not exists "pgcrypto";

-- 2. TIPE ENUM KUSTOM
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('admin', 'mitra');
  end if;

  if not exists (select 1 from pg_type where typname = 'partner_type') then
    create type partner_type as enum ('hotel', 'restoran', 'kafe', 'minimarket');
  end if;

  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum (
      'diproses',
      'disetujui',
      'dalam_pengiriman',
      'selesai',
      'ditolak',
      'dibatalkan'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'stock_source') then
    create type stock_source as enum ('manual_update', 'order_received', 'adjustment');
  end if;
end $$;

-- 3. STRUKTUR TABEL SISTEM

-- A. Mitra Cabang (Partners)
create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type partner_type not null,
  address text,
  pic_name text,
  pic_phone text,
  profile_photo text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- B. Pengguna Sistem (Users - Neon DB / Elysia Auth)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role user_role not null,
  partner_id uuid references partners(id) on delete set null,
  full_name text not null,
  created_at timestamptz not null default now(),
  constraint mitra_user_needs_partner check (role = 'admin' or partner_id is not null)
);
create index if not exists users_partner_idx on users (partner_id);

-- C. Produk Resmi Daisuki (Products & Central Warehouse Stock)
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  unit text not null default 'pcs',
  b2b_price numeric(12, 2) not null check (b2b_price >= 0),
  central_stock integer not null default 1000 check (central_stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- D. Stok Fisik Cabang (Partner Stocks)
create table if not exists partner_stocks (
  partner_id uuid not null references partners(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  current_qty integer not null default 0 check (current_qty >= 0),
  par_level integer not null check (par_level > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id) on delete set null,
  primary key (partner_id, product_id),
  constraint qty_within_par check (current_qty <= par_level)
);

-- E. Riwayat Log Perubahan Stok (Stock Logs)
create table if not exists stock_logs (
  id bigint generated always as identity primary key,
  partner_id uuid not null references partners(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  qty_before integer not null,
  qty_after integer not null,
  source stock_source not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists stock_logs_partner_product_created_idx
  on stock_logs (partner_id, product_id, created_at desc);

-- F. Pesanan Restock B2B (Orders)
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  partner_id uuid not null references partners(id) on delete cascade,
  status order_status not null default 'diproses',
  note text,
  admin_note text,
  rejected_reason text,
  created_by uuid references users(id) on delete set null,
  approved_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  shipped_at timestamptz,
  completed_at timestamptz
);
create index if not exists orders_partner_created_idx on orders (partner_id, created_at desc);
create index if not exists orders_status_idx on orders (status);

-- G. Rincian Item Pesanan (Order Items)
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  qty_requested integer not null check (qty_requested > 0),
  qty_approved integer check (qty_approved >= 0)
);
create index if not exists order_items_order_idx on order_items (order_id);

-- H. Notifikasi & Alert (Notifications)
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('admin', 'mitra')),
  type text not null,
  partner_id uuid references partners(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_audience_read_created_idx
  on notifications (audience, read_at, created_at desc);

-- I. Rekomendasi Restock AI / Data Science (Restock Recommendations)
create table if not exists restock_recommendations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  forecast_qty integer not null,
  suggested_qty integer not null,
  days_of_cover numeric(5, 1),
  model_version text not null,
  generated_at timestamptz not null default now(),
  constraint restock_recommendations_partner_product_key unique (partner_id, product_id)
);
create index if not exists restock_rec_partner_idx
  on restock_recommendations (partner_id, generated_at desc);

-- 4. ROLES & PERMISSIONS (Data Science & AI Engine)
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ds_readonly') then
    create role ds_readonly;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'ai_job') then
    create role ai_job;
  end if;
end $$;

grant usage on schema public to ds_readonly, ai_job;
grant select on all tables in schema public to ds_readonly;
grant select, insert on notifications, stock_logs to ai_job;
grant select, update on partner_stocks to ai_job;
grant select on partners, products, orders, order_items to ai_job;
grant select, insert, update, delete on restock_recommendations to ai_job;

-- 5. ROW LEVEL SECURITY (RLS)
alter table partners enable row level security;
alter table users enable row level security;
alter table products enable row level security;
alter table partner_stocks enable row level security;
alter table stock_logs enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table notifications enable row level security;
alter table restock_recommendations enable row level security;

-- Policies untuk ds_readonly & ai_job
do $$
declare
  t text;
begin
  foreach t in array array[
    'partners',
    'products',
    'partner_stocks',
    'stock_logs',
    'orders',
    'order_items',
    'restock_recommendations'
  ] loop
    execute format('drop policy if exists ds_read on %I', t);
    execute format('create policy ds_read on %I for select to ds_readonly using (true)', t);
    execute format('drop policy if exists ai_read on %I', t);
    execute format('create policy ai_read on %I for select to ai_job using (true)', t);
  end loop;
end $$;

drop policy if exists ai_manage_notifications on notifications;
create policy ai_manage_notifications on notifications for all to ai_job using (true) with check (true);

drop policy if exists ai_manage_restock_recommendations on restock_recommendations;
create policy ai_manage_restock_recommendations on restock_recommendations for all to ai_job using (true) with check (true);

drop policy if exists ai_manage_stocks on partner_stocks;
create policy ai_manage_stocks on partner_stocks for all to ai_job using (true) with check (true);

-- 6. REALTIME PUBLICATION (Opsional jika memakai Supabase Realtime)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table partner_stocks, notifications, orders;
  end if;
end $$;
