CREATE TABLE "tag_categories" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "idx_tag_categories_sort" ON "tag_categories" ("sort_order");

ALTER TABLE "custom_tags" ADD COLUMN "category_id" text;
ALTER TABLE "custom_tags" ADD CONSTRAINT "custom_tags_category_id_tag_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "tag_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
CREATE INDEX "idx_custom_tags_category_id" ON "custom_tags" ("category_id");
