create table if not exists stock_recalls (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  reason text not null check (length(trim(reason)) >= 10),
  items jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  requested_by uuid references users(id) on delete set null,
  completed_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index if not exists stock_recalls_one_pending_per_partner_idx
  on stock_recalls (partner_id) where status = 'pending';
