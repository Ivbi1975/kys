-- Add vekaletId, notes, aiNotes fields to custom_tags table
ALTER TABLE "custom_tags" ADD COLUMN IF NOT EXISTS "vekalet_id" text;
ALTER TABLE "custom_tags" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "custom_tags" ADD COLUMN IF NOT EXISTS "ai_notes" text;
