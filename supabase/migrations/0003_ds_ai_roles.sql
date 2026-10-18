-- Jalankan manual di Supabase SQL Editor SETELAH 0001 dan 0002. Ganti GANTI_PASSWORD sebelum menjalankan.

create role ds_readonly login password 'GANTI_PASSWORD';
create role ai_job login password 'GANTI_PASSWORD';

grant usage on schema public to ds_readonly, ai_job;
grant select on partners, products, partner_stocks, stock_logs, orders, order_items, restock_recommendations to ds_readonly, ai_job;
grant insert on restock_recommendations to ai_job;

do $$
declare t text;
begin
  foreach t in array array['partners','products','partner_stocks','stock_logs','orders','order_items','restock_recommendations'] loop
    execute format('create policy ds_read on %I for select to ds_readonly using (true)', t);
    execute format('create policy ai_read on %I for select to ai_job using (true)', t);
  end loop;
end $$;

create policy ai_insert_rec on restock_recommendations for insert to ai_job with check (true);
