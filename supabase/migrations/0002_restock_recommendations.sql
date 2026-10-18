create table if not exists restock_recommendations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id),
  product_id uuid not null references products(id),
  forecast_qty integer not null,
  suggested_qty integer not null,
  days_of_cover numeric(5,1),
  model_version text not null,
  generated_at timestamptz not null default now()
);
create index if not exists restock_rec_partner_idx on restock_recommendations (partner_id, generated_at desc);

alter table restock_recommendations enable row level security;

create policy rec_select_admin on restock_recommendations for select to authenticated
  using (auth_role() = 'admin');
