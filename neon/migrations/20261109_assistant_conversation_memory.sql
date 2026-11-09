create table if not exists assistant_conversation_memory (
  partner_id uuid not null references partners(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  summary text not null,
  updated_at timestamptz not null default now(),
  primary key (partner_id, user_id)
);
alter table assistant_conversation_memory enable row level security;
