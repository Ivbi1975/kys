-- Remove the legacy ai_categories text column from donations.
-- AI category data is now stored in the relational donation_tags / custom_tags tables.
ALTER TABLE donations DROP COLUMN IF EXISTS ai_categories;
