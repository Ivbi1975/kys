import { db } from "@workspace/db";
import {
  automationRulesTable,
  donationsTable,
  donationTagsTable,
  kesimAlanlariTable,
} from "@workspace/db/schema";
import { eq, and, isNull, inArray, asc, sql } from "drizzle-orm";

export interface RuleCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "not_contains" | "in" | "not_in" | "gt" | "gte" | "lt" | "lte" | "between" | "is_empty" | "is_not_empty";
  value: string | string[] | number | [number, number];
}

export interface ConditionGroup {
  logic: "AND" | "OR";
  conditions: RuleCondition[];
}

export interface CompoundConditions {
  logic: "AND" | "OR";
  groups: ConditionGroup[];
}

export interface RuleAction {
  type: "transfer_to_ka" | "add_tag" | "flag" | "exclude";
  targetKesimAlaniId?: string;
  tagId?: string;
  flagReason?: string;
}

export interface ExecutionSummaryItem {
  ruleId: string;
  ruleName: string;
  action: RuleAction;
  affectedCount: number;
  affectedDonationIds: string[];
}

export interface ExecutionResult {
  totalAffected: number;
  ruleResults: ExecutionSummaryItem[];
}

function getFieldValue(donation: Record<string, unknown>, field: string): string {
  const fieldMap: Record<string, string> = {
    birim: "birim",
    temsilci: "temsilci",
    donationType: "donationType",
    ozellik: "ozellik",
    fiyat: "fiyat",
    yerTalebi: "yerTalebi",
    gunTalebi: "gunTalebi",
    ilkHayvan: "ilkHayvan",
    safi: "safi",
    name: "name",
    description: "description",
    vekalet: "vekalet",
    notes: "notes",
    phone: "phone",
    kesimAlaniId: "kesimAlaniId",
    aiCategories: "aiCategories",
  };
  const key = fieldMap[field] || field;
  const val = donation[key];
  if (val === null || val === undefined) return "";
  return String(val);
}

function getNumericValue(donation: Record<string, unknown>, field: string): number {
  if (field === "shareCount") return Number(donation.shareCount) || 0;
  const str = getFieldValue(donation, field);
  return Number(str) || 0;
}

function evaluateCondition(donation: Record<string, unknown>, condition: RuleCondition, donationTags: string[]): boolean {
  const { field, operator, value } = condition;

  if (field === "tags") {
    const tagValues = Array.isArray(value) ? value : [String(value)];
    switch (operator) {
      case "in":
        return tagValues.some(t => donationTags.includes(t));
      case "not_in":
        return !tagValues.some(t => donationTags.includes(t));
      case "is_empty":
        return donationTags.length === 0;
      case "is_not_empty":
        return donationTags.length > 0;
      default:
        return false;
    }
  }

  if (field === "aiCategories") {
    const raw = getFieldValue(donation, "aiCategories");
    let cats: string[] = [];
    try { const p = JSON.parse(raw); if (Array.isArray(p)) cats = p.map(String); } catch {}
    const catValues = Array.isArray(value) ? value : [String(value)];
    switch (operator) {
      case "contains":
        return catValues.some(v => cats.some(c => c.toLowerCase().includes(v.toLowerCase())));
      case "not_contains":
        return !catValues.some(v => cats.some(c => c.toLowerCase().includes(v.toLowerCase())));
      case "in":
        return catValues.some(v => cats.includes(v));
      case "is_empty":
        return cats.length === 0;
      case "is_not_empty":
        return cats.length > 0;
      default:
        return false;
    }
  }

  if (["shareCount"].includes(field) || operator === "gt" || operator === "gte" || operator === "lt" || operator === "lte" || operator === "between") {
    const numVal = getNumericValue(donation, field);
    switch (operator) {
      case "gt": return numVal > Number(value);
      case "gte": return numVal >= Number(value);
      case "lt": return numVal < Number(value);
      case "lte": return numVal <= Number(value);
      case "between": {
        const [min, max] = Array.isArray(value) ? value : [0, 0];
        return numVal >= Number(min) && numVal <= Number(max);
      }
      case "equals": return numVal === Number(value);
      case "not_equals": return numVal !== Number(value);
      default: break;
    }
  }

  const fieldVal = getFieldValue(donation, field).toLowerCase();
  const strValue = Array.isArray(value) ? value.map(v => String(v).toLowerCase()) : [String(value).toLowerCase()];

  switch (operator) {
    case "equals":
      return strValue.some(v => fieldVal === v);
    case "not_equals":
      return !strValue.some(v => fieldVal === v);
    case "contains":
      return strValue.some(v => fieldVal.includes(v));
    case "not_contains":
      return !strValue.some(v => fieldVal.includes(v));
    case "in":
      return strValue.includes(fieldVal);
    case "not_in":
      return !strValue.includes(fieldVal);
    case "is_empty":
      return fieldVal === "";
    case "is_not_empty":
      return fieldVal !== "";
    default:
      return false;
  }
}

