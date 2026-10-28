begin;

alter table partner_stocks drop constraint if exists qty_within_par;
alter table orders add column if not exists delivery_code varchar(32);
alter table orders add column if not exists delivery_qr_token text;
alter table orders add column if not exists delivery_code_claimed_at timestamptz;
alter table orders add column if not exists cycle_period varchar(20) not null default 'weekly';
create unique index if not exists idx_orders_delivery_code on orders (delivery_code);
create unique index if not exists idx_orders_qr_token on orders (delivery_qr_token);
update orders
set delivery_code = 'DSK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
    delivery_qr_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where status = 'dalam_pengiriman' and delivery_code is null;
alter table restock_recommendations add column if not exists metadata jsonb;
with ranked as (
  select id, row_number() over (partition by partner_id, product_id order by generated_at desc, id desc) as position
  from restock_recommendations
)
delete from restock_recommendations r using ranked
where r.id = ranked.id and ranked.position > 1;
create unique index if not exists restock_recommendations_partner_product_key
  on restock_recommendations (partner_id, product_id);
grant select on partner_stocks, stock_logs to ai_job;


create table if not exists inventory_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
with marker as (
  insert into inventory_migrations(name) values ('20261028_weekly_delivery')
  on conflict do nothing returning name
), reserved as (
  select oi.product_id, sum(oi.qty_approved)::integer as qty
  from order_items oi
  join orders o on o.id = oi.order_id
  cross join marker
  where o.status = 'disetujui'
  group by oi.product_id
)
update products p
set central_stock = p.central_stock + reserved.qty
from reserved
where p.id = reserved.product_id;

commit;
