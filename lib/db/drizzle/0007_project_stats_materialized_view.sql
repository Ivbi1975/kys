-- Materialized view for pre-computed project statistics
-- Replaces N+1 queries in GET /projects with a single view read

CREATE MATERIALIZED VIEW IF NOT EXISTS project_stats_view AS
SELECT
  p.id AS project_id,
  COALESCE(donor_stats.donor_count, 0)::int AS donor_count,
  COALESCE(donor_stats.share_count, 0)::int AS share_count,
  COALESCE(group_stats.group_count, 0)::int AS group_count,
  COALESCE(group_stats.kesildi_count, 0)::int AS kesildi_count,
  group_stats.last_kesildi_at
FROM projects p
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int AS donor_count,
    COALESCE(SUM(d.share_count), 0)::int AS share_count
  FROM donations d
  INNER JOIN kesim_alanlari ka ON ka.id = d.kesim_alani_id
  WHERE ka.project_id = p.id
    AND ka.deleted_at IS NULL
    AND d.deleted_at IS NULL
    AND d.excluded = false
) donor_stats ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::int AS group_count,
    COUNT(*) FILTER (WHERE ag.kesildi = true)::int AS kesildi_count,
    MAX(ag.kesildi_at) AS last_kesildi_at
  FROM animal_groups ag
  INNER JOIN kesim_alanlari ka ON ka.id = ag.kesim_alani_id
  WHERE ka.project_id = p.id
    AND ka.deleted_at IS NULL
) group_stats ON true
WHERE p.deleted_at IS NULL;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_stats_view_pid
  ON project_stats_view (project_id);
