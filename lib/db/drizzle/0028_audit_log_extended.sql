ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "project_id" text,
  ADD COLUMN IF NOT EXISTS "filters" jsonb,
  ADD COLUMN IF NOT EXISTS "target_kesim_alani_id" text,
  ADD COLUMN IF NOT EXISTS "affected_count" integer,
  ADD COLUMN IF NOT EXISTS "metadata" jsonb;

CREATE INDEX IF NOT EXISTS "idx_audit_project_id" ON "audit_logs" ("project_id");
