create extension if not exists "pgcrypto";

create type user_role as enum ('admin', 'mitra');
create type partner_type as enum ('hotel', 'restoran', 'kafe', 'minimarket');
create type order_status as enum
  ('diproses', 'disetujui', 'dalam_pengiriman', 'selesai', 'ditolak', 'dibatalkan');
create type stock_source as enum ('manual_update', 'order_received', 'adjustment');

create table partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type partner_type not null,
  address text,
  pic_name text,
  pic_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  partner_id uuid references partners(id),
  full_name text not null,
  created_at timestamptz not null default now(),
  constraint mitra_needs_partner check (role = 'admin' or partner_id is not null)
);

create table products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  unit text not null default 'pcs',
  b2b_price numeric(12,2) not null check (b2b_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table partner_stocks (
  partner_id uuid not null references partners(id) on delete cascade,
  product_id uuid not null references products(id),
  current_qty integer not null default 0 check (current_qty >= 0),
  par_level integer not null check (par_level > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id),
  primary key (partner_id, product_id),
  constraint qty_within_par check (current_qty <= par_level)
);

create table stock_logs (
  id bigint generated always as identity primary key,
  partner_id uuid not null references partners(id),
  product_id uuid not null references products(id),
  qty_before integer not null,
  qty_after integer not null,
  source stock_source not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on stock_logs (partner_id, product_id, created_at desc);

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  partner_id uuid not null references partners(id),
  status order_status not null default 'diproses',
  note text,
  rejected_reason text,
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  shipped_at timestamptz,
  completed_at timestamptz
);
create index on orders (partner_id, created_at desc);
create index on orders (status);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  qty_requested integer not null check (qty_requested > 0),
  qty_approved integer check (qty_approved >= 0)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('admin', 'mitra')),
  type text not null check (type in ('low_stock', 'stale_update', 'new_order', 'order_update')),
  partner_id uuid references partners(id),
  user_id uuid references profiles(id),
  title text not null,
  body text,
  read_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (audience, read_at, created_at desc);

-- RLS
alter table partner_stocks enable row level security;
alter table notifications enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table stock_logs enable row level security;
alter table profiles enable row level security;
alter table partners enable row level security;
alter table products enable row level security;

create or replace function auth_role() returns user_role
  language sql stable security definer set search_path = public as
  $$ select role from profiles where id = auth.uid() $$;

create or replace function auth_partner() returns uuid
  language sql stable security definer set search_path = public as
  $$ select partner_id from profiles where id = auth.uid() $$;

-- partner_stocks: admin semua, mitra hanya miliknya
create policy stocks_select on partner_stocks for select to authenticated
  using (auth_role() = 'admin' or partner_id = auth_partner());

-- notifications: admin lihat audience admin, mitra lihat miliknya
create policy notif_select on notifications for select to authenticated
  using (
    (audience = 'admin' and auth_role() = 'admin')
    or (audience = 'mitra' and partner_id = auth_partner())
  );

-- orders dan order_items
create policy orders_select on orders for select to authenticated
  using (auth_role() = 'admin' or partner_id = auth_partner());
create policy order_items_select on order_items for select to authenticated
  using (exists (select 1 from orders o where o.id = order_id
         and (auth_role() = 'admin' or o.partner_id = auth_partner())));

-- stock_logs
create policy logs_select on stock_logs for select to authenticated
  using (auth_role() = 'admin' or partner_id = auth_partner());

-- profiles: baca profil sendiri, admin baca semua
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or auth_role() = 'admin');

-- master data: semua pengguna login boleh baca
create policy partners_select on partners for select to authenticated using (true);
create policy products_select on products for select to authenticated using (true);

-- aktifkan Realtime
alter publication supabase_realtime add table partner_stocks, notifications, orders;
