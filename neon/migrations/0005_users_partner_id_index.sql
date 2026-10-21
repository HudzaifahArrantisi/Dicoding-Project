-- Migration: 0005_users_partner_id_index.sql
-- Memastikan index pada users(partner_id) untuk optimasi LEFT JOIN LATERAL

CREATE INDEX IF NOT EXISTS users_partner_idx ON users (partner_id);
