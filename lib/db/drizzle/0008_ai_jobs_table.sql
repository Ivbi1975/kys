CREATE TABLE IF NOT EXISTS "ai_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_donations" integer DEFAULT 0 NOT NULL,
	"processed_donations" integer DEFAULT 0 NOT NULL,
	"result" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