function isCompoundConditions(conditions: unknown): conditions is CompoundConditions {
  return (
    typeof conditions === "object" &&
    conditions !== null &&
    !Array.isArray(conditions) &&
    "logic" in conditions &&
    "groups" in conditions
  );
}

function normalizeToCompound(conditions: RuleCondition[] | CompoundConditions): CompoundConditions {
  if (isCompoundConditions(conditions)) return conditions;
  return { logic: "AND", groups: [{ logic: "AND", conditions }] };
}

function matchesRule(donation: Record<string, unknown>, conditions: RuleCondition[] | CompoundConditions, donationTags: string[]): boolean {
  const compound = normalizeToCompound(conditions);

  const groupResults = compound.groups.map(group => {
    if (!group.conditions || group.conditions.length === 0) return true;
    const condResults = group.conditions.map(c => evaluateCondition(donation, c, donationTags));
    return group.logic === "OR"
      ? condResults.some(Boolean)
      : condResults.every(Boolean);
  });

  return compound.logic === "OR"
    ? groupResults.some(Boolean)
    : groupResults.every(Boolean);
}

export async function executeRules(projectId: string): Promise<ExecutionResult> {
  const rules = await db.select()
    .from(automationRulesTable)
    .where(and(
      eq(automationRulesTable.projectId, projectId),
      eq(automationRulesTable.isActive, true),
    ))
    .orderBy(asc(automationRulesTable.priority));

  if (rules.length === 0) {
    return { totalAffected: 0, ruleResults: [] };
  }

  const kaRows = await db.select({ id: kesimAlanlariTable.id, name: kesimAlanlariTable.name })
    .from(kesimAlanlariTable)
    .where(and(eq(kesimAlanlariTable.projectId, projectId), isNull(kesimAlanlariTable.deletedAt)));

  if (kaRows.length === 0) {
    return { totalAffected: 0, ruleResults: [] };
  }

  const kaIds = kaRows.map(k => k.id);

  const donations = await db.select()
    .from(donationsTable)
    .where(and(
      inArray(donationsTable.kesimAlaniId, kaIds),
      isNull(donationsTable.deletedAt),
      eq(donationsTable.excluded, false),
    ));

  if (donations.length === 0) {
    return { totalAffected: 0, ruleResults: [] };
  }

  const donationIds = donations.map(d => d.id);
  const allTags = await db.select({
    donationId: donationTagsTable.donationId,
    tagId: donationTagsTable.tagId,
  }).from(donationTagsTable).where(inArray(donationTagsTable.donationId, donationIds));

  const tagsByDonation: Record<string, string[]> = {};
  for (const t of allTags) {
    if (!tagsByDonation[t.donationId]) tagsByDonation[t.donationId] = [];
    tagsByDonation[t.donationId].push(t.tagId);
  }

  const processedIds = new Set<string>();
  const ruleResults: ExecutionSummaryItem[] = [];

  for (const rule of rules) {
    const rawConditions = rule.conditions as RuleCondition[] | CompoundConditions;
    const action = rule.action as RuleAction;

    if (!rawConditions) continue;
    if (Array.isArray(rawConditions) && rawConditions.length === 0) continue;
    if (!action || !action.type) continue;

    const matchedDonations = donations.filter(d => {
      if (processedIds.has(d.id)) return false;
      return matchesRule(d as unknown as Record<string, unknown>, rawConditions, tagsByDonation[d.id] || []);
    });

    if (matchedDonations.length === 0) {
      ruleResults.push({
        ruleId: rule.id,
        ruleName: rule.name,
        action,
        affectedCount: 0,
        affectedDonationIds: [],
      });
      continue;
    }

    const matchedIds = matchedDonations.map(d => d.id);

    const actuallyAffected = await applyAction(action, matchedIds, kaIds);

    for (const id of actuallyAffected) processedIds.add(id);

    ruleResults.push({
      ruleId: rule.id,
      ruleName: rule.name,
      action,
      affectedCount: actuallyAffected.length,
      affectedDonationIds: actuallyAffected,
    });
  }

  return {
    totalAffected: processedIds.size,
    ruleResults,
  };
}

