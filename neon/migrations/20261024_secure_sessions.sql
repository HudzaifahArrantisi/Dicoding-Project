create table if not exists auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  csrf_token text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists auth_sessions_user_idx on auth_sessions (user_id);
create index if not exists auth_sessions_expires_idx on auth_sessions (expires_at);

create table if not exists audit_logs (
  id bigserial primary key,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_target_idx on audit_logs (target_type, target_id, created_at desc);

revoke all on users, auth_sessions, audit_logs from ds_readonly, ai_job;
