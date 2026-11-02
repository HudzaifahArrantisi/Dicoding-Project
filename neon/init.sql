-- ============================================================================
-- DAISUKI B2B INVENTORY & ORDER MANAGEMENT SYSTEM
-- Unified Database Initialization & Schema (Single Source of Truth)
-- Kompatibel: PostgreSQL / Neon DB
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
    create type partner_type as enum ('hotel', 'restoran', 'kafe', 'minimarket', 'lainnya');
  else
    alter type partner_type add value if not exists 'lainnya';
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
  province_code text,
  province_name text,
  regency_code text,
  regency_name text,
  district_code text,
  district_name text,
  village_code text,
  village_name text,
  profile_photo text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Kolom tambahan jika tabel sudah ada sebelumnya
alter table partners add column if not exists province_code text;
alter table partners add column if not exists province_name text;
alter table partners add column if not exists regency_code text;
alter table partners add column if not exists regency_name text;
alter table partners add column if not exists district_code text;
alter table partners add column if not exists district_name text;
alter table partners add column if not exists village_code text;
alter table partners add column if not exists village_name text;
alter table partners add column if not exists profile_photo text;

-- Index optimasi pencarian & filter mitra
create index if not exists partners_active_name_idx on partners (is_active, name);
create index if not exists partners_type_idx on partners (type);

-- B. Pengguna Sistem (Users - Neon DB / Elysia Auth)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  username text unique,
  password_hash text not null,
  role user_role not null,
  partner_id uuid references partners(id) on delete set null,
  full_name text not null,
  created_at timestamptz not null default now(),
  constraint mitra_user_needs_partner check (role = 'admin' or partner_id is not null)
);

-- Kolom & index username jika tabel sudah ada sebelumnya
alter table users add column if not exists username text;
create unique index if not exists users_username_unique on users (username);
create index if not exists users_partner_idx on users (partner_id);

create table if not exists auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  csrf_token text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists auth_sessions_user_idx on auth_sessions (user_id);
create index if not exists auth_sessions_expires_idx on auth_sessions (expires_at);

create table if not exists audit_logs (
  id bigserial primary key,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_target_idx on audit_logs (target_type, target_id, created_at desc);

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
  primary key (partner_id, product_id)
);
alter table partner_stocks drop constraint if exists qty_within_par;

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
  completed_at timestamptz,
  receipt_photo_data_url text,
  receipt_proof_requested_at timestamptz,
  delivery_code varchar(32),
  delivery_qr_token text,
  delivery_code_claimed_at timestamptz,
  cycle_period varchar(20) not null default 'weekly'
);
alter table orders add column if not exists receipt_photo_data_url text;
alter table orders add column if not exists receipt_proof_requested_at timestamptz;
alter table orders add column if not exists delivery_code varchar(32);
alter table orders add column if not exists delivery_qr_token text;
alter table orders add column if not exists delivery_code_claimed_at timestamptz;
alter table orders add column if not exists cycle_period varchar(20) not null default 'weekly';
create unique index if not exists idx_orders_delivery_code on orders (delivery_code);
create unique index if not exists idx_orders_qr_token on orders (delivery_qr_token);
create index if not exists orders_partner_created_idx on orders (partner_id, created_at desc);
create index if not exists orders_status_idx on orders (status);

-- G. Rincian Item Pesanan (Order Items)
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  qty_requested integer not null check (qty_requested > 0),
  qty_approved integer check (qty_approved >= 0),
  qty_reserved integer not null default 0 check (qty_reserved >= 0)
);
alter table order_items add column if not exists qty_reserved integer not null default 0;
create index if not exists order_items_order_idx on order_items (order_id);

-- H. Notifikasi & Alert (Notifications)
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('admin', 'mitra')),
  type text not null check (type in (
    'low_stock', 'stale_update', 'new_order', 'order_update', 'order_received',
    'receipt_missing_proof', 'receipt_proof_requested', 'receipt_proof_uploaded'
  )),
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
  metadata jsonb,
  generated_at timestamptz not null default now(),
  constraint restock_recommendations_partner_product_key unique (partner_id, product_id)
);
create index if not exists restock_rec_partner_idx
  on restock_recommendations (partner_id, generated_at desc);
