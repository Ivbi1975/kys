CREATE TABLE "conflicts_log" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"donation_id" text,
	"donation_name" text DEFAULT '' NOT NULL,
	"vekalet" text DEFAULT '' NOT NULL,
	"source_kesim_alani_id" text,
	"source_kesim_alani_name" text DEFAULT '' NOT NULL,
	"target_kesim_alani_id" text,
	"target_kesim_alani_name" text DEFAULT '' NOT NULL,
	"conflict_type" text DEFAULT 'vekalet_duplicate' NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolution" text,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conflicts_log" ADD CONSTRAINT "conflicts_log_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX "idx_conflicts_log_project_id" ON "conflicts_log" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "idx_conflicts_log_detected_at" ON "conflicts_log" USING btree ("detected_at");
--> statement-breakpoint
CREATE INDEX "idx_conflicts_log_donation_id" ON "conflicts_log" USING btree ("donation_id");
