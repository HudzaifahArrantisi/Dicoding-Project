create table if not exists uploaded_files (
  path text primary key,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 700000),
  content bytea not null,
  created_at timestamptz not null default now(),
  constraint uploaded_files_path check (path ~ '^/uploads/(receipts|profiles)/[A-Za-z0-9_-]+[.](jpg|png|webp)$')
);
