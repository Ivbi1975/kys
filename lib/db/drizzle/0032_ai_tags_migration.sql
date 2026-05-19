-- Migrate existing ai_categories free-text data to relational custom_tags / donation_tags.
-- Creates an "AI" tag category and inserts one custom_tag per distinct AI category value.

-- 1. Ensure the "AI" tag category exists with a fixed well-known ID
INSERT INTO tag_categories (id, name, sort_order, updated_at)
VALUES ('__ai_category__', 'AI', 999, now())
ON CONFLICT (id) DO NOTHING;

-- 2. Create a custom_tag row for every distinct category string found across all
--    donations.ai_categories JSON arrays (deterministic ID = '__ai_tag__' + MD5(name)).
--    The regex guard `~ '^\s*\[.*\]\s*$'` prevents malformed non-array text from
--    failing the ::jsonb cast before we can reach the ELSE branch.
INSERT INTO custom_tags (id, name, color, ai_notes, category_id, updated_at)
SELECT
  '__ai_tag__' || MD5(cat_name),
  cat_name,
  '#8b5cf6',
  'AI tarafından oluşturuldu',
  '__ai_category__',
  now()
FROM (
  SELECT DISTINCT trim(elem) AS cat_name
  FROM donations,
       jsonb_array_elements_text(
         CASE
           WHEN ai_categories IS NOT NULL
             AND ai_categories NOT IN ('', '[]', 'null')
             AND ai_categories ~ '^\s*\[.*\]\s*$'
           THEN ai_categories::jsonb
           ELSE '[]'::jsonb
         END
       ) AS elem
  WHERE ai_categories IS NOT NULL
    AND ai_categories NOT IN ('', '[]', 'null')
    AND ai_categories ~ '^\s*\[.*\]\s*$'
    AND deleted_at IS NULL
    AND trim(elem) != ''
) AS distinct_cats
ON CONFLICT (id) DO NOTHING;

-- 3. Insert donation_tags linking each donation to its AI category tags
INSERT INTO donation_tags (donation_id, tag_id, updated_at)
SELECT
  d.id,
  '__ai_tag__' || MD5(trim(cat_elem)),
  now()
FROM donations d,
     jsonb_array_elements_text(
       CASE
         WHEN d.ai_categories IS NOT NULL
           AND d.ai_categories NOT IN ('', '[]', 'null')
           AND d.ai_categories ~ '^\s*\[.*\]\s*$'
         THEN d.ai_categories::jsonb
         ELSE '[]'::jsonb
       END
     ) AS cat_elem
WHERE d.ai_categories IS NOT NULL
  AND d.ai_categories NOT IN ('', '[]', 'null')
  AND d.ai_categories ~ '^\s*\[.*\]\s*$'
  AND d.deleted_at IS NULL
  AND trim(cat_elem) != ''
  AND EXISTS (
    SELECT 1 FROM custom_tags ct
    WHERE ct.id = '__ai_tag__' || MD5(trim(cat_elem))
  )
ON CONFLICT ON CONSTRAINT uq_dt_donation_tag DO NOTHING;