alter table restock_recommendations add column if not exists metadata jsonb;

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
grant select on partners, products, partner_stocks, stock_logs, orders, order_items, restock_recommendations to ds_readonly;
revoke all on users, auth_sessions, audit_logs from ds_readonly, ai_job;
grant select, insert on notifications, stock_logs to ai_job;
grant select, update on partner_stocks to ai_job;
grant select on partners, products, partner_stocks, stock_logs, orders, order_items to ai_job;
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

-- 6. SEED DATA AWAL (DEMO & DEVELOPMENT)

-- A. Cabang Mitra Demo (Partners)
insert into partners (id, name, type, address, pic_name, pic_phone, is_active) values
  ('11111111-1111-1111-1111-111111111111', 'Kafe Sejuk BSD', 'kafe', 'BSD, Tangerang Selatan', 'Rina', '081200000001', true),
  ('22222222-2222-2222-2222-222222222222', 'Hotel Aruna Jakarta', 'hotel', 'Jakarta Selatan', 'Budi', '081200000002', true),
  ('33333333-3333-3333-3333-333333333333', 'Resto Bento Serpong', 'restoran', 'Serpong, Tangerang', 'Siti', '081200000003', true)
on conflict (id) do nothing;

-- B. Akun Pengguna Demo (Users: password default adalah "password123")
-- Menggunakan crypt pgcrypto untuk menghasilkan hash bcrypt resmi 'password123'
insert into users (id, email, username, password_hash, role, partner_id, full_name) values
  ('00000000-0000-0000-0000-000000000001', 'admin@daisuki.test', 'admin', crypt('password123', gen_salt('bf', 10)), 'admin', null, 'Admin Daisuki Pusat'),
  ('00000000-0000-0000-0000-000000000002', 'mitra1@daisuki.test', 'mitra1', crypt('password123', gen_salt('bf', 10)), 'mitra', '11111111-1111-1111-1111-111111111111', 'Rina (Kafe Sejuk)'),
  ('00000000-0000-0000-0000-000000000003', 'mitra2@daisuki.test', 'mitra2', crypt('password123', gen_salt('bf', 10)), 'mitra', '22222222-2222-2222-2222-222222222222', 'Budi (Hotel Aruna)')
on conflict (email) do update set
  username = excluded.username,
  password_hash = excluded.password_hash,
  full_name = excluded.full_name;

-- C. 4 Produk Resmi Daisuki
insert into products (id, sku, name, unit, b2b_price, central_stock, is_active) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'DSK-SB-001', 'Seblak Jadul Instan', 'pcs', 12000.00, 1000, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'DSK-BR-002', 'Basreng Daun Jeruk', 'pcs', 10000.00, 1000, true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'DSK-MK-003', 'Makaroni Daun Jeruk', 'pcs', 8500.00, 1000, true),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'DSK-KP-004', 'Keripik Pisang Rasa Coklat', 'pcs', 15000.00, 1000, true)
on conflict (sku) do update set
  name = excluded.name,
  unit = excluded.unit,
  b2b_price = excluded.b2b_price,
  central_stock = excluded.central_stock,
  is_active = true;

-- D. Matriks Stok Awal Cabang (Setiap Cabang x 4 Produk)
insert into partner_stocks (partner_id, product_id, current_qty, par_level)
select
  p.id as partner_id,
  pr.id as product_id,
  case
    when pr.sku = 'DSK-SB-001' then 30
    when pr.sku = 'DSK-BR-002' then 20
    when pr.sku = 'DSK-MK-003' then 15
    else 25
  end as current_qty,
  case p.type
    when 'hotel' then 100
    when 'restoran' then 80
    when 'kafe' then 60
    when 'minimarket' then 120
    else 60
  end as par_level
from partners p
cross join products pr
where pr.is_active = true
on conflict (partner_id, product_id) do nothing;
