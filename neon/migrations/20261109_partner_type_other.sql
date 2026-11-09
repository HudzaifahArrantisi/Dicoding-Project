-- Apply before deploying manual partner type input.
alter table partners add column if not exists type_other text;
