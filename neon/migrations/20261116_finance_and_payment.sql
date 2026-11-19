DO $$ BEGIN
  CREATE TYPE distribution_scheme AS ENUM ('konsinyasi', 'beli_putus');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('belum_lunas', 'lunas', 'jatuh_tempo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE partners ADD COLUMN IF NOT EXISTS distribution_scheme distribution_scheme NOT NULL DEFAULT 'konsinyasi';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS distribution_scheme distribution_scheme NOT NULL DEFAULT 'konsinyasi';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status payment_status;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_due_date timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount numeric(14, 2) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS orders_payment_due_idx ON orders (payment_due_date)
  WHERE payment_status = 'belum_lunas';

UPDATE orders o SET
  total_amount = COALESCE((
    SELECT SUM(COALESCE(oi.qty_approved, 0) * pr.b2b_price)
    FROM order_items oi JOIN products pr ON pr.id = oi.product_id
    WHERE oi.order_id = o.id
  ), 0)
WHERE o.status = 'selesai';
