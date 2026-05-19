import type { CustomTag, TagCategory } from "./types";

export interface TagGroup {
  category: TagCategory | null;
  tags: CustomTag[];
}

export function groupTagsByCategory(tags: CustomTag[], categories: TagCategory[]): TagGroup[] {
  const catMap = new Map<string, TagCategory>(categories.map(c => [c.id, c]));
  const grouped: Record<string, CustomTag[]> = {};
  const uncategorized: CustomTag[] = [];

  for (const tag of tags) {
    if (tag.categoryId && catMap.has(tag.categoryId)) {
      if (!grouped[tag.categoryId]) grouped[tag.categoryId] = [];
      grouped[tag.categoryId].push(tag);
    } else {
      uncategorized.push(tag);
    }
  }

  const result: TagGroup[] = [];

  for (const cat of categories) {
    if (grouped[cat.id] && grouped[cat.id].length > 0) {
      result.push({ category: cat, tags: grouped[cat.id] });
    }
  }

  if (uncategorized.length > 0) {
    result.push({ category: null, tags: uncategorized });
  }

  return result;
}
