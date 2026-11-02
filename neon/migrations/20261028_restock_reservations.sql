begin;

alter table order_items add column if not exists qty_reserved integer not null default 0;
create table if not exists inventory_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
lock table inventory_migrations in exclusive mode;

do $$
declare
  item record;
  available integer;
begin
  if not exists (select 1 from inventory_migrations where name = '20261028_restock_reservations') then
    for item in
      select oi.product_id, sum(case when o.status = 'diproses' then oi.qty_requested else coalesce(oi.qty_approved, 0) end)::integer as needed
      from order_items oi
      join orders o on o.id = oi.order_id
      where o.status in ('diproses', 'disetujui')
      group by oi.product_id
      order by oi.product_id
    loop
      select central_stock into available from products where id = item.product_id for update;
      if available is null or available < item.needed then
        raise exception 'Stok pusat tidak cukup untuk migrasi reservasi produk %: tersedia %, diperlukan %', item.product_id, available, item.needed;
      end if;
      update products set central_stock = central_stock - item.needed where id = item.product_id;
    end loop;

    update order_items oi
    set qty_reserved = case
      when o.status = 'diproses' then oi.qty_requested
      when o.status in ('disetujui', 'dalam_pengiriman', 'selesai') then coalesce(oi.qty_approved, 0)
      else 0
    end
    from orders o
    where o.id = oi.order_id;

    insert into inventory_migrations(name) values ('20261028_restock_reservations');
  end if;
end $$;

commit;
