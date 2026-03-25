ALTER TABLE animal_groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE donations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE kesim_alanlari ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE tracking_notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ag_updated_at ON animal_groups (updated_at);
CREATE INDEX IF NOT EXISTS idx_donations_updated_at ON donations (updated_at);
CREATE INDEX IF NOT EXISTS idx_ka_updated_at ON kesim_alanlari (updated_at);
CREATE INDEX IF NOT EXISTS idx_tracking_notes_updated_at ON tracking_notes (updated_at);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_animal_groups_updated_at ON animal_groups;
CREATE TRIGGER trg_animal_groups_updated_at
  BEFORE UPDATE ON animal_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_donations_updated_at ON donations;
CREATE TRIGGER trg_donations_updated_at
  BEFORE UPDATE ON donations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_kesim_alanlari_updated_at ON kesim_alanlari;
CREATE TRIGGER trg_kesim_alanlari_updated_at
  BEFORE UPDATE ON kesim_alanlari
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_tracking_notes_updated_at ON tracking_notes;
CREATE TRIGGER trg_tracking_notes_updated_at
  BEFORE UPDATE ON tracking_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
