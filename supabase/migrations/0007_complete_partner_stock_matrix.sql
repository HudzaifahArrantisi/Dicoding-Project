-- Setiap cabang aktif harus memiliki catatan stok untuk setiap produk aktif.
-- Baris yang sudah ada dipertahankan; hanya pasangan cabang-produk yang hilang
-- yang dibuat dengan stok awal 0.
with partner_defaults as (
  select
    p.id as partner_id,
    coalesce(max(ps.par_level), 40)::integer as par_level
  from partners p
  left join partner_stocks ps on ps.partner_id = p.id
  where p.is_active = true
  group by p.id
)
insert into partner_stocks (
  partner_id,
  product_id,
  current_qty,
  par_level
)
select
  pd.partner_id,
  pr.id,
  0,
  pd.par_level
from partner_defaults pd
cross join products pr
where pr.is_active = true
on conflict (partner_id, product_id) do nothing;
