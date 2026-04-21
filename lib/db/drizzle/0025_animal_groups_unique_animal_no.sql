-- Enforce uniqueness of animal_no within a kesim_alani for active (non-deleted) groups.
-- A partial unique index lets us avoid conflicts with soft-deleted rows.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_ag_ka_animal_no_active"
  ON "animal_groups" ("kesim_alani_id", "animal_no")
  WHERE "deleted_at" IS NULL;
