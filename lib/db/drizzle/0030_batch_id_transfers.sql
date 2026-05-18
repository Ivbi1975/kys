ALTER TABLE "donation_transfers" ADD COLUMN "batch_id" text;
--> statement-breakpoint
CREATE INDEX "idx_donation_transfers_batch_id" ON "donation_transfers" USING btree ("batch_id");
