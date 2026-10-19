-- Menyamakan skema autentikasi MVP dengan Neon dan API Elysia.
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role user_role not null,
  partner_id uuid references partners(id),
  full_name text not null,
  created_at timestamptz not null default now(),
  constraint mitra_user_needs_partner
    check (role = 'admin' or partner_id is not null)
);

do $$
declare
  fk record;
begin
  for fk in
    select tc.table_name, tc.constraint_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
     and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and ccu.table_name = 'profiles'
      and tc.table_name in ('partner_stocks', 'stock_logs', 'orders', 'notifications')
      and kcu.column_name in ('updated_by', 'created_by', 'approved_by', 'user_id')
  loop
    execute format('alter table %I drop constraint %I', fk.table_name, fk.constraint_name);
    execute format(
      'alter table %I add constraint %I foreign key (%I) references users(id)',
      fk.table_name,
      fk.constraint_name,
      fk.column_name
    );
  end loop;
end $$;

create index if not exists users_partner_idx on users (partner_id);
