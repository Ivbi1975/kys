ALTER TABLE "projects" ADD COLUMN "archived_at" timestamp with time zone;
CREATE INDEX "idx_projects_active_not_archived" ON "projects" ("created_at") WHERE deleted_at IS NULL AND archived_at IS NULL;
CREATE INDEX "idx_projects_archived" ON "projects" ("archived_at") WHERE archived_at IS NOT NULL;
