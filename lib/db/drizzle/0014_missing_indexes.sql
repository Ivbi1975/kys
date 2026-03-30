CREATE INDEX IF NOT EXISTS "idx_ag_team_id" ON "animal_groups" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_donation_transfers_donation_id" ON "donation_transfers" USING btree ("donation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_donation_transfers_from_ka" ON "donation_transfers" USING btree ("from_kesim_alani_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_donation_transfers_to_ka" ON "donation_transfers" USING btree ("to_kesim_alani_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tracking_notes_ag_active" ON "tracking_notes" USING btree ("animal_group_id", "deleted_at");
