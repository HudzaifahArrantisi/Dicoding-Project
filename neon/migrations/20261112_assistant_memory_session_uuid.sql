-- Isolasi ringkasan percakapan berdasarkan UUID sesi.
alter table assistant_conversation_memory add column if not exists session_id uuid;
update assistant_conversation_memory set session_id = gen_random_uuid() where session_id is null;
alter table assistant_conversation_memory alter column session_id set not null;
alter table assistant_conversation_memory drop constraint if exists assistant_conversation_memory_pkey;
alter table assistant_conversation_memory add primary key (partner_id, user_id, session_id);
