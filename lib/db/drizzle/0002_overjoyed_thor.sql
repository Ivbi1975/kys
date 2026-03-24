CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "deleted_at" text;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "ai_categories" text;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "ai_warnings" text;--> statement-breakpoint
ALTER TABLE "kesim_alanlari" ADD COLUMN "deleted_at" text;--> statement-breakpoint
ALTER TABLE "kesim_alanlari" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "kesim_alanlari" ADD CONSTRAINT "kesim_alanlari_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agd_group_id" ON "animal_group_donations" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_agd_donation_id" ON "animal_group_donations" USING btree ("donation_id");--> statement-breakpoint
CREATE INDEX "idx_animal_groups_kesim_alani_id" ON "animal_groups" USING btree ("kesim_alani_id");--> statement-breakpoint
CREATE INDEX "idx_dt_donation_id" ON "donation_tags" USING btree ("donation_id");--> statement-breakpoint
CREATE INDEX "idx_dt_tag_id" ON "donation_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_donations_kesim_alani_id" ON "donations" USING btree ("kesim_alani_id");--> statement-breakpoint
ALTER TABLE "animal_group_donations" ADD CONSTRAINT "uq_agd_group_donation" UNIQUE("group_id","donation_id");--> statement-breakpoint
ALTER TABLE "donation_tags" ADD CONSTRAINT "uq_dt_donation_tag" UNIQUE("donation_id","tag_id");