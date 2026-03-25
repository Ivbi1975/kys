-- Partial indexes for soft-delete queries (WHERE deleted_at IS NULL)
-- These indexes only include active (non-deleted) rows, reducing index size
-- and improving query performance for the most common access pattern.

-- projects: active projects ordered by created_at
CREATE INDEX IF NOT EXISTS idx_projects_active_created
  ON projects (created_at) WHERE deleted_at IS NULL;

-- kesim_alanlari: active areas ordered by created_at
CREATE INDEX IF NOT EXISTS idx_ka_active_created
  ON kesim_alanlari (created_at) WHERE deleted_at IS NULL;

-- kesim_alanlari: active areas by project
CREATE INDEX IF NOT EXISTS idx_ka_active_project
  ON kesim_alanlari (project_id) WHERE deleted_at IS NULL;

-- donations: active donations per area, sorted
CREATE INDEX IF NOT EXISTS idx_donations_active_ka_sort
  ON donations (kesim_alani_id, sort_order) WHERE deleted_at IS NULL;
