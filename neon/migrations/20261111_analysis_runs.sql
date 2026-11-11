ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'data_science';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ai_engineer';

ALTER TABLE users DROP CONSTRAINT IF EXISTS mitra_user_needs_partner;
ALTER TABLE users ADD CONSTRAINT mitra_user_needs_partner
  CHECK (role <> 'mitra' OR partner_id IS NOT NULL);
ALTER TABLE users ADD CONSTRAINT team_user_has_no_partner
  CHECK (role = 'mitra' OR partner_id IS NULL);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id uuid PRIMARY KEY,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('creating', 'draft', 'approved', 'rejected', 'processing', 'failed', 'published')),
  manifest jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  processed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  published_at timestamptz,
  error text,
  current_step text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  CONSTRAINT analysis_run_dates CHECK (start_date <= end_date)
);
CREATE UNIQUE INDEX IF NOT EXISTS analysis_runs_one_active_idx ON analysis_runs (is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS analysis_runs_created_idx ON analysis_runs (created_at DESC);
