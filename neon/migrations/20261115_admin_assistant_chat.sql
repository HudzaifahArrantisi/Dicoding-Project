-- Migration: 20261115_admin_assistant_chat.sql
-- Allow Admin (who does not belong to a partner branch) to use Assistant Chat

alter table assistant_chat_events alter column partner_id drop not null;

alter table assistant_conversation_memory drop constraint if exists assistant_conversation_memory_pkey;
alter table assistant_conversation_memory alter column partner_id drop not null;
alter table assistant_conversation_memory add primary key (user_id, session_id);
