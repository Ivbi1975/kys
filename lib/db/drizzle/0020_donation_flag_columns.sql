ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "is_flagged" boolean DEFAULT false NOT NULL;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "flag_reason" text DEFAULT '' NOT NULL;
