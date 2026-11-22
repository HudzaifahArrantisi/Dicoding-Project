create table if not exists worker_model_artifacts (
  name text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  constraint worker_model_name check (name = 'daisuki')
);
