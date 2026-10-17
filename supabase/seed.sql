-- Jalankan manual di Supabase SQL Editor SETELAH 0001_init.sql
-- dan SETELAH 3 user dibuat di Authentication > Users.
-- Ganti UUID_ADMIN, UUID_MITRA1, UUID_MITRA2 dengan UUID user asli.

insert into partners (id, name, type, address, pic_name, pic_phone) values
  ('11111111-1111-1111-1111-111111111111', 'Kafe Sejuk BSD', 'kafe', 'BSD, Tangerang Selatan', 'Rina', '081200000001'),
  ('22222222-2222-2222-2222-222222222222', 'Hotel Aruna', 'hotel', 'Jakarta Selatan', 'Budi', '081200000002');

insert into products (sku, name, unit, b2b_price) values
  ('DSK-KS-001', 'Keripik Singkong Original', 'pcs', 8000),
  ('DSK-BR-002', 'Basreng Pedas', 'pcs', 9500),
  ('DSK-KP-003', 'Keripik Pisang Coklat', 'pcs', 8500),
  ('DSK-MK-004', 'Makaroni Bantet', 'pcs', 7500),
  ('DSK-SB-005', 'Seblak Kering', 'pcs', 9000);

insert into profiles (id, role, partner_id, full_name) values
  ('UUID_ADMIN',  'admin', null, 'Admin Daisuki'),
  ('UUID_MITRA1', 'mitra', '11111111-1111-1111-1111-111111111111', 'Rina'),
  ('UUID_MITRA2', 'mitra', '22222222-2222-2222-2222-222222222222', 'Budi');

-- par level 40 hanyalah angka contoh; nilai asli harus dikonfirmasi ke klien
insert into partner_stocks (partner_id, product_id, current_qty, par_level)
select p.id, pr.id, 30, 40 from partners p cross join products pr;
