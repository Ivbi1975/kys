import { db } from "@workspace/db";
import { conflictsLogTable, kesimAlanlariTable, donationsTable } from "@workspace/db/schema";
import { eq, isNull, and, desc, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

export interface ConflictItem {
  donationId: string;
  donationName: string;
  vekalet: string;
  existingVekaletDonationId?: string;
  existingVekaletName?: string;
}

export interface TransferConflictCheck {
  hasConflicts: boolean;
  conflicts: ConflictItem[];
  sourceKesimAlaniName: string;
  targetKesimAlaniName: string;
}

export async function checkTransferConflicts(
  donationIds: string[],
  sourceKesimAlaniId: string,
  targetKesimAlaniId: string,
  projectId?: string,
): Promise<TransferConflictCheck> {
  const [sourceKA, targetKA] = await Promise.all([
    db.select({ name: kesimAlanlariTable.name, projectId: kesimAlanlariTable.projectId }).from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, sourceKesimAlaniId)).then(r => r[0]),
    db.select({ name: kesimAlanlariTable.name }).from(kesimAlanlariTable).where(eq(kesimAlanlariTable.id, targetKesimAlaniId)).then(r => r[0]),
  ]);

  const resolvedProjectId = projectId ?? sourceKA?.projectId ?? null;
  const sourceKAName = sourceKA?.name ?? "";
  const targetKAName = targetKA?.name ?? "";

  const CHUNK = 500;
  const donations: { id: string; name: string; vekalet: string }[] = [];
  for (let i = 0; i < donationIds.length; i += CHUNK) {
    const chunk = donationIds.slice(i, i + CHUNK);
    const rows = await db
      .select({ id: donationsTable.id, name: donationsTable.name, vekalet: donationsTable.vekalet })
      .from(donationsTable)
      .innerJoin(kesimAlanlariTable, eq(donationsTable.kesimAlaniId, kesimAlanlariTable.id))
      .where(and(
        inArray(donationsTable.id, chunk),
        isNull(donationsTable.deletedAt),
        isNull(kesimAlanlariTable.deletedAt),
        resolvedProjectId
          ? eq(kesimAlanlariTable.projectId, resolvedProjectId)
          : undefined,
      ));
    donations.push(...rows.map(r => ({ id: r.id, name: r.name, vekalet: r.vekalet })));
  }

  const nonEmptyVekalets = donations.filter(d => d.vekalet && d.vekalet.trim() !== "");
  if (nonEmptyVekalets.length === 0) {
    return { hasConflicts: false, conflicts: [], sourceKesimAlaniName: sourceKAName, targetKesimAlaniName: targetKAName };
  }

  const vekaletValues = nonEmptyVekalets.map(d => d.vekalet.trim().toLowerCase());
  const existingInTarget = await db.execute(sql`
    SELECT id, name, vekalet
    FROM donations
    WHERE deleted_at IS NULL
      AND kesim_alani_id = ${targetKesimAlaniId}
      AND LOWER(TRIM(vekalet)) IN (${sql.join(vekaletValues.map(v => sql`${v}`), sql`, `)})
  `);

  const existingMap = new Map<string, { id: string; name: string }>();
  for (const row of existingInTarget.rows as { id: string; name: string; vekalet: string }[]) {
    existingMap.set(row.vekalet.trim().toLowerCase(), { id: row.id, name: row.name });
  }

  const conflicts: ConflictItem[] = [];
  for (const d of nonEmptyVekalets) {
    const existing = existingMap.get(d.vekalet.trim().toLowerCase());
    if (existing) {
      conflicts.push({
        donationId: d.id,
        donationName: d.name,
        vekalet: d.vekalet,
        existingVekaletDonationId: existing.id,
        existingVekaletName: existing.name,
      });
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    sourceKesimAlaniName: sourceKAName,
    targetKesimAlaniName: targetKAName,
  };
}

export async function logConflicts(
  projectId: string,
  conflicts: ConflictItem[],
  sourceKesimAlaniId: string,
  sourceKesimAlaniName: string,
  targetKesimAlaniId: string,
  targetKesimAlaniName: string,
  resolution: "forced" | "blocked",
  conflictType: string = "vekalet_duplicate",
): Promise<void> {
  if (conflicts.length === 0) return;
  const now = new Date();
  const rows = conflicts.map(c => ({
    id: crypto.randomUUID(),
    projectId,
    donationId: c.donationId,
    donationName: c.donationName,
    vekalet: c.vekalet,
    sourceKesimAlaniId,
    sourceKesimAlaniName,
    targetKesimAlaniId,
    targetKesimAlaniName,
    conflictType,
    detectedAt: now,
    resolution,
    resolvedAt: now,
  }));

  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.insert(conflictsLogTable).values(rows.slice(i, i + BATCH));
  }
}

export interface ConflictLogEntry {
  id: string;
  projectId: string | null;
  donationId: string | null;
  donationName: string;
  vekalet: string;
  sourceKesimAlaniId: string | null;
  sourceKesimAlaniName: string;
  targetKesimAlaniId: string | null;
  targetKesimAlaniName: string;
  conflictType: string;
  detectedAt: string;
  resolution: string | null;
  resolvedAt: string | null;
}

export async function fetchConflictLog(projectId: string): Promise<ConflictLogEntry[]> {
  const rows = await db.select()
    .from(conflictsLogTable)
    .where(eq(conflictsLogTable.projectId, projectId))
    .orderBy(desc(conflictsLogTable.detectedAt))
    .limit(200);

  return rows.map(r => ({
    id: r.id,
    projectId: r.projectId,
    donationId: r.donationId,
    donationName: r.donationName,
    vekalet: r.vekalet,
    sourceKesimAlaniId: r.sourceKesimAlaniId,
    sourceKesimAlaniName: r.sourceKesimAlaniName,
    targetKesimAlaniId: r.targetKesimAlaniId,
    targetKesimAlaniName: r.targetKesimAlaniName,
    conflictType: r.conflictType,
    detectedAt: r.detectedAt.toISOString(),
    resolution: r.resolution,
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  }));
}
