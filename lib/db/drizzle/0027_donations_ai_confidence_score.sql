-- Add AI confidence score column to donations table
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "ai_confidence_score" integer;
