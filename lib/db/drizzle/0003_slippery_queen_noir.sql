CREATE TABLE "animal_group_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"animal_group_id" text NOT NULL,
	"data" text NOT NULL,
	"mime_type" text DEFAULT 'image/jpeg' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donation_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"donation_id" text,
	"donor_name" text DEFAULT '' NOT NULL,
	"donor_description" text DEFAULT '' NOT NULL,
	"from_kesim_alani_id" text,
	"from_kesim_alani_name" text DEFAULT '' NOT NULL,
	"to_kesim_alani_id" text,
	"to_kesim_alani_name" text DEFAULT '' NOT NULL,
	"removed_from_source" boolean DEFAULT true NOT NULL,
	"share_count" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"kesim_alani_id" text NOT NULL,
	"animal_group_id" text,
	"animal_no" integer,
	"donor_name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"channel" text DEFAULT 'browser' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"kesim_alani_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#3b82f6' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"kesim_alani_id" text NOT NULL,
	"animal_group_id" text,
	"type" text DEFAULT 'note' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"field_name" text,
	"old_value" text,
	"new_value" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "animal_groups" ADD COLUMN "kesildi" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "animal_groups" ADD COLUMN "kesildi_at" text;--> statement-breakpoint
ALTER TABLE "animal_groups" ADD COLUMN "team_id" text;--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "phone" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "kesim_alanlari" ADD COLUMN "tracking_token" text;--> statement-breakpoint
ALTER TABLE "kesim_alanlari" ADD COLUMN "kesim_liste_id" text;--> statement-breakpoint
ALTER TABLE "animal_group_photos" ADD CONSTRAINT "animal_group_photos_animal_group_id_animal_groups_id_fk" FOREIGN KEY ("animal_group_id") REFERENCES "public"."animal_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation_transfers" ADD CONSTRAINT "donation_transfers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_kesim_alani_id_kesim_alanlari_id_fk" FOREIGN KEY ("kesim_alani_id") REFERENCES "public"."kesim_alanlari"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_animal_group_id_animal_groups_id_fk" FOREIGN KEY ("animal_group_id") REFERENCES "public"."animal_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_kesim_alani_id_kesim_alanlari_id_fk" FOREIGN KEY ("kesim_alani_id") REFERENCES "public"."kesim_alanlari"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_notes" ADD CONSTRAINT "tracking_notes_kesim_alani_id_kesim_alanlari_id_fk" FOREIGN KEY ("kesim_alani_id") REFERENCES "public"."kesim_alanlari"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_notes" ADD CONSTRAINT "tracking_notes_animal_group_id_animal_groups_id_fk" FOREIGN KEY ("animal_group_id") REFERENCES "public"."animal_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_photos_animal_group_id" ON "animal_group_photos" USING btree ("animal_group_id");--> statement-breakpoint
CREATE INDEX "idx_donation_transfers_project_id" ON "donation_transfers" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_notification_logs_kesim_alani_id" ON "notification_logs" USING btree ("kesim_alani_id");--> statement-breakpoint
CREATE INDEX "idx_notification_logs_animal_group_id" ON "notification_logs" USING btree ("animal_group_id");--> statement-breakpoint
CREATE INDEX "idx_teams_kesim_alani_id" ON "teams" USING btree ("kesim_alani_id");--> statement-breakpoint
CREATE INDEX "idx_tracking_notes_kesim_alani_id" ON "tracking_notes" USING btree ("kesim_alani_id");--> statement-breakpoint
CREATE INDEX "idx_tracking_notes_animal_group_id" ON "tracking_notes" USING btree ("animal_group_id");--> statement-breakpoint
ALTER TABLE "animal_groups" ADD CONSTRAINT "animal_groups_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;