CREATE TABLE "ai_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_donations" integer DEFAULT 0 NOT NULL,
	"processed_donations" integer DEFAULT 0 NOT NULL,
	"result" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "animal_group_photos" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "animal_groups" ALTER COLUMN "kesildi_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "donation_transfers" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "donations" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kesim_alanlari" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kesim_alanlari" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_logs" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tracking_notes" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "animal_group_donations" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "animal_group_photos" ADD COLUMN "thumbnail" text;--> statement-breakpoint
ALTER TABLE "animal_group_photos" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "animal_groups" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "animal_groups" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_tags" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "donation_tags" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "donation_transfers" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "kesim_alanlari" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tracking_notes" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tracking_notes" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_agd_group_sort" ON "animal_group_donations" USING btree ("group_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_ag_ka_sort" ON "animal_groups" USING btree ("kesim_alani_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_ag_ka_animal_no" ON "animal_groups" USING btree ("kesim_alani_id","animal_no");--> statement-breakpoint
CREATE INDEX "idx_ag_team_id" ON "animal_groups" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_custom_tags_name" ON "custom_tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_donation_transfers_donation_id" ON "donation_transfers" USING btree ("donation_id");--> statement-breakpoint
CREATE INDEX "idx_donation_transfers_from_ka" ON "donation_transfers" USING btree ("from_kesim_alani_id");--> statement-breakpoint
CREATE INDEX "idx_donation_transfers_to_ka" ON "donation_transfers" USING btree ("to_kesim_alani_id");--> statement-breakpoint
CREATE INDEX "idx_donations_ka_deleted_sort" ON "donations" USING btree ("kesim_alani_id","deleted_at","sort_order");--> statement-breakpoint
CREATE INDEX "idx_donations_active_ka_sort" ON "donations" USING btree ("kesim_alani_id","sort_order") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_ka_project_deleted" ON "kesim_alanlari" USING btree ("project_id","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_ka_deleted_created" ON "kesim_alanlari" USING btree ("deleted_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_ka_active_created" ON "kesim_alanlari" USING btree ("created_at") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_ka_active_project" ON "kesim_alanlari" USING btree ("project_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_projects_deleted_created" ON "projects" USING btree ("deleted_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_projects_active_created" ON "projects" USING btree ("created_at") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_projects_active_not_archived" ON "projects" USING btree ("created_at") WHERE deleted_at IS NULL AND archived_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_projects_archived" ON "projects" USING btree ("archived_at") WHERE archived_at IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_tracking_notes_ag_active" ON "tracking_notes" USING btree ("animal_group_id","created_at") WHERE deleted_at IS NULL;