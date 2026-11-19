-- Mitra yang sebelumnya ditandai beli putus kembali memakai titip jual.
-- Riwayat pesanan dan nilai lama dipertahankan untuk audit, tetapi pesanan baru selalu konsinyasi di API.
UPDATE partners SET distribution_scheme = 'konsinyasi'
WHERE distribution_scheme <> 'konsinyasi';

DO $$ BEGIN
  ALTER TABLE partners ADD CONSTRAINT partners_consignment_only
    CHECK (distribution_scheme = 'konsinyasi');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
