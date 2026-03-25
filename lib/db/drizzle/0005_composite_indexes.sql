-- Composite indexes for query performance optimization

-- projects: WHERE deleted_at IS NULL ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_projects_deleted_created ON projects (deleted_at, created_at);

-- kesim_alanlari: WHERE project_id = ? AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_ka_project_deleted ON kesim_alanlari (project_id, deleted_at);

-- kesim_alanlari: WHERE deleted_at IS NULL ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_ka_deleted_created ON kesim_alanlari (deleted_at, created_at);

-- donations: WHERE kesim_alani_id = ? AND deleted_at IS NULL ORDER BY sort_order
CREATE INDEX IF NOT EXISTS idx_donations_ka_deleted_sort ON donations (kesim_alani_id, deleted_at, sort_order);

-- animal_groups: WHERE kesim_alani_id = ? ORDER BY sort_order
CREATE INDEX IF NOT EXISTS idx_ag_ka_sort ON animal_groups (kesim_alani_id, sort_order);

-- animal_groups: WHERE kesim_alani_id = ? lookup by animal_no
CREATE INDEX IF NOT EXISTS idx_ag_ka_animal_no ON animal_groups (kesim_alani_id, animal_no);

-- animal_group_donations: WHERE group_id = ? ORDER BY sort_order
CREATE INDEX IF NOT EXISTS idx_agd_group_sort ON animal_group_donations (group_id, sort_order);
