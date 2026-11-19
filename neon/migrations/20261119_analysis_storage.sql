create table if not exists raw_references (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('pdf', 'csv', 'json', 'md', 'txt', 'docx')),
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  sha256 text not null,
  content bytea not null,
  uploaded_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (category, file_name)
);
create index if not exists raw_references_created_idx on raw_references (created_at desc);

create table if not exists analysis_run_artifacts (
  run_id uuid not null references analysis_runs(id) on delete cascade,
  file_name text not null,
  kind text not null check (kind in ('data_science', 'ai')),
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  sha256 text not null,
  content bytea not null,
  payload jsonb,
  created_at timestamptz not null default now(),
  primary key (run_id, file_name)
);
create index if not exists analysis_run_artifacts_kind_idx on analysis_run_artifacts (run_id, kind);
