-- Enforce share_count to be in [1, 7] at the DB level.
-- Added as NOT VALID first so the migration is safe for existing rows; we
-- then attempt to validate. If validation fails on legacy data, the
-- constraint still protects all new INSERT/UPDATE statements.
ALTER TABLE "donations"
  ADD CONSTRAINT "donations_share_count_range_chk"
  CHECK ("share_count" BETWEEN 1 AND 7) NOT VALID;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "donations" VALIDATE CONSTRAINT "donations_share_count_range_chk";
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'donations_share_count_range_chk left NOT VALID due to existing rows outside [1,7]';
END $$;
