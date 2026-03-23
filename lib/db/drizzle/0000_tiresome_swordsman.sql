CREATE TABLE "animal_group_donations" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"donation_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animal_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"kesim_alani_id" text NOT NULL,
	"animal_no" integer DEFAULT 0 NOT NULL,
	"color_tag" text DEFAULT '' NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#3b82f6' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donation_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"donation_id" text NOT NULL,
	"tag_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" text PRIMARY KEY NOT NULL,
	"kesim_alani_id" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"donation_type" text DEFAULT '' NOT NULL,
	"share_count" integer DEFAULT 1 NOT NULL,
	"vekalet" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"excluded" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kesim_alanlari" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "animal_group_donations" ADD CONSTRAINT "animal_group_donations_group_id_animal_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."animal_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_group_donations" ADD CONSTRAINT "animal_group_donations_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_groups" ADD CONSTRAINT "animal_groups_kesim_alani_id_kesim_alanlari_id_fk" FOREIGN KEY ("kesim_alani_id") REFERENCES "public"."kesim_alanlari"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation_tags" ADD CONSTRAINT "donation_tags_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation_tags" ADD CONSTRAINT "donation_tags_tag_id_custom_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."custom_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_kesim_alani_id_kesim_alanlari_id_fk" FOREIGN KEY ("kesim_alani_id") REFERENCES "public"."kesim_alanlari"("id") ON DELETE cascade ON UPDATE no action;