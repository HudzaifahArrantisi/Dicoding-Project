ALTER TABLE products
ADD COLUMN IF NOT EXISTS central_stock INTEGER NOT NULL DEFAULT 1000;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS admin_note TEXT;

ALTER TABLE products
DROP CONSTRAINT IF EXISTS products_central_stock_nonnegative;

ALTER TABLE products
ADD CONSTRAINT products_central_stock_nonnegative CHECK (central_stock >= 0);
