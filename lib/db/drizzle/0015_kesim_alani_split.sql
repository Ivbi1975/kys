ALTER TABLE "kesim_alanlari" ADD COLUMN "parent_kesim_alani_id" text;--> statement-breakpoint
ALTER TABLE "kesim_alanlari" ADD COLUMN "split_status" text;--> statement-breakpoint
CREATE INDEX "idx_ka_parent" ON "kesim_alanlari" USING btree ("parent_kesim_alani_id");--> statement-breakpoint
ALTER TABLE "kesim_alanlari" ADD CONSTRAINT "kesim_alanlari_parent_kesim_alani_id_fkey" FOREIGN KEY ("parent_kesim_alani_id") REFERENCES "kesim_alanlari"("id") ON DELETE SET NULL;
