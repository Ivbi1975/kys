ALTER TABLE "donation_transfers" ADD COLUMN IF NOT EXISTS "transfer_type" text DEFAULT 'donation' NOT NULL;--> statement-breakpoint
ALTER TABLE "donation_transfers" ADD COLUMN IF NOT EXISTS "animal_group_id" text;--> statement-breakpoint
ALTER TABLE "donation_transfers" ADD COLUMN IF NOT EXISTS "animal_no" integer;
