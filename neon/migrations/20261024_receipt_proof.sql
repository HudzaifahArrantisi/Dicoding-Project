-- Apply once to an existing Neon database before deploying receipt proof support.
alter table orders add column if not exists receipt_photo_data_url text;
alter table orders add column if not exists receipt_proof_requested_at timestamptz;

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check check (type in (
  'low_stock', 'stale_update', 'new_order', 'order_update',
  'receipt_missing_proof', 'receipt_proof_requested', 'receipt_proof_uploaded'
));
