-- Allow the dedicated GitHub Actions role to read and update analysis runs,
-- store per-run artifacts, and read source files uploaded by Admin.
grant select, update on public.analysis_runs to ai_job;
grant select, insert, update, delete on public.analysis_run_artifacts to ai_job;
grant select on public.raw_references to ai_job;
