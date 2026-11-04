create table if not exists assistant_chat_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  message text not null check (length(message) between 1 and 500),
  reply text not null,
  intent text,
  model_label text,
  model_confidence numeric(5, 4),
  model_results jsonb,
  feedback integer check (feedback in (-1, 1)),
  created_at timestamptz not null default now()
);
create index if not exists assistant_chat_partner_user_created_idx
  on assistant_chat_events (partner_id, user_id, created_at desc);
alter table assistant_chat_events enable row level security;
