-- Add updated_at to all remaining tables, tombstone columns, and cascade triggers

ALTER TABLE custom_tags ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE donation_tags ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE animal_group_photos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE donation_transfers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE animal_groups ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tracking_notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DROP TRIGGER IF EXISTS update_custom_tags_updated_at ON custom_tags;
CREATE TRIGGER update_custom_tags_updated_at BEFORE UPDATE ON custom_tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_donation_tags_updated_at ON donation_tags;
CREATE TRIGGER update_donation_tags_updated_at BEFORE UPDATE ON donation_tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_animal_group_photos_updated_at ON animal_group_photos;
CREATE TRIGGER update_animal_group_photos_updated_at BEFORE UPDATE ON animal_group_photos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_logs_updated_at ON notification_logs;
CREATE TRIGGER update_notification_logs_updated_at BEFORE UPDATE ON notification_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_donation_transfers_updated_at ON donation_transfers;
CREATE TRIGGER update_donation_transfers_updated_at BEFORE UPDATE ON donation_transfers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION cascade_agd_to_animal_group()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE animal_groups SET updated_at = now() WHERE id = COALESCE(NEW.group_id, OLD.group_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS cascade_agd_updated_at ON animal_group_donations;
CREATE TRIGGER cascade_agd_updated_at AFTER INSERT OR UPDATE OR DELETE ON animal_group_donations FOR EACH ROW EXECUTE FUNCTION cascade_agd_to_animal_group();

CREATE OR REPLACE FUNCTION cascade_donation_to_animal_group()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE animal_groups SET updated_at = now()
    WHERE id IN (SELECT group_id FROM animal_group_donations WHERE donation_id = COALESCE(NEW.id, OLD.id));
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS cascade_donation_updated_at ON donations;
CREATE TRIGGER cascade_donation_updated_at AFTER UPDATE ON donations FOR EACH ROW EXECUTE FUNCTION cascade_donation_to_animal_group();

CREATE INDEX IF NOT EXISTS idx_animal_groups_deleted_at ON animal_groups(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracking_notes_deleted_at ON tracking_notes(deleted_at) WHERE deleted_at IS NOT NULL;
