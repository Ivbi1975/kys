-- AI job completion logs table
CREATE TABLE IF NOT EXISTS "ai_job_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "job_id" text,
  "kesim_alani_id" text,
  "project_id" text,
  "donation_count" integer DEFAULT 0 NOT NULL,
  "processed_count" integer DEFAULT 0 NOT NULL,
  "warning_count" integer DEFAULT 0 NOT NULL,
  "error_batch_count" integer DEFAULT 0 NOT NULL,
  "total_batches" integer DEFAULT 0 NOT NULL,
  "duration_ms" integer,
  "avg_confidence_score" real,
  "category_distribution" text,
  "status" text DEFAULT 'completed' NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_ai_job_logs_project_id" ON "ai_job_logs" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_ai_job_logs_kesim_alani_id" ON "ai_job_logs" ("kesim_alani_id");
CREATE INDEX IF NOT EXISTS "idx_ai_job_logs_completed_at" ON "ai_job_logs" ("completed_at");