async function applyAction(action: RuleAction, donationIds: string[], projectKaIds: string[]): Promise<string[]> {
  const CHUNK = 500;
  const affectedIds: string[] = [];

  switch (action.type) {
    case "transfer_to_ka": {
      if (!action.targetKesimAlaniId) return [];
      const targetId = action.targetKesimAlaniId;
      if (!projectKaIds.includes(targetId)) return [];

      const maxSortResult = await db.execute(sql`
        SELECT COALESCE(MAX(sort_order), -1)::int AS max_sort
        FROM donations
        WHERE kesim_alani_id = ${targetId} AND deleted_at IS NULL
      `);
      let nextSort = ((maxSortResult.rows[0] as { max_sort: number })?.max_sort ?? -1) + 1;

      for (let i = 0; i < donationIds.length; i += CHUNK) {
        const chunk = donationIds.slice(i, i + CHUNK);
        const result = await db.update(donationsTable)
          .set({ kesimAlaniId: targetId, updatedAt: new Date() })
          .where(and(
            inArray(donationsTable.id, chunk),
            isNull(donationsTable.deletedAt),
          ))
          .returning({ id: donationsTable.id });

        if (result.length > 0) {
          const caseParts = result.map((r, idx) =>
            sql`WHEN ${r.id} THEN ${nextSort + idx}`
          );
          const ids = result.map(r => r.id);
          await db.execute(sql`
            UPDATE donations SET sort_order = CASE id ${sql.join(caseParts, sql` `)} END
            WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
          `);
          nextSort += result.length;
          affectedIds.push(...ids);
        }
      }
      break;
    }

    case "add_tag": {
      if (!action.tagId) return [];
      const tagId = action.tagId;
      for (let i = 0; i < donationIds.length; i += CHUNK) {
        const chunk = donationIds.slice(i, i + CHUNK);
        const values = chunk.map(donationId => ({ donationId, tagId }));
        const result = await db.insert(donationTagsTable)
          .values(values)
          .onConflictDoNothing()
          .returning({ donationId: donationTagsTable.donationId });
        affectedIds.push(...result.map(r => r.donationId));
      }
      break;
    }

    case "flag": {
      const reason = action.flagReason || "Kural tarafından işaretlendi";
      for (let i = 0; i < donationIds.length; i += CHUNK) {
        const chunk = donationIds.slice(i, i + CHUNK);
        const result = await db.update(donationsTable)
          .set({ isFlagged: true, flagReason: reason, updatedAt: new Date() })
          .where(inArray(donationsTable.id, chunk))
          .returning({ id: donationsTable.id });
        affectedIds.push(...result.map(r => r.id));
      }
      break;
    }

    case "exclude": {
      for (let i = 0; i < donationIds.length; i += CHUNK) {
        const chunk = donationIds.slice(i, i + CHUNK);
        const result = await db.update(donationsTable)
          .set({ excluded: true, updatedAt: new Date() })
          .where(inArray(donationsTable.id, chunk))
          .returning({ id: donationsTable.id });
        affectedIds.push(...result.map(r => r.id));
      }
      break;
    }
  }

  return affectedIds;
}
