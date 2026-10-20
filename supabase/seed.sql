-- ============================================================================
-- DAISUKI B2B INVENTORY & ORDER MANAGEMENT SYSTEM
-- Seed Data Awal (Demo & Development)
-- ============================================================================

-- 1. Cabang Mitra (Partners)
insert into partners (id, name, type, address, pic_name, pic_phone, is_active) values
  ('11111111-1111-1111-1111-111111111111', 'Kafe Sejuk BSD', 'kafe', 'BSD, Tangerang Selatan', 'Rina', '081200000001', true),
  ('22222222-2222-2222-2222-222222222222', 'Hotel Aruna Jakarta', 'hotel', 'Jakarta Selatan', 'Budi', '081200000002', true),
  ('33333333-3333-3333-3333-333333333333', 'Resto Bento Serpong', 'restoran', 'Serpong, Tangerang', 'Siti', '081200000003', true)
on conflict (id) do nothing;

-- 2. Akun Pengguna Demo (Users: password default adalah "password123")
-- Hash di bawah adalah bcrypt untuk "password123"
insert into users (id, email, password_hash, role, partner_id, full_name) values
  ('00000000-0000-0000-0000-000000000001', 'admin@daisuki.test', '$2a$10$wB5TqU0oZ3/6M5r9z6N8x.0L7zT9gT1rQ8bQ2yW7uD4vK5pY6eL6m', 'admin', null, 'Admin Daisuki Pusat'),
  ('00000000-0000-0000-0000-000000000002', 'mitra1@daisuki.test', '$2a$10$wB5TqU0oZ3/6M5r9z6N8x.0L7zT9gT1rQ8bQ2yW7uD4vK5pY6eL6m', 'mitra', '11111111-1111-1111-1111-111111111111', 'Rina (Kafe Sejuk)'),
  ('00000000-0000-0000-0000-000000000003', 'mitra2@daisuki.test', '$2a$10$wB5TqU0oZ3/6M5r9z6N8x.0L7zT9gT1rQ8bQ2yW7uD4vK5pY6eL6m', 'mitra', '22222222-2222-2222-2222-222222222222', 'Budi (Hotel Aruna)')
on conflict (email) do nothing;

-- 3. 4 Produk Resmi Daisuki
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

-- 4. Matriks Stok Awal Cabang (Setiap Cabang x 4 Produk)
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
  40 as par_level
from partners p
cross join products pr
where pr.is_active = true
on conflict (partner_id, product_id) do nothing;
