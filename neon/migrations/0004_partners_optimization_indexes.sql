-- Migration: 0004_partners_optimization_indexes.sql
-- Optimasi query manajemen mitra: Index untuk pencarian dan filter aktif/tipe

CREATE INDEX IF NOT EXISTS partners_active_name_idx ON partners (is_active, name);
CREATE INDEX IF NOT EXISTS partners_type_idx ON partners (type);
