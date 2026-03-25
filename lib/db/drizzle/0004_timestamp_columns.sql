-- Convert text timestamp columns to proper timestamptz type
-- This migration converts all date/time columns from text to timestamptz

-- projects table
ALTER TABLE "projects" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at"::timestamptz;
ALTER TABLE "projects" ALTER COLUMN "deleted_at" TYPE timestamptz USING "deleted_at"::timestamptz;

-- kesim_alanlari table
ALTER TABLE "kesim_alanlari" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at"::timestamptz;
ALTER TABLE "kesim_alanlari" ALTER COLUMN "deleted_at" TYPE timestamptz USING "deleted_at"::timestamptz;

-- donations table
ALTER TABLE "donations" ALTER COLUMN "deleted_at" TYPE timestamptz USING "deleted_at"::timestamptz;

-- animal_groups table
ALTER TABLE "animal_groups" ALTER COLUMN "kesildi_at" TYPE timestamptz USING "kesildi_at"::timestamptz;

-- animal_group_photos table
ALTER TABLE "animal_group_photos" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at"::timestamptz;

-- tracking_notes table
ALTER TABLE "tracking_notes" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at"::timestamptz;

-- notification_logs table
ALTER TABLE "notification_logs" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at"::timestamptz;

-- donation_transfers table
ALTER TABLE "donation_transfers" ALTER COLUMN "created_at" TYPE timestamptz USING "created_at"::timestamptz;
